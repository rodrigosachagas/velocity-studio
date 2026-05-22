use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use tokio::io::AsyncWriteExt;

// ── Legacy file-pattern export (kept for compatibility) ──────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportOptions {
    pub input_path: String,
    /// Multiple input paths — when set, uses FFmpeg concat demuxer instead of single input.
    pub input_paths: Option<Vec<String>>,
    /// Directory containing overlay frames named frame_00000.png, frame_00001.png, …
    pub overlay_frames_dir: String,
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub overlay_fps: Option<f64>,
    pub output_fps: Option<f64>,
    pub codec: String,
    pub crf: u8,
    pub max_duration_seconds: Option<f64>,
    pub trim_start: Option<f64>,
    pub trim_duration: Option<f64>,
}

// ── Pipe (image2pipe) export — streams overlay frames directly to FFmpeg stdin ─

/// Options for the streaming pipe-based export.
/// Identical to ExportOptions minus overlay_frames_dir.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipeExportOptions {
    pub input_path: String,
    pub input_paths: Option<Vec<String>>,
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub overlay_fps: f64,
    pub output_fps: Option<f64>,
    pub codec: String,
    pub crf: u8,
    pub max_duration_seconds: Option<f64>,
    pub trim_start: Option<f64>,
    pub trim_duration: Option<f64>,
}

struct PipeState {
    stdin: tokio::process::ChildStdin,
    child: tokio::process::Child,
    /// Background task draining ffmpeg stderr so its pipe buffer never fills (deadlock prevention)
    stderr_drain: tokio::task::JoinHandle<Vec<u8>>,
    output_path: String,
}

static PIPE_STATE: std::sync::OnceLock<Arc<tokio::sync::Mutex<Option<PipeState>>>> =
    std::sync::OnceLock::new();
static FRAME_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn get_pipe_state() -> &'static Arc<tokio::sync::Mutex<Option<PipeState>>> {
    PIPE_STATE.get_or_init(|| Arc::new(tokio::sync::Mutex::new(None)))
}

// ── Shared helpers ────────────────────────────────────────────────────────────

static CANCEL_FLAG: std::sync::OnceLock<Arc<Mutex<bool>>> = std::sync::OnceLock::new();

fn get_cancel_flag() -> &'static Arc<Mutex<bool>> {
    CANCEL_FLAG.get_or_init(|| Arc::new(Mutex::new(false)))
}

/// Build the video input args (concat demuxer or single file) plus optional trim seek.
/// Returns (args_vec, concat_list_path_if_any).
fn build_video_input_args(
    input_path: &str,
    input_paths: Option<&Vec<String>>,
    trim_start: Option<f64>,
    temp_prefix: &str,
) -> Result<(Vec<String>, Option<String>), String> {
    use std::io::Write;

    let trim_seek_args: Vec<String> = match trim_start {
        Some(ts) if ts > 0.0 => vec!["-ss".to_string(), format!("{:.6}", ts)],
        _ => vec![],
    };

    let concat_list_path: Option<String> = match input_paths {
        Some(paths) if paths.len() > 1 => {
            let list_path = format!("{}_concat_list.txt", temp_prefix);
            let mut f = std::fs::File::create(&list_path)
                .map_err(|e| format!("Failed to create concat list: {e}"))?;
            for p in paths {
                writeln!(f, "file '{}'", p.replace('\'', "'\\''"))
                    .map_err(|e| format!("Failed to write concat list: {e}"))?;
            }
            Some(list_path)
        }
        _ => None,
    };

    let mut args = trim_seek_args;
    if let Some(ref list) = concat_list_path {
        args.extend([
            "-f".to_string(), "concat".to_string(),
            "-safe".to_string(), "0".to_string(),
            "-i".to_string(), list.clone(),
        ]);
    } else {
        args.push("-i".to_string());
        args.push(input_path.to_string());
    }

    Ok((args, concat_list_path))
}

/// Build VideoToolbox bitrate strings for hardware H.264 encoding.
fn hw_bitrate_args(crf: u8, width: u32, height: u32) -> (String, String, String) {
    let reference_pixels: f64 = (1920 * 1080) as f64;
    let video_pixels: f64 = (width as u64 * height as u64) as f64;
    let pixel_scale = video_pixels / reference_pixels;
    let base_kbps = 40_000.0 * f64::exp(-0.09 * (crf as f64 - 12.0));
    let kbps = ((base_kbps * pixel_scale) as u64).max(1000);
    (format!("{}k", kbps), format!("{}k", kbps * 2), format!("{}k", kbps * 4))
}

/// Append codec + filter args to an existing arg list.
/// `overlay_source` is either a file pattern (legacy) or "pipe:0" (streaming).
fn append_codec_args(
    args: &mut Vec<String>,
    codec: &str,
    crf: u8,
    overlay_fps_str: &str,
    overlay_source: &str,
    output_fps: Option<f64>,
    effective_duration: Option<f64>,
    hw_mode: bool,
    hw_bitrate: Option<(&str, &str, &str)>,
) {
    let filter_h26x = "[0:v][1:v]overlay=0:0,format=yuv420p";
    let filter_prores = "[0:v][1:v]overlay=0:0,format=yuv422p10le";
    let crf_str = crf.to_string();

    // Overlay input
    args.extend([
        "-framerate".to_string(), overlay_fps_str.to_string(),
        "-i".to_string(), overlay_source.to_string(),
    ]);

    match codec {
        "prores" => {
            let profile = if crf <= 15 { 4 } else if crf <= 25 { 3 } else { 2 };
            args.extend([
                "-filter_complex".to_string(), filter_prores.to_string(),
                "-c:v".to_string(), "prores_ks".to_string(),
                "-profile:v".to_string(), profile.to_string(),
                "-vendor".to_string(), "apl0".to_string(),
                "-c:a".to_string(), "copy".to_string(),
            ]);
        }
        "h265" => {
            args.extend([
                "-filter_complex".to_string(), filter_h26x.to_string(),
                "-c:v".to_string(), "libx265".to_string(),
                "-crf".to_string(), crf_str,
                "-preset".to_string(), "medium".to_string(),
                "-c:a".to_string(), "copy".to_string(),
                "-movflags".to_string(), "+faststart".to_string(),
            ]);
        }
        _ => {
            // h264
            if hw_mode {
                if let Some((bitrate, maxrate, bufsize)) = hw_bitrate {
                    args.extend([
                        "-filter_complex".to_string(), filter_h26x.to_string(),
                        "-c:v".to_string(), "h264_videotoolbox".to_string(),
                        "-b:v".to_string(), bitrate.to_string(),
                        "-maxrate".to_string(), maxrate.to_string(),
                        "-bufsize".to_string(), bufsize.to_string(),
                        "-allow_sw".to_string(), "1".to_string(),
                        "-c:a".to_string(), "copy".to_string(),
                        "-movflags".to_string(), "+faststart".to_string(),
                    ]);
                }
            } else {
                args.extend([
                    "-filter_complex".to_string(), filter_h26x.to_string(),
                    "-c:v".to_string(), "libx264".to_string(),
                    "-crf".to_string(), crf_str,
                    "-preset".to_string(), "medium".to_string(),
                    "-c:a".to_string(), "copy".to_string(),
                    "-movflags".to_string(), "+faststart".to_string(),
                ]);
            }
        }
    }

    if let Some(fps) = output_fps {
        args.extend(["-r".to_string(), fps.to_string()]);
    }
    if let Some(d) = effective_duration {
        args.extend(["-t".to_string(), format!("{:.6}", d)]);
    }
}

// ── Pipe-based export commands ────────────────────────────────────────────────

/// Start FFmpeg in the background, reading overlay frames from stdin (image2pipe).
/// Returns immediately; use `pipe_frame_bytes` to feed each frame, then `finish_pipe_export`.
#[tauri::command]
pub async fn start_pipe_export(options: PipeExportOptions) -> Result<(), String> {
    // Reject if another pipe export is already running
    {
        let lock = get_pipe_state().lock().await;
        if lock.is_some() {
            return Err("A pipe export is already in progress".to_string());
        }
    }

    *get_cancel_flag().lock().unwrap() = false;

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_prefix = format!("{}/velocity_pipe_{}", std::env::temp_dir().display(), ts);

    let (video_input_args, _concat_list) = build_video_input_args(
        &options.input_path,
        options.input_paths.as_ref(),
        options.trim_start,
        &temp_prefix,
    )?;

    let effective_duration: Option<f64> = match (options.trim_duration, options.max_duration_seconds) {
        (Some(td), Some(max)) => Some(td.min(max)),
        (Some(td), None) => Some(td),
        (None, Some(max)) => Some(max),
        (None, None) => None,
    };

    let overlay_fps_str = options.overlay_fps.to_string();

    // For image2pipe, the overlay input needs the -f flag before the framerate:
    // -f image2pipe -framerate <fps> -vcodec png -i pipe:0
    // We prepend these to the regular overlay args.
    let mut args: Vec<String> = vec!["-y".to_string()];
    args.extend(video_input_args);
    // Overlay input: PNG frames streamed to ffmpeg stdin.
    // -vcodec png tells ffmpeg how to decode the piped frames.
    args.extend([
        "-f".to_string(), "image2pipe".to_string(),
        "-vcodec".to_string(), "png".to_string(),
    ]);

    // H264: use VideoToolbox for 10-20× faster encoding on Apple Silicon.
    // H265 VideoToolbox is excluded (black-frame bug). libx265 is used instead.
    // We don't support HW→SW fallback in pipe mode — if VideoToolbox fails the
    // export errors out rather than silently re-rendering all frames.
    let hw_mode = options.codec == "h264";
    let (bv, bmx, bsz) = hw_bitrate_args(options.crf, options.width, options.height);

    append_codec_args(
        &mut args,
        &options.codec,
        options.crf,
        &overlay_fps_str,
        "pipe:0",
        options.output_fps,
        effective_duration,
        hw_mode,
        if hw_mode { Some((&bv, &bmx, &bsz)) } else { None },
    );

    args.push(options.output_path.clone());

    let mut child = tokio::process::Command::new("ffmpeg")
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    let stdin = child.stdin.take().ok_or("Failed to open ffmpeg stdin")?;

    // Drain ffmpeg's stderr continuously in the background.
    // Without this, ffmpeg blocks on stderr writes once the OS pipe buffer fills (~64KB),
    // which stops it reading from stdin, which causes our write_all to deadlock.
    let stderr = child.stderr.take().ok_or("Failed to open ffmpeg stderr")?;
    let stderr_drain = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        let _ = tokio::io::BufReader::new(stderr).read_to_end(&mut buf).await;
        buf
    });

    FRAME_COUNTER.store(0, std::sync::atomic::Ordering::Relaxed);

    *get_pipe_state().lock().await = Some(PipeState {
        stdin,
        child,
        stderr_drain,
        output_path: options.output_path,
    });

    Ok(())
}

/// Receive one PNG frame as a base64-encoded string and pipe it directly to FFmpeg stdin.
/// No filesystem writes — bytes travel JS → IPC → Rust memory → FFmpeg stdin pipe.
#[tauri::command]
pub async fn pipe_frame_base64(data: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("base64 decode failed: {e}"))?;

    let mut lock = get_pipe_state().lock().await;
    if let Some(state) = lock.as_mut() {
        state.stdin
            .write_all(&bytes)
            .await
            .map_err(|e| format!("FFmpeg stdin write failed: {e}"))?;

        let n = FRAME_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
        if n % 500 == 0 {
            eprintln!("[export] piped frame {n}");
        }
        // Always update last-frame file so we know where it stopped on crash
        let _ = std::fs::write(
            "/tmp/velocity_last_frame.txt",
            format!("last_frame={n}\nbytes={}\n", bytes.len()),
        );
    }
    Ok(())
}

/// Legacy: read one PNG frame from `path`, pipe it to FFmpeg stdin, then delete the file.
/// Kept for compatibility — prefer pipe_frame_base64 for new code (avoids disk writes).
#[tauri::command]
pub async fn pipe_next_frame(path: String) -> Result<(), String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read frame file '{path}': {e}"))?;

    tokio::fs::remove_file(&path).await.ok();

    let mut lock = get_pipe_state().lock().await;
    if let Some(state) = lock.as_mut() {
        state.stdin
            .write_all(&bytes)
            .await
            .map_err(|e| format!("FFmpeg stdin write failed: {e}"))?;
    }
    Ok(())
}

/// Close FFmpeg stdin (signals EOF) and wait for encoding to complete.
/// Returns the output path on success.
#[tauri::command]
pub async fn finish_pipe_export(app: tauri::AppHandle) -> Result<String, String> {
    let state = get_pipe_state().lock().await.take();

    let Some(PipeState { stdin, mut child, stderr_drain, output_path }) = state else {
        return Err("No active pipe export".to_string());
    };

    // Dropping stdin sends EOF to ffmpeg — it will finish encoding and exit
    drop(stdin);

    // Wait for ffmpeg to complete, then collect stderr for error reporting
    let exit = child
        .wait()
        .await
        .map_err(|e| format!("FFmpeg wait failed: {e}"))?;

    let stderr_bytes = stderr_drain.await.unwrap_or_default();

    if !exit.success() {
        let stderr = String::from_utf8_lossy(&stderr_bytes);
        return Err(format!("FFmpeg encoding failed:\n{stderr}"));
    }

    app.emit("export:complete", &output_path)
        .map_err(|e| e.to_string())?;
    Ok(output_path)
}

// ── Legacy render_video (file-pattern approach) ────────────────────────────────

#[tauri::command]
pub async fn render_video(
    app: tauri::AppHandle,
    options: ExportOptions,
) -> Result<String, String> {
    *get_cancel_flag().lock().unwrap() = false;

    let frames_pattern = format!("{}/frame_%05d.png", options.overlay_frames_dir);
    let overlay_fps_str = options.overlay_fps.unwrap_or(options.fps).to_string();

    let (video_input_args, _) = build_video_input_args(
        &options.input_path,
        options.input_paths.as_ref(),
        options.trim_start,
        &format!("{}/", options.overlay_frames_dir),
    )?;

    let effective_duration: Option<f64> = match (options.trim_duration, options.max_duration_seconds) {
        (Some(td), Some(max)) => Some(td.min(max)),
        (Some(td), None) => Some(td),
        (None, Some(max)) => Some(max),
        (None, None) => None,
    };

    let (bv, bmx, bsz) = hw_bitrate_args(options.crf, options.width, options.height);

    // Try h264_videotoolbox first for H.264
    if options.codec == "h264" {
        let mut hw_args: Vec<String> = vec!["-y".to_string()];
        hw_args.extend(video_input_args.clone());
        append_codec_args(
            &mut hw_args,
            "h264",
            options.crf,
            &overlay_fps_str,
            &frames_pattern,
            options.output_fps,
            effective_duration,
            true,
            Some((&bv, &bmx, &bsz)),
        );
        hw_args.push(options.output_path.clone());

        let hw_out = app.shell().command("ffmpeg").args(hw_args).output().await;
        if let Ok(out) = hw_out {
            if out.status.success() {
                app.emit("export:complete", &options.output_path).map_err(|e| e.to_string())?;
                return Ok(options.output_path);
            }
        }
    }

    // Software fallback
    let mut sw_args: Vec<String> = vec!["-y".to_string()];
    sw_args.extend(video_input_args);
    append_codec_args(
        &mut sw_args,
        &options.codec,
        options.crf,
        &overlay_fps_str,
        &frames_pattern,
        options.output_fps,
        effective_duration,
        false,
        None,
    );
    sw_args.push(options.output_path.clone());

    let output = app
        .shell()
        .command("ffmpeg")
        .args(&sw_args)
        .output()
        .await
        .map_err(|e| format!("ffmpeg render failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Render failed:\n{stderr}"));
    }

    app.emit("export:complete", &options.output_path).map_err(|e| e.to_string())?;
    Ok(options.output_path)
}

/// Write a JS-side debug status string to /tmp — used to pinpoint crashes in the JS export loop.
#[tauri::command]
pub async fn write_debug_status(status: String) -> Result<(), String> {
    eprintln!("[export-js] {status}");
    std::fs::write("/tmp/velocity_js_crash.txt", &status)
        .map_err(|e| format!("write failed: {e}"))
}

/// Concatenate a list of chunk video files into a single output using FFmpeg stream copy.
/// Deletes the chunk files after a successful concat.
#[tauri::command]
pub async fn concat_videos(chunk_paths: Vec<String>, output_path: String) -> Result<(), String> {
    use std::io::Write;

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let list_path = format!("{}/velocity_concat_{}.txt", std::env::temp_dir().display(), ts);

    {
        let mut f = std::fs::File::create(&list_path)
            .map_err(|e| format!("Failed to create concat list: {e}"))?;
        for p in &chunk_paths {
            writeln!(f, "file '{}'", p.replace('\'', "'\\''"))
                .map_err(|e| format!("Failed to write concat list: {e}"))?;
        }
    }

    let faststart = output_path.ends_with(".mp4");
    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), list_path.clone(),
        "-c".to_string(), "copy".to_string(),
    ];
    if faststart {
        args.extend(["-movflags".to_string(), "+faststart".to_string()]);
    }
    args.push(output_path.clone());

    let output = tokio::process::Command::new("ffmpeg")
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg concat: {e}"))?;

    let _ = std::fs::remove_file(&list_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concat failed:\n{stderr}"));
    }

    for p in &chunk_paths {
        let _ = std::fs::remove_file(p);
    }

    eprintln!("[export] concat complete → {output_path}");
    Ok(())
}

#[tauri::command]
pub async fn cancel_render() -> Result<(), String> {
    *get_cancel_flag().lock().unwrap() = true;

    // Also kill any active pipe export
    let state = get_pipe_state().lock().await.take();
    if let Some(PipeState { stdin, mut child, stderr_drain, .. }) = state {
        drop(stdin);
        let _ = child.kill().await;
        stderr_drain.abort();
    }

    Ok(())
}

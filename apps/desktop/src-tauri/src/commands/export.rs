use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

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
    pub codec: String,
    pub crf: u8,
    /// Optional duration cap in seconds — used for test exports
    pub max_duration_seconds: Option<f64>,
    /// Trim: start offset in seconds (input-side seek — fast)
    pub trim_start: Option<f64>,
    /// Trim: how many seconds to encode after trim_start
    pub trim_duration: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ExportProgress {
    pub frame: u64,
    pub total_frames: u64,
    pub percent: f64,
    pub eta_seconds: f64,
}

static CANCEL_FLAG: std::sync::OnceLock<Arc<Mutex<bool>>> = std::sync::OnceLock::new();

fn get_cancel_flag() -> &'static Arc<Mutex<bool>> {
    CANCEL_FLAG.get_or_init(|| Arc::new(Mutex::new(false)))
}

#[tauri::command]
pub async fn render_video(
    app: tauri::AppHandle,
    options: ExportOptions,
) -> Result<String, String> {
    use std::io::Write;

    *get_cancel_flag().lock().unwrap() = false;

    let frames_pattern = format!("{}/frame_%05d.png", options.overlay_frames_dir);
    let fps_str = options.fps.to_string();
    let crf_str = options.crf.to_string();

    // Build concat list file when multiple input paths are provided
    let concat_list_path: Option<String> = if let Some(ref paths) = options.input_paths {
        if paths.len() > 1 {
            let list_path = format!("{}/concat_list.txt", options.overlay_frames_dir);
            let mut f = std::fs::File::create(&list_path)
                .map_err(|e| format!("Failed to create concat list: {e}"))?;
            for p in paths {
                writeln!(f, "file '{}'", p.replace('\'', "'\\''"))
                    .map_err(|e| format!("Failed to write concat list: {e}"))?;
            }
            Some(list_path)
        } else {
            None
        }
    } else {
        None
    };

    // Choose video input args: concat demuxer or single file, with optional trim seek
    let trim_seek_args: Vec<String> = if let Some(ts) = options.trim_start {
        if ts > 0.0 {
            vec!["-ss".to_string(), format!("{:.6}", ts)]
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    let (video_input_args, video_input_path): (Vec<String>, String) =
        if let Some(ref list) = concat_list_path {
            let mut args = trim_seek_args.clone();
            args.extend([
                "-f".to_string(), "concat".to_string(),
                "-safe".to_string(), "0".to_string(),
                "-i".to_string(), list.clone(),
            ]);
            (args, list.clone())
        } else {
            let mut args = trim_seek_args.clone();
            args.push("-i".to_string());
            args.push(options.input_path.clone());
            (args, options.input_path.clone())
        };
    let _ = video_input_path; // used indirectly via video_input_args

    // Compute a resolution-scaled target bitrate for VideoToolbox.
    // VideoToolbox -q:v with no bitrate cap can produce files 2–3× larger than the source.
    // Formula: ~16 Mbps base at 1080p for CRF 18, scaling exponentially with CRF and
    // linearly with pixel count relative to 1080p.
    let reference_pixels: f64 = (1920 * 1080) as f64;
    let video_pixels: f64 = (options.width as u64 * options.height as u64) as f64;
    let pixel_scale = video_pixels / reference_pixels;
    let base_kbps = 40_000.0 * f64::exp(-0.09 * (options.crf as f64 - 12.0));
    let hw_bitrate_kbps = ((base_kbps * pixel_scale) as u64).max(1000);
    let hw_bitrate_str = format!("{}k", hw_bitrate_kbps);
    let hw_maxrate_str = format!("{}k", hw_bitrate_kbps * 2);
    let hw_bufsize_str = format!("{}k", hw_bitrate_kbps * 4);

    // Duration cap: pick the shortest of trim_duration and max_duration_seconds
    let effective_duration: Option<f64> = match (options.trim_duration, options.max_duration_seconds) {
        (Some(td), Some(max)) => Some(td.min(max)),
        (Some(td), None) => Some(td),
        (None, Some(max)) => Some(max),
        (None, None) => None,
    };
    let duration_args: Vec<String> = if let Some(d) = effective_duration {
        vec!["-t".to_string(), format!("{:.6}", d)]
    } else {
        vec![]
    };

    // Hardware codec choice per platform (VideoToolbox on macOS)
    let hw_codec: Option<&str> = match options.codec.as_str() {
        "h264" => Some("h264_videotoolbox"),
        "h265" => Some("hevc_videotoolbox"),
        _ => None, // ProRes: always software
    };

    // Try hardware encoder first — 10–20× faster on Apple Silicon / Intel Mac
    if let Some(hw) = hw_codec {
        let mut hw_args: Vec<String> = vec!["-y".to_string()];
        hw_args.extend(video_input_args.clone());
        hw_args.extend([
            "-framerate".to_string(), fps_str.clone(),
            "-i".to_string(), frames_pattern.clone(),
            "-filter_complex".to_string(), "[0:v][1:v]overlay=0:0".to_string(),
            "-c:v".to_string(), hw.to_string(),
            "-b:v".to_string(), hw_bitrate_str.clone(),
            "-maxrate".to_string(), hw_maxrate_str.clone(),
            "-bufsize".to_string(), hw_bufsize_str.clone(),
            "-allow_sw".to_string(), "1".to_string(),
            "-c:a".to_string(), "copy".to_string(),
            "-movflags".to_string(), "+faststart".to_string(),
        ]);
        hw_args.extend(duration_args.clone());
        hw_args.push(options.output_path.clone());

        let hw_out = app
            .shell()
            .command("ffmpeg")
            .args(hw_args)
            .output()
            .await;

        if let Ok(out) = hw_out {
            if out.status.success() {
                app.emit("export:complete", &options.output_path).map_err(|e| e.to_string())?;
                return Ok(options.output_path);
            }
            // Hardware encoding failed — fall through to software
        }
    }

    // Software fallback (libx264 / libx265 / prores_ks)
    let sw_codec = match options.codec.as_str() {
        "h265" => "libx265",
        "prores" => "prores_ks",
        _ => "libx264",
    };

    let mut sw_args: Vec<String> = vec!["-y".to_string()];
    sw_args.extend(video_input_args.clone());
    sw_args.extend([
        "-framerate".to_string(), fps_str.clone(),
        "-i".to_string(), frames_pattern.clone(),
        "-filter_complex".to_string(), "[0:v][1:v]overlay=0:0".to_string(),
        "-c:v".to_string(), sw_codec.to_string(),
        "-crf".to_string(), crf_str.clone(),
        "-preset".to_string(), "medium".to_string(),
        "-c:a".to_string(), "copy".to_string(),
        "-movflags".to_string(), "+faststart".to_string(),
    ]);
    sw_args.extend(duration_args.clone());
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
        return Err(format!("Render failed: {stderr}"));
    }

    app.emit("export:complete", &options.output_path).map_err(|e| e.to_string())?;
    Ok(options.output_path)
}

#[tauri::command]
pub async fn cancel_render() -> Result<(), String> {
    *get_cancel_flag().lock().unwrap() = true;
    Ok(())
}

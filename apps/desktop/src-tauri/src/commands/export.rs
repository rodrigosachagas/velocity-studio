use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportOptions {
    pub input_path: String,
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
    *get_cancel_flag().lock().unwrap() = false;

    let frames_pattern = format!("{}/frame_%05d.png", options.overlay_frames_dir);
    let fps_str = options.fps.to_string();
    let crf_str = options.crf.to_string();

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

    // Optional duration cap (-t flag) for test exports
    let duration_args: Vec<String> = if let Some(max_secs) = options.max_duration_seconds {
        vec!["-t".to_string(), format!("{:.3}", max_secs)]
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
        let mut hw_args: Vec<&str> = vec![
            "-y",
            "-i", &options.input_path,
            "-framerate", &fps_str,
            "-i", &frames_pattern,
            "-filter_complex", "[0:v][1:v]overlay=0:0",
            "-c:v", hw,
            "-b:v", &hw_bitrate_str,
            "-maxrate", &hw_maxrate_str,
            "-bufsize", &hw_bufsize_str,
            "-allow_sw", "1",   // transparent software fallback if GPU unavailable
            "-c:a", "copy",
            "-movflags", "+faststart",
        ];
        let dur_refs: Vec<&str> = duration_args.iter().map(|s| s.as_str()).collect();
        hw_args.extend(dur_refs.iter().copied());
        hw_args.push(&options.output_path);

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

    let mut sw_args: Vec<&str> = vec![
        "-y",
        "-i", &options.input_path,
        "-framerate", &fps_str,
        "-i", &frames_pattern,
        "-filter_complex", "[0:v][1:v]overlay=0:0",
        "-c:v", sw_codec,
        "-crf", &crf_str,
        "-preset", "medium",
        "-c:a", "copy",
        "-movflags", "+faststart",
    ];
    let dur_refs: Vec<&str> = duration_args.iter().map(|s| s.as_str()).collect();
    sw_args.extend(dur_refs.iter().copied());
    sw_args.push(&options.output_path);

    let output = app
        .shell()
        .command("ffmpeg")
        .args(sw_args)
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

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportOptions {
    pub input_path: String,
    pub overlay_frames_path: String,
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub crf: u8,
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

    let codec = match options.codec.as_str() {
        "h265" => "libx265",
        "prores" => "prores_ks",
        _ => "libx264",
    };

    let vf = format!("scale={}:{}", options.width, options.height);

    let output = app
        .shell()
        .command("ffmpeg")
        .args([
            "-y",
            "-i", &options.input_path,
            "-i", &options.overlay_frames_path,
            "-filter_complex", "[0:v][1:v]overlay=0:0",
            "-vf", &vf,
            "-c:v", codec,
            "-crf", &options.crf.to_string(),
            "-preset", "slow",
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            &options.output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffmpeg render failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Render failed: {stderr}"));
    }

    app.emit("export:complete", &options.output_path)
        .map_err(|e| e.to_string())?;

    Ok(options.output_path)
}

#[tauri::command]
pub async fn cancel_render() -> Result<(), String> {
    *get_cancel_flag().lock().unwrap() = true;
    Ok(())
}

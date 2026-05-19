use std::fs;
use tauri_plugin_shell::ShellExt;

/// Extract raw GPMF bytes from a GoPro MP4 — returns base64-encoded binary
#[tauri::command]
pub async fn extract_gpmf_raw(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<u8>, String> {
    // Extract the GPMF data stream using ffmpeg
    let output = app
        .shell()
        .command("ffmpeg")
        .args([
            "-y",
            "-i", &path,
            "-map", "0:d:0",
            "-c", "copy",
            "-f", "rawvideo",
            "pipe:1",
        ])
        .output()
        .await
        .map_err(|e| format!("ffmpeg gpmf extract failed: {e}"))?;

    if output.stdout.is_empty() {
        return Err("No GPMF data stream found".to_string());
    }

    Ok(output.stdout)
}

/// Extract GPS/telemetry via ExifTool, returns JSON string
#[tauri::command]
pub async fn extract_exif(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    let output = app
        .shell()
        .command("exiftool")
        .args([
            "-json",
            "-GPS*",
            "-Duration",
            "-TrackCreateDate",
            &path,
        ])
        .output()
        .await
        .map_err(|e| format!("exiftool failed: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if stdout.trim() == "[]" || stdout.trim().is_empty() {
        return Err("No GPS data found via ExifTool".to_string());
    }

    Ok(stdout)
}

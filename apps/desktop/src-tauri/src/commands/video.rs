use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoProbeResult {
    pub path: String,
    pub duration: f64,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub bitrate: Option<u64>,
    pub has_gpmf: bool,
}

/// Use ffprobe to extract video metadata
#[tauri::command]
pub async fn probe_video(
    app: tauri::AppHandle,
    path: String,
) -> Result<VideoProbeResult, String> {
    let output = app
        .shell()
        .command("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe failed: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {e}"))?;

    let video_stream = json["streams"]
        .as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "video"))
        .ok_or("No video stream found")?;

    let format = &json["format"];

    let duration = format["duration"]
        .as_str()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    let width = video_stream["width"].as_u64().unwrap_or(0) as u32;
    let height = video_stream["height"].as_u64().unwrap_or(0) as u32;
    let codec = video_stream["codec_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    let fps = parse_fps(video_stream["avg_frame_rate"].as_str().unwrap_or("30/1"));

    let bitrate = format["bit_rate"]
        .as_str()
        .and_then(|b| b.parse::<u64>().ok());

    // Check for GoPro GPMF data stream
    let has_gpmf = json["streams"]
        .as_array()
        .map(|s| {
            s.iter().any(|st| {
                st["codec_tag_string"] == "GoPr"
                    || st["codec_name"].as_str() == Some("bin_data")
                    || st["tags"]["handler_name"]
                        .as_str()
                        .map(|h| h.contains("GoPro") || h.contains("GPS"))
                        .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    Ok(VideoProbeResult {
        path,
        duration,
        fps,
        width,
        height,
        codec,
        bitrate,
        has_gpmf,
    })
}

fn parse_fps(s: &str) -> f64 {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num = parts[0].parse::<f64>().unwrap_or(30.0);
        let den = parts[1].parse::<f64>().unwrap_or(1.0);
        if den != 0.0 { num / den } else { 30.0 }
    } else {
        s.parse::<f64>().unwrap_or(30.0)
    }
}

/// Generate a thumbnail frame from the video
#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    video_path: String,
    output_path: String,
    timestamp: f64,
) -> Result<String, String> {
    app.shell()
        .command("ffmpeg")
        .args([
            "-y",
            "-ss", &timestamp.to_string(),
            "-i", &video_path,
            "-vframes", "1",
            "-vf", "scale=480:-1",
            "-q:v", "2",
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffmpeg thumbnail failed: {e}"))?;

    Ok(output_path)
}

/// Generate a lower-res proxy for smooth preview playback
#[tauri::command]
pub async fn generate_proxy(
    app: tauri::AppHandle,
    video_path: String,
    output_path: String,
) -> Result<String, String> {
    app.shell()
        .command("ffmpeg")
        .args([
            "-y",
            "-i", &video_path,
            "-vf", "scale=1280:-2",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-an",
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffmpeg proxy failed: {e}"))?;

    Ok(output_path)
}

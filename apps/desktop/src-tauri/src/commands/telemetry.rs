use serde_json;
use tauri_plugin_shell::ShellExt;

/// Find the ffmpeg stream specifier for the GoPro GPMF/gpmd track.
/// Probes ALL streams (not just data) and matches by codec_tag_string or handler_name.
/// Returns the absolute stream specifier e.g. "0:3".
async fn find_gpmf_stream(app: &tauri::AppHandle, path: &str) -> String {
    let probe = app
        .shell()
        .command("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            path,
        ])
        .output()
        .await;

    if let Ok(out) = probe {
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
            if let Some(streams) = json["streams"].as_array() {
                for stream in streams {
                    let tag = stream["codec_tag_string"].as_str().unwrap_or("");
                    let codec = stream["codec_name"].as_str().unwrap_or("");
                    let handler = stream["tags"]["handler_name"].as_str().unwrap_or("");
                    if tag == "gpmd" || tag == "GoPr"
                        || codec == "bin_data"
                        || handler.contains("GoPro") || handler.contains("GPS")
                    {
                        if let Some(idx) = stream["index"].as_u64() {
                            return format!("0:{idx}");
                        }
                    }
                }
            }
        }
    }

    // Fallback: GPMF is almost always the first data stream on GoPro files
    "0:d:0".to_string()
}

/// Extract raw GPMF bytes from a GoPro MP4.
/// Writes to a temp file to avoid pipe-buffer deadlocks with large streams.
#[tauri::command]
pub async fn extract_gpmf_raw(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<u8>, String> {
    let stream = find_gpmf_stream(&app, &path).await;

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    // Try the detected stream and common fallbacks in order
    let candidates: Vec<String> = {
        let mut v = vec![stream.clone()];
        for s in &["0:d:0", "0:d:1", "0:3", "0:4"] {
            if *s != stream.as_str() {
                v.push(s.to_string());
            }
        }
        v
    };

    let mut last_stderr = String::new();

    for (i, candidate) in candidates.iter().enumerate() {
        let tmp = std::env::temp_dir().join(format!("velocity_gpmf_{ts}_{i}.bin"));
        let tmp_str = tmp.to_string_lossy().to_string();

        let result = app
            .shell()
            .command("ffmpeg")
            .args(["-y", "-i", &path, "-map", candidate, "-c", "copy", "-f", "rawvideo", &tmp_str])
            .output()
            .await;

        match result {
            Ok(out) => {
                last_stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if tmp.exists() {
                    let bytes = std::fs::read(&tmp)
                        .map_err(|e| format!("read temp file failed: {e}"))?;
                    let _ = std::fs::remove_file(&tmp);
                    if !bytes.is_empty() {
                        return Ok(bytes);
                    }
                }
            }
            Err(e) => {
                last_stderr = e.to_string();
            }
        }

        let _ = std::fs::remove_file(&tmp);
    }

    Err(format!(
        "No GPMF data found (tried: {}). ffmpeg: {}",
        candidates.join(", "),
        last_stderr.lines().last().unwrap_or("no output")
    ))
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

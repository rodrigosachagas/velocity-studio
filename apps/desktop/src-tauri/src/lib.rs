mod commands;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::video::probe_video,
            commands::video::generate_thumbnail,
            commands::video::generate_proxy,
            commands::telemetry::extract_gpmf_raw,
            commands::telemetry::extract_exif,
            commands::export::start_pipe_export,
            commands::export::pipe_frame_base64,
            commands::export::pipe_next_frame,
            commands::export::finish_pipe_export,
            commands::export::render_video,
            commands::export::cancel_render,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

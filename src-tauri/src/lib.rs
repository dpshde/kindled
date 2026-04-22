mod share;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            _app.handle().plugin(tauri_plugin_macos_haptics::init())?;

            #[cfg(target_os = "ios")]
            _app.handle().plugin(tauri_plugin_haptics::init())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            share::share_url,
            share::share_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

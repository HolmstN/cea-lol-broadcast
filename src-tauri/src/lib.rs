mod lcu;

use lcu::{LcuClient, LcuCredentials};

/// Try to discover and connect to the LCU WebSocket.
/// Returns `true` if the League client was found, `false` if it isn't running.
#[tauri::command]
async fn connect_lcu(app: tauri::AppHandle) -> Result<bool, String> {
    let Some(creds) = LcuCredentials::discover() else {
        return Ok(false);
    };

    LcuClient::new(app)
        .connect(creds)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![connect_lcu])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

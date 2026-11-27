mod discord;
mod oauth;
mod tags;

use tauri::ipc::{InvokeBody, Request};
use tags::{parse, Tags};

/// The UI sends the raw file bytes (works the same on desktop and mobile, no file paths needed).
#[tauri::command]
fn read_tags(request: Request<'_>) -> Result<Tags, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => parse(bytes),
        _ => Err("expected raw file bytes".into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init());
    builder
        .manage(discord::Discord::default())
        .invoke_handler(tauri::generate_handler![read_tags, discord::discord_activity, oauth::oauth, oauth::oauth_cancel, oauth::open_url])
        .run(tauri::generate_context!())
        .expect("error while running Lyre");
}

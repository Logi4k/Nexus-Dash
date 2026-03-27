use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize, Deserialize)]
struct AppData {
    data: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateStatus {
    supported: bool,
    configured: bool,
    current_version: String,
    available: bool,
    version: Option<String>,
    date: Option<String>,
    body: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateInstallResult {
    installed: bool,
    version: Option<String>,
    restart_required: bool,
}

fn updater_configured(app: &tauri::AppHandle) -> bool {
    app.config().plugins.0.contains_key("updater")
}

#[tauri::command]
fn read_data(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");

    if data_path.exists() {
        fs::read_to_string(&data_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<bool, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");
    fs::write(&data_path, data).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn export_data(app: tauri::AppHandle, export_path: String) -> Result<bool, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");

    if data_path.exists() {
        let content = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;
        fs::write(&export_path, content).map_err(|e| e.to_string())?;
    }

    Ok(true)
}

#[tauri::command]
async fn check_desktop_update(app: tauri::AppHandle) -> Result<DesktopUpdateStatus, String> {
    let current_version = app.package_info().version.to_string();

    #[cfg(desktop)]
    {
        if !updater_configured(&app) {
            return Ok(DesktopUpdateStatus {
                supported: true,
                configured: false,
                current_version,
                available: false,
                version: None,
                date: None,
                body: None,
                error: None,
            });
        }

        let updater = app.updater().map_err(|e| e.to_string())?;
        match updater.check().await {
            Ok(Some(update)) => Ok(DesktopUpdateStatus {
                supported: true,
                configured: true,
                current_version,
                available: true,
                version: Some(update.version.to_string()),
                date: update.date.map(|date| date.to_string()),
                body: update.body,
                error: None,
            }),
            Ok(None) => Ok(DesktopUpdateStatus {
                supported: true,
                configured: true,
                current_version,
                available: false,
                version: None,
                date: None,
                body: None,
                error: None,
            }),
            Err(error) => Ok(DesktopUpdateStatus {
                supported: true,
                configured: true,
                current_version,
                available: false,
                version: None,
                date: None,
                body: None,
                error: Some(error.to_string()),
            }),
        }
    }

    #[cfg(not(desktop))]
    {
        Ok(DesktopUpdateStatus {
            supported: false,
            configured: false,
            current_version,
            available: false,
            version: None,
            date: None,
            body: None,
            error: None,
        })
    }
}

#[tauri::command]
async fn install_desktop_update(app: tauri::AppHandle) -> Result<DesktopUpdateInstallResult, String> {
    #[cfg(desktop)]
    {
        if !updater_configured(&app) {
            return Err("Desktop updater is not configured for this build.".into());
        }

        let updater = app.updater().map_err(|e| e.to_string())?;
        let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
            return Ok(DesktopUpdateInstallResult {
                installed: false,
                version: None,
                restart_required: false,
            });
        };

        let version = update.version.to_string();
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;

        Ok(DesktopUpdateInstallResult {
            installed: true,
            version: Some(version),
            restart_required: true,
        })
    }

    #[cfg(not(desktop))]
    {
        Err("Desktop updates are only supported on desktop builds.".into())
    }
}

#[tauri::command]
fn request_app_restart(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        app.request_restart();
        Ok(())
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Desktop updates are only supported on desktop builds.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            if updater_configured(&app.handle().clone()) {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            read_data,
            save_data,
            export_data,
            check_desktop_update,
            install_desktop_update,
            request_app_restart
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

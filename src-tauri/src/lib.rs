use serde::Serialize;
use std::fs;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

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

#[cfg(desktop)]
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

    if !data_path.exists() {
        return Err("No data file found to export.".into());
    }

    let content = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;

    // Reject paths that escape the filesystem root or contain null bytes
    if export_path.contains('\0') {
        return Err("Invalid export path.".into());
    }

    // Canonicalise the parent directory and verify it stays within the user's home
    // directory to prevent path traversal attacks (e.g. ../../../etc/shadow).
    // We canonicalise the parent, not the file, because the export target may not
    // exist yet.
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let export_path_buf = std::path::PathBuf::from(&export_path);
    let parent = export_path_buf
        .parent()
        .ok_or_else(|| "Export path has no parent directory".to_string())?;

    // Resolve the parent directory; if it doesn't exist yet, fall back to the
    // raw path — the subsequent write will fail with a clear OS error.
    let canonical_parent = parent.canonicalize()
        .unwrap_or_else(|_| parent.to_path_buf());

    if !canonical_parent.starts_with(&home) {
        return Err("Export path must be within your home directory.".into());
    }

    fs::write(&export_path_buf, content).map_err(|e| e.to_string())?;
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
async fn install_desktop_update(_app: tauri::AppHandle) -> Result<DesktopUpdateInstallResult, String> {
    #[cfg(desktop)]
    {
        if !updater_configured(&_app) {
            return Err("Desktop updater is not configured for this build.".into());
        }

        let updater = _app.updater().map_err(|e| e.to_string())?;
        let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
            return Ok(DesktopUpdateInstallResult {
                installed: false,
                version: None,
                restart_required: false,
            });
        };

        let version = update.version.to_string();

        /* On Windows the updater plugin's `install` ends with `process::exit(0)` after spawning the
        NSIS installer, so `download_and_install` never returns and the Tauri IPC invoke is dropped —
        the UI surfaces a spurious "update failed" toast. Download first, return Ok, then install
        on a short delay so the response is delivered before the process exits. */
        #[cfg(windows)]
        {
            let bytes = update
                .download(|_, _| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            let update_for_install = update.clone();
            std::thread::Builder::new()
                .name("nexus-desktop-updater".into())
                .spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    if let Err(e) = update_for_install.install(bytes) {
                        eprintln!("[updater] install failed: {e}");
                    }
                })
                .map_err(|e| e.to_string())?;
            return Ok(DesktopUpdateInstallResult {
                installed: true,
                version: Some(version),
                restart_required: true,
            });
        }

        #[cfg(not(windows))]
        {
            update
                .download_and_install(|_, _| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            return Ok(DesktopUpdateInstallResult {
                installed: true,
                version: Some(version),
                restart_required: true,
            });
        }
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
        .setup(|_app| {
            #[cfg(desktop)]
            if updater_configured(&_app.handle()) {
                _app.handle()
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

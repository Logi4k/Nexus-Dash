use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct AppData {
    data: serde_json::Value,
}

#[tauri::command]
fn read_data(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");

    if data_path.exists() {
        fs::read_to_string(&data_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<bool, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");
    fs::write(&data_path, data).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn export_data(app: tauri::AppHandle, export_path: String) -> Result<bool, String> {
    // Validate: reject paths containing traversal components
    let export = Path::new(&export_path);
    if export.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid export path: path traversal not allowed".to_string());
    }
    // Validate: must be absolute
    if !export.is_absolute() {
        return Err("Invalid export path: must be an absolute path".to_string());
    }
    // Validate: parent directory must already exist
    let parent = export.parent().ok_or("Invalid export path: no parent directory")?;
    if !parent.exists() {
        return Err("Invalid export path: destination directory does not exist".to_string());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let data_path = data_dir.join("data.json");
    if data_path.exists() {
        let content = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;
        fs::write(export, content).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![read_data, save_data, export_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

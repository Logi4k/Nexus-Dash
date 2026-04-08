use std::{fs, path::Path};

fn emit_rerun_for_dir(path: &Path) {
    if !path.exists() {
        return;
    }

    println!("cargo:rerun-if-changed={}", path.display());

    if path.is_dir() {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            emit_rerun_for_dir(&entry.path());
        }
    }
}

fn main() {
    emit_rerun_for_dir(Path::new("../dist"));
    emit_rerun_for_dir(Path::new("../public"));
    tauri_build::build()
}

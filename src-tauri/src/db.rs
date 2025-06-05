use rusqlite::{params, Connection, Result};
use serde::Serialize;
use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Manager};

use std::path::Path;
use std::fs::File;
use plist::Value;
use base64::{engine::general_purpose, Engine as _};
use icns::IconFamily;

#[derive(Serialize)]
pub struct TrackedApps {
  pub id: i64,
  pub name: String,
  pub icon: Option<String>
}

#[derive(Serialize)]
pub struct AppUsage {
  pub name: String,
  pub total_seconds: i64
}

fn get_connection(app: &AppHandle) -> Result<Connection, String> {
  let db_path = app.path().app_data_dir()
    .map_err(|e| e.to_string())?
    .join("tracked_apps.db");

  if let Some(parent) = db_path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }

  let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
  // let conn = Connection::open("tracked_apps.db")?;

  // Create tracked_apps table
  conn.execute(
    "CREATE TABLE IF NOT EXISTS tracked_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT
    )",
    []
  ).map_err(|e| e.to_string())?;

  // Create app_usage table
  conn.execute(
    "CREATE TABLE IF NOT EXISTS app_usage (
      name TEXT PRIMARY KEY,
      total_seconds INTEGER NOT NULL DEFAULT 0
    )",
    []
  ).map_err(|e| e.to_string())?;

  Ok(conn)
}

// Get app icon
fn get_icon_base64(exe_path: &str) -> Option<String> {
  if !cfg!(target_os = "macos") {
    return None;
  }

  let path = Path::new(exe_path);
  let app_bundle_path = path.ancestors().find(|p| p.extension().map_or(false, |e| e == "app"))?;
  let info_plist_path = app_bundle_path.join("Contents/Info.plist");
  let plist_val = Value::from_file(&info_plist_path).ok()?;

  let icon_file_name = plist_val
    .as_dictionary()
    .and_then(|dict| dict.get("CFBundleIconFile"))
    .and_then(|val| val.as_string())?;

  let mut icon_path = app_bundle_path.join("Contents/Resources").join(icon_file_name);
  if icon_path.extension().is_none() {
    icon_path.set_extension("icns");
  }

  let mut icns_file = File::open(&icon_path).ok()?;
  let icon_family = IconFamily::read(&mut icns_file).ok()?;

  let best_icon = icon_family.elements
    .iter()
    .max_by_key(|icon| icon.icon_type().map_or(0, |t| t.pixel_width()))?;

  Some(general_purpose::STANDARD.encode(&best_icon.data))

}

// Add app to tracked_apps table
#[tauri::command]
pub fn add_app(app: AppHandle, name: String, exe_path: String) -> Result<(), String> {
  let conn = get_connection(&app)?;
  let icon_base64 = get_icon_base64(&exe_path);

  conn.execute(
    "INSERT INTO tracked_apps (name, icon) VALUES (?1, ?2)
    ON CONFLICT(name) DO UPDATE SET icon=excluded.icon",
    params![name, icon_base64],
  ).map_err(|e| e.to_string())?;

  Ok(())
}

// Remove app from tracked_apps
#[tauri::command]
pub fn remove_app(app: AppHandle, name: String, delete_usage: bool) -> Result<(), String> {
  let mut conn = get_connection(&app)?;
  let tx = conn.transaction().map_err(|e| e.to_string())?;

  tx.execute("DELETE FROM tracked_apps WHERE name = ?1", params![name])
    .map_err(|e| e.to_string())?;

  if delete_usage {
    tx.execute("DELETE FROM app_usage WHERE name = ?1", params![name])
      .map_err(|e| e.to_string())?;
  }

  tx.commit().map_err(|e| e.to_string())?;

  Ok(())
}

// Get the apps in the tracked_app table
#[tauri::command]
pub fn get_tracked_apps(app: AppHandle) -> Result<Vec<TrackedApps>, String> {
  let conn = get_connection(&app)?;
  let mut stmt = conn.prepare("SELECT id, name, icon FROM tracked_apps").map_err(|e| e.to_string())?;

  let apps_iter = stmt.query_map([], |row| {
    Ok(TrackedApps {
      id: row.get(0)?,
      name: row.get(1)?,
      icon: row.get(2)?
    })
  }).map_err(|e| e.to_string())?;

  let mut apps = Vec::new();
  for app_result in apps_iter {
    apps.push(app_result.map_err(|e| e.to_string())?);
  }

  Ok(apps)
}

// Get the names of apps being tracked
pub fn get_tracked_app_names(app: &AppHandle) -> Result<Vec<String>, String> {
  let conn = get_connection(app)?;
  let mut stmt = conn.prepare("SELECT name FROM tracked_apps").map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

  let mut names = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let name: String = row.get(0).map_err(|e| e.to_string())?;
    names.push(name)
  }

  Ok(names)
}

// Track/insert app usage time
#[tauri::command]
pub fn increment_usage_for_running_apps(app: AppHandle) -> Result<(), String> {
  // Get names of tracked apps
  let names = get_tracked_app_names(&app)?;

  // If there are no tracked apps return
  if names.is_empty() {
    return Ok(());
  }

  // Fetch running processes
  let mut sys = System::new_all();
  sys.refresh_processes(ProcessesToUpdate::All, true);

  let running_names: std::collections::HashSet<String> = sys.processes().iter()
    .map(|(_, process)| process.name().to_string_lossy().into_owned()).collect();

  // db connect
  let mut conn = get_connection(&app)?;

  // Add time
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  for name in names {
    if running_names.contains(&name) {
      tx.execute(
        "INSERT INTO app_usage (name, total_seconds) VALUES (?1, 1)
          ON CONFLICT(name) DO UPDATE SET total_seconds = total_seconds + 1",
          params![name]
      ).map_err(|e| e.to_string())?;
    }
  }

  tx.commit().map_err(|e| e.to_string())?;

  Ok(())


}

// Get app usage
#[tauri::command]
pub fn get_app_usage(app: AppHandle) -> Result<Vec<AppUsage>, String> {
  let conn = get_connection(&app)?;
  let mut stmt = conn.prepare("SELECT name, total_seconds FROM app_usage").map_err(|e| e.to_string())?;

  let usage_iter = stmt
    .query_map([], |row| {
      Ok(AppUsage {
        name: row.get(0)?,
        total_seconds: row.get(1)?
      })
    }).map_err(|e| e.to_string())?;

  let mut usage = Vec::new();
  for u in usage_iter {
    usage.push(u.map_err(|e| e.to_string())?);
  }

  Ok(usage)
}
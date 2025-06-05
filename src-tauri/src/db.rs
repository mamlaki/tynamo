use rusqlite::{params, Connection, Result};
use serde::Serialize;
use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct TrackedApps {
  pub id: i64,
  pub name: String
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
      name TEXT NOT NULL
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

// Add app to tracked_apps table
#[tauri::command]
pub fn add_app(app: AppHandle, name: String) -> Result<(), String> {
  let conn = get_connection(&app)?;

  conn.execute(
    "INSERT INTO tracked_apps (name) VALUES (?1)",
    params![name],
  ).map_err(|e| e.to_string())?;

  Ok(())
}

// Get the apps in the tracked_app table
#[tauri::command]
pub fn get_tracked_apps(app: AppHandle) -> Result<Vec<TrackedApps>, String> {
  let conn = get_connection(&app)?;
  let mut stmt = conn.prepare("SELECT id, name FROM tracked_apps").map_err(|e| e.to_string())?;

  let apps_iter = stmt.query_map([], |row| {
    Ok(TrackedApps {
      id: row.get(0)?,
      name: row.get(1)?
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
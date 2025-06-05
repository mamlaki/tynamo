use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Serialize)]
pub struct TrackedApps {
  pub id: i64,
  pub name: String
}

fn get_connection() -> Result<Connection> {
  let conn = Connection::open("tracked_apps.db")?;

  conn.execute(
    "CREATE TABLE IF NOT EXISTS tracked_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )",
    []
  )?;

  Ok(conn)
}

#[tauri::command]
pub fn add_app(name: String) -> Result<(), String> {
  let conn = get_connection().map_err(|e| e.to_string())?;

  conn.execute(
    "INSERT INTO tracked_apps (name) VALUES (?1)",
    params![name],
  ).map_err(|e| e.to_string())?;

  Ok(())
}

#[tauri::command]
pub fn get_tracked_apps() -> Result<Vec<TrackedApps>, String> {
  let conn = get_connection().map_err(|e| e.to_string())?;
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

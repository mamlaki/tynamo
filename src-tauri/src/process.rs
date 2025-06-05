use serde::Serialize;
use sysinfo::{ProcessesToUpdate, System};
use tauri::Result;

#[derive(Serialize, Clone)]
pub struct ProcessInfo {
  pub pid: u32,
  pub name: String,
  pub exe_path: String
}

#[tauri::command]
pub fn list_processes() -> Result<Vec<ProcessInfo>> {
  let mut sys = System::new_all();

  sys.refresh_processes(ProcessesToUpdate::All, true);

  let processes: Vec<ProcessInfo> = sys.processes().iter()
    .filter_map(|(pid, process)| {
      process.exe().and_then(|path| path.to_str())
        .map(|exe_path| ProcessInfo {
          pid: pid.as_u32(),
          name: process.name().to_string_lossy().into_owned(),
          exe_path: exe_path.to_string()
        })
    }).collect();

  Ok(processes)
}

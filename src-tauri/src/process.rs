use serde::Serialize;
use sysinfo::{System, ProcessesToUpdate};
use tauri::Result;

#[derive(Serialize)]
pub struct ProcessInfo {
  pub pid: u32,
  pub name: String
}

#[tauri::command]
pub fn list_processes() -> Result<Vec<ProcessInfo>> {
  let mut sys = System::new_all();

  sys.refresh_processes(ProcessesToUpdate::All, true);

  let processes: Vec<ProcessInfo> = sys.processes().iter()
    .map(|(pid_sysinfo, process)| {
      let pid_u32 = pid_sysinfo.as_u32();

      let name_string = process.name().to_string_lossy().into_owned();
      ProcessInfo { pid: pid_u32, name: name_string }
    }).collect();

  Ok(processes)
}

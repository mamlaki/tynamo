use crossbeam_channel::unbounded;
use std::thread;
use std::time::Duration;
use tauri::RunEvent;

mod process;
use process::list_processes;

mod db;
use db::{add_app, remove_app, get_tracked_apps, get_app_usage, increment_usage_for_running_apps};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create channel
    let (tx, rx) = unbounded::<()>();
    let tx_for_exit_signal = tx.clone();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // New thread which polls every 60sec
            thread::spawn(move || {
                loop {
                    // Shutdown signal?
                    match rx.try_recv() {
                        Ok(_) | Err(crossbeam_channel::TryRecvError::Disconnected) => {
                            println!("Worker thread shutting down.");
                            break;
                        }
                        Err(crossbeam_channel::TryRecvError::Empty) => {

                        }
                    }

                    // Increment usage
                    if let Err(e) = increment_usage_for_running_apps(app_handle.clone()) {
                        eprintln!("Error incrementing usage: {:?}", e);
                    }

                    thread::sleep(Duration::from_secs(1));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_processes,
            add_app,
            remove_app,
            get_tracked_apps,
            get_app_usage,
            increment_usage_for_running_apps
        ]);

        let app = builder
            .build(tauri::generate_context!())
            .expect("error building tauri application");

        app.run(move |_app_handle, event| {
            match event {
                RunEvent::ExitRequested { .. } => {
                    println!("App exit requested. Send shutdown signal.");
                    let _ = tx_for_exit_signal.send(());
                } 
                RunEvent::Exit => {
                    println!("App exiting.");
                }
                _ => {}
            }
        });
}
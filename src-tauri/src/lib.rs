mod audit;
mod commands;
mod db;
mod models;

use commands::{analytics, audit as audit_cmd, calendar, dashboard, export, items, restock, settings, tasks, undo, whats_next};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.handle().plugin(tauri_plugin_dialog::init())?;

            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = db::init(&handle)
                    .await
                    .expect("failed to initialize database");
                handle.manage(pool);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            items::get_items,
            items::get_item,
            items::create_item,
            items::update_item,
            items::remove_item,
            items::bulk_create_items,
            tasks::get_tasks,
            tasks::create_task,
            tasks::update_task,
            tasks::remove_task,
            tasks::complete_task,

            dashboard::get_daily_dashboard,
            audit_cmd::get_audit_log,
            calendar::get_calendar,
            restock::get_restock_candidates,
            restock::bulk_restock,
            restock::hide_from_restock,
            analytics::get_analytics,
            settings::get_setting,
            settings::set_setting,
            export::export_audit_csv,
            undo::get_undo,
            undo::execute_undo,
            undo::push_undo,
            whats_next::get_whats_next,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

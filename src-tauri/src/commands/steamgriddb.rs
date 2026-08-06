use crate::services::steamgriddb::{self, CoverOption};

#[tauri::command]
pub async fn search_steamgriddb_covers(
    query: String,
    api_key: String,
) -> Result<Vec<CoverOption>, String> {
    steamgriddb::search_covers(query, api_key).await
}

#[tauri::command]
pub async fn steamgriddb_cover_for_steam_appid(
    appid: String,
    api_key: String,
) -> Result<Option<String>, String> {
    steamgriddb::cover_for_steam_appid(appid, api_key).await
}

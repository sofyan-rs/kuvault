use crate::services::steam_api::{self, OwnedGamePlaytime};

#[tauri::command]
pub async fn resolve_steam_vanity_url(
    api_key: String,
    vanity: String,
) -> Result<Option<String>, String> {
    steam_api::resolve_vanity_url(api_key, vanity).await
}

#[tauri::command]
pub async fn get_steam_owned_playtimes(
    api_key: String,
    steam_id: String,
) -> Result<Vec<OwnedGamePlaytime>, String> {
    steam_api::get_owned_playtimes(api_key, steam_id).await
}

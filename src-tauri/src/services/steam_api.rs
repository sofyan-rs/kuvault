use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct OwnedGamePlaytime {
    pub appid: String,
    pub playtime_minutes: u64,
}

#[derive(Deserialize)]
struct OwnedGamesResponse {
    response: OwnedGamesInner,
}

#[derive(Deserialize, Default)]
struct OwnedGamesInner {
    #[serde(default)]
    games: Vec<OwnedGame>,
}

#[derive(Deserialize)]
struct OwnedGame {
    appid: u64,
    playtime_forever: u64,
}

#[derive(Deserialize)]
struct ResolveVanityResponse {
    response: ResolveVanityInner,
}

#[derive(Deserialize)]
struct ResolveVanityInner {
    success: u32,
    #[serde(default)]
    steamid: Option<String>,
}

pub async fn resolve_vanity_url(api_key: String, vanity: String) -> Result<Option<String>, String> {
    let url = format!(
        "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key={}&vanityurl={}",
        api_key, vanity
    );

    let client = crate::services::http::client();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    let Ok(parsed) = response.json::<ResolveVanityResponse>().await else {
        return Ok(None);
    };

    if parsed.response.success != 1 {
        return Ok(None);
    }
    Ok(parsed.response.steamid)
}

pub async fn get_owned_playtimes(
    api_key: String,
    steam_id: String,
) -> Result<Vec<OwnedGamePlaytime>, String> {
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&include_appinfo=false&include_played_free_games=true&format=json",
        api_key, steam_id
    );

    let client = crate::services::http::client();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    let Ok(parsed) = response.json::<OwnedGamesResponse>().await else {
        return Ok(Vec::new());
    };

    Ok(parsed
        .response
        .games
        .into_iter()
        .map(|g| OwnedGamePlaytime {
            appid: g.appid.to_string(),
            playtime_minutes: g.playtime_forever,
        })
        .collect())
}

use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://www.steamgriddb.com/api/v2";

#[derive(Serialize)]
pub struct CoverOption {
    pub url: String,
    pub thumb_url: String,
}

#[derive(Deserialize)]
struct SearchResponse {
    data: Vec<SearchResult>,
}

#[derive(Deserialize)]
struct SearchResult {
    id: u64,
}

#[derive(Deserialize)]
struct GridsResponse {
    data: Vec<GridResult>,
}

#[derive(Deserialize)]
struct GridResult {
    url: String,
    thumb: String,
}

pub async fn cover_for_steam_appid(appid: String, api_key: String) -> Result<Option<String>, String> {
    let client = crate::services::http::client();
    let auth = format!("Bearer {}", api_key);

    let grids_url = format!("{}/grids/steam/{}", BASE_URL, appid);
    let response = client
        .get(&grids_url)
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let Ok(grids) = response.json::<GridsResponse>().await else {
        return Ok(None);
    };

    // Return the thumb, not the full grid image — this is stored as-is in the games table and
    // only ever displayed at card/panel size, so there's no reason to hold the full-res bitmap.
    Ok(grids.data.into_iter().next().map(|g| g.thumb))
}

pub async fn search_covers(query: String, api_key: String) -> Result<Vec<CoverOption>, String> {
    let client = crate::services::http::client();
    let auth = format!("Bearer {}", api_key);

    let search_url = format!(
        "{}/search/autocomplete/{}",
        BASE_URL,
        urlencoding::encode(&query)
    );
    let search: SearchResponse = client
        .get(&search_url)
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let Some(first) = search.data.first() else {
        return Ok(Vec::new());
    };

    let grids_url = format!("{}/grids/game/{}", BASE_URL, first.id);
    let grids: GridsResponse = client
        .get(&grids_url)
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(grids
        .data
        .into_iter()
        .map(|g| CoverOption {
            url: g.url,
            thumb_url: g.thumb,
        })
        .collect())
}

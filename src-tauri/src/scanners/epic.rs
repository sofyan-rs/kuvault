use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

use super::ScannedGame;

#[derive(Deserialize)]
struct EpicManifest {
    #[serde(rename = "DisplayName")]
    display_name: String,
    #[serde(rename = "InstallLocation")]
    install_location: String,
    #[serde(rename = "LaunchExecutable")]
    launch_executable: String,
    #[serde(rename = "CatalogItemId")]
    catalog_item_id: String,
}

fn manifests_dir() -> Option<PathBuf> {
    let program_data = std::env::var("PROGRAMDATA").ok()?;
    Some(
        PathBuf::from(program_data)
            .join("Epic")
            .join("EpicGamesLauncher")
            .join("Data")
            .join("Manifests"),
    )
}

pub fn scan() -> Vec<ScannedGame> {
    let Some(dir) = manifests_dir() else {
        return Vec::new();
    };

    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let mut games = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let is_item = path.extension().and_then(|ext| ext.to_str()) == Some("item");
        if !is_item {
            continue;
        }

        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };

        let Ok(manifest) = serde_json::from_str::<EpicManifest>(&text) else {
            continue;
        };

        let executable_path = PathBuf::from(&manifest.install_location)
            .join(&manifest.launch_executable)
            .to_string_lossy()
            .to_string();

        games.push(ScannedGame {
            name: manifest.display_name,
            platform: "epic".to_string(),
            executable_path,
            install_dir: manifest.install_location,
            source_id: manifest.catalog_item_id,
        });
    }

    games
}

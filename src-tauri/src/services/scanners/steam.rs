use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use super::ScannedGame;

fn steam_install_path() -> Option<PathBuf> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            return Some(PathBuf::from(path));
        }
    }

    for candidate in [
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
    ] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

fn is_non_game_entry(name: &str) -> bool {
    const BLOCKLIST: [&str; 4] = [
        "Steamworks Common Redistributables",
        "Steam Linux Runtime",
        "Proton",
        "Redistributables",
    ];
    BLOCKLIST
        .iter()
        .any(|blocked| name.eq_ignore_ascii_case(blocked) || name.contains(blocked))
}

fn vdf_value(text: &str, key: &str) -> Option<String> {
    let pattern = format!(r#""{}"\s*"([^"]*)""#, regex::escape(key));
    Regex::new(&pattern)
        .ok()?
        .captures(text)
        .map(|caps| caps[1].to_string())
}

fn library_paths(steam_path: &Path) -> Vec<PathBuf> {
    let mut libraries: HashSet<PathBuf> = HashSet::new();
    libraries.insert(steam_path.to_path_buf());

    let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
    if let Ok(text) = fs::read_to_string(&vdf_path) {
        if let Ok(path_re) = Regex::new(r#""path"\s*"([^"]*)""#) {
            for caps in path_re.captures_iter(&text) {
                let raw = caps[1].replace("\\\\", "\\");
                libraries.insert(PathBuf::from(raw));
            }
        }
    }

    libraries.into_iter().collect()
}

pub fn scan() -> Vec<ScannedGame> {
    let Some(steam_path) = steam_install_path() else {
        return Vec::new();
    };

    let mut games = Vec::new();

    for library in library_paths(&steam_path) {
        let steamapps_dir = library.join("steamapps");
        let Ok(entries) = fs::read_dir(&steamapps_dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let is_manifest = path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("appmanifest_") && name.ends_with(".acf"));

            if !is_manifest {
                continue;
            }

            let Ok(text) = fs::read_to_string(&path) else {
                continue;
            };

            let (Some(appid), Some(title), Some(installdir)) = (
                vdf_value(&text, "appid"),
                vdf_value(&text, "name"),
                vdf_value(&text, "installdir"),
            ) else {
                continue;
            };

            if is_non_game_entry(&title) {
                continue;
            }

            let install_dir = steamapps_dir
                .join("common")
                .join(&installdir)
                .to_string_lossy()
                .to_string();

            games.push(ScannedGame {
                title,
                platform: "steam".to_string(),
                executable_path: format!("steam://rungameid/{}", appid),
                install_dir,
                source_id: appid,
            });
        }
    }

    games
}

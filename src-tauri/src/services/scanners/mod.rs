pub mod epic;
pub mod steam;

use serde::Serialize;

#[derive(Serialize)]
pub struct ScannedGame {
    pub name: String,
    pub platform: String,
    pub executable_path: String,
    pub install_dir: String,
    pub source_id: String,
}

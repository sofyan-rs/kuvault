use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Shared client: reqwest::Client owns a connection pool, building a new one per
/// call throws away keep-alive and re-does TLS setup on every request.
pub fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!("KuVault/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build shared reqwest client")
    })
}

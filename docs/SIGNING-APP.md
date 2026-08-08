# Signing OTA updates

KuVault's auto-updater (`tauri-plugin-updater`) verifies every downloaded update against a
minisign keypair before installing it. This doc covers generating that keypair and wiring it
into CI. Do this once; only redo it if the key is lost or rotated.

## 1. Generate the keypair

From the repo root:

```powershell
npx @tauri-apps/cli signer generate -w "$env:USERPROFILE\.tauri\kuvault_updater.key"
```

- You'll be prompted for a password — set one and save it in your password manager. An empty
  password is accepted but means anyone who gets the key file alone can sign malicious updates.
- Produces two files under `%USERPROFILE%\.tauri\`:
  - `kuvault_updater.key` — **private key. Never commit this. Never paste it anywhere but the
    GitHub secret below.**
  - `kuvault_updater.key.pub` — public key, safe to commit.

**Back up `kuvault_updater.key` somewhere offline (password manager attachment, encrypted
drive).** Losing it is unrecoverable: every installed client hard-verifies updates against the
pubkey already baked into `tauri.conf.json`. If the key is lost, the only fix is generating a new
pair and shipping it in a release signed with the *old* key — existing users can't be updated
past that point through OTA alone.

## 2. Public key → `tauri.conf.json`

Copy the single base64 line from `kuvault_updater.key.pub` into
`src-tauri/tauri.conf.json` → `plugins.updater.pubkey`. Already done for the current key — only
repeat this if the key is ever rotated.

## 3. Private key → GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `kuvault_updater.key` (including the `untrusted comment:` header line) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password chosen in step 1 |

`.github/workflows/release.yml` reads both into the `tauri-action` step's `env`, and
`bundle.createUpdaterArtifacts: true` in `tauri.conf.json` makes `tauri build` sign the NSIS
installer with them, producing a `.sig` alongside the setup exe plus `latest.json` in the
release (via `includeUpdaterJson: true`).

## Local builds

Local `tauri build` also needs the signing key present once `createUpdaterArtifacts: true` is
set, or the build fails with "a public key has been found, but no private key":

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\kuvault_updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<password>"
npm run tauri build
```

Confirm `KuVault_<version>_x64-setup.exe` **and** its `.sig` land in
`src-tauri/target/release/bundle/nsis/`.

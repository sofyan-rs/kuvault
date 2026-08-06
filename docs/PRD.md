# Game Library Manager — PRD

## Problem

Games live scattered: Steam, Epic, standalone installers, emulator ROMs. No single place to browse, launch, or track them. Windows desktop app to unify this into one minimal-but-polished library.

## Goals

- One library view for all games regardless of source (Steam, Epic, manual installer, emulator).
- Auto-detect installed Steam and Epic games; manual add for everything else.
- Fetch cover art from [SteamGridDB](https://www.steamgriddb.com/).
- Launch games from the app; track playtime locally.
- Organize via custom tags/categories, favorites, search, sort, grid/list view.
- Minimal, clean UI (Tailwind + shadcn/ui), simple codebase (feature-based, junior-dev readable).

## Non-goals (v1)

- No achievements/social features (no Steam friends, no achievement sync).
- No ROM folder auto-scanning for emulators — manual entry only.
- No cloud sync / multi-device — fully local, single machine.
- No other platform launchers beyond Steam + Epic (GOG, Battle.net, etc. — future).
- No auto-uninstall / game file management beyond launching.

## Users

Single local user managing their own PC. No multi-user/auth.

## Core user flows

1. **Browse library** — grid or list view of all games, search by name, filter by platform/tag/installed/favorite, sort by name/recent/playtime.
2. **Add game manually** — name, executable path (native file picker), launch args (optional, for emulator+ROM case), platform tag (`manual`/`emulator`), custom category tags, description (optional), pick cover from SteamGridDB search or skip.
3. **Scan Steam** — reads local Steam install (`libraryfolders.vdf` + `appmanifest_*.acf`), lists newly found installed games, user confirms which to import.
4. **Scan Epic** — reads Epic manifest files (`%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests\*.item`), same confirm-import flow.
5. **View game detail** — cover, title, platform badge, install status, playtime, description, tags, Play / Edit / Remove actions.
6. **Launch + track playtime** — Play spawns the executable; app times the process from spawn to exit and accumulates playtime in the DB; updates "last played".
7. **Settings** — paste SteamGridDB API key (stored locally), used for all cover art lookups.

## Data model (SQLite)

`games` table:

| column | type | notes |
|---|---|---|
| id | integer PK | |
| name | text | |
| platform | text | `steam` \| `epic` \| `manual` \| `emulator` |
| executable_path | text | |
| launch_args | text, nullable | e.g. ROM path for emulators |
| install_dir | text, nullable | |
| source_id | text, nullable | Steam appid / Epic catalog id, for re-scan dedup |
| cover_url | text, nullable | SteamGridDB image URL |
| genres | text, nullable | comma-separated free-text tags (custom categories) |
| description | text, nullable | |
| playtime_seconds | integer, default 0 | |
| last_played_at | text, nullable | ISO timestamp |
| is_favorite | integer (bool), default 0 | |
| installed | integer (bool), default 1 | |
| created_at | text | ISO timestamp |

`settings` table: simple key-value (`steamgriddb_api_key`, etc.)

## Tech stack

- Tauri v2 (Rust backend) + React Router v7 (SPA mode) frontend.
- Tailwind CSS v4 + shadcn/ui (Base UI) for styling/components.
- SQLite via `tauri-plugin-sql` for local storage.
- `reqwest` in Rust for SteamGridDB API calls (key never touches frontend network layer).
- Bun as package manager/runner.

## Architecture

Feature-based folder structure under `app/features/*` (library, game-detail, add-game, scan, settings), each with `components/` and `hooks/`. Simple, one-component-per-file, no premature abstraction (no repository pattern, no state-management library) — matches existing starter template conventions (`app/lib/tauri.ts` tracked-invoke wrapper, shadcn primitives in `app/components/ui/`).

Rust backend organized as flat feature modules in `src-tauri/src/`: `db.rs`, `scanners/steam.rs`, `scanners/epic.rs`, `steamgriddb.rs`, `launcher.rs`, commands registered in `lib.rs`.

## v1 scope checklist

- [ ] SQLite data layer + CRUD commands
- [ ] Library grid/list UI
- [ ] Manual add game
- [ ] SteamGridDB cover search/select
- [ ] Steam auto-scan + import
- [ ] Epic auto-scan + import
- [ ] Launch + playtime tracking
- [ ] Game detail page
- [ ] Settings (API key)

## Future (post-v1)

- Achievements (Steam Web API), ROM folder scanning, GOG/Battle.net scanners, cloud backup/sync.

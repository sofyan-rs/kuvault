# Progress

See [PRD.md](./PRD.md) for full spec.

## Milestones

- [x] Docs: PRD + progress tracker
- [x] Data layer: SQLite (`tauri-plugin-sql`), `games`/`settings` tables, CRUD commands
- [x] Library UI: grid/list view, sidebar filters (All Games/Favorites), search/sort
- [x] Add game: manual form + file picker
- [x] SteamGridDB: settings API key + cover search/select
- [x] Steam scanner: detect + import installed games (registry + libraryfolders.vdf + appmanifest parsing, launches via steam:// URI)
- [x] Epic scanner: detect + import installed games (manifest JSON parsing)
- [x] Launcher: spawn game, track playtime, update last-played
- [x] Game detail page: cover, metadata, description, actions (play/favorite/delete)
- [x] Theme: default dark, system/light/dark toggle in settings
- [ ] Polish pass: empty states, loading states, error toasts (sonner installed, not yet wired everywhere)

## Log

- 2026-08-06 — Repo pivoted from generic Tauri starter to game library manager. Wrote initial PRD.
- 2026-08-06 — Full v1 feature set implemented: SQLite data layer, library grid/list, manual add-game with SteamGridDB cover picker, Steam/Epic auto-scan, launcher with playtime tracking, game detail page, settings (theme + API key). All typechecks and `cargo check` pass. Not yet run end-to-end in the live app — next step is manual verification via `bun run tauri dev`.

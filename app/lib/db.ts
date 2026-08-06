import Database from "@tauri-apps/plugin-sql"

import type { Game, NewGame } from "./db-types"

const DB_URL = "sqlite:kuvault.db"

let dbPromise: Promise<Database> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL)
  }
  return dbPromise
}

export async function listGames() {
  const db = await getDb()
  return db.select<Game[]>("SELECT * FROM games ORDER BY name COLLATE NOCASE")
}

export async function getGame(id: number) {
  const db = await getDb()
  const rows = await db.select<Game[]>("SELECT * FROM games WHERE id = $1", [id])
  return rows[0] ?? null
}

export async function addGame(game: NewGame) {
  const db = await getDb()
  const result = await db.execute(
    `INSERT INTO games (name, platform, executable_path, launch_args, install_dir, source_id, cover_url, genres, description, installed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      game.name,
      game.platform,
      game.executable_path,
      game.launch_args ?? null,
      game.install_dir ?? null,
      game.source_id ?? null,
      game.cover_url ?? null,
      game.genres ?? null,
      game.description ?? null,
      game.installed ?? 1,
    ],
  )
  return result.lastInsertId
}

export async function updateGame(id: number, patch: Partial<NewGame>) {
  const fields = Object.keys(patch)
  if (fields.length === 0) return

  const db = await getDb()
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(", ")
  const values = fields.map((field) => patch[field as keyof NewGame])

  await db.execute(`UPDATE games SET ${setClause} WHERE id = $${fields.length + 1}`, [
    ...values,
    id,
  ])
}

export async function deleteGame(id: number) {
  const db = await getDb()
  await db.execute("DELETE FROM games WHERE id = $1", [id])
}

export async function toggleFavorite(id: number, isFavorite: boolean) {
  const db = await getDb()
  await db.execute("UPDATE games SET is_favorite = $1 WHERE id = $2", [isFavorite ? 1 : 0, id])
}

export async function setPlaytime(id: number, seconds: number) {
  const db = await getDb()
  await db.execute("UPDATE games SET playtime_seconds = $1 WHERE id = $2", [seconds, id])
}

export async function addPlaytime(id: number, seconds: number) {
  const db = await getDb()
  await db.execute(
    "UPDATE games SET playtime_seconds = playtime_seconds + $1, last_played_at = $2 WHERE id = $3",
    [seconds, new Date().toISOString(), id],
  )
}

export async function getSetting(key: string) {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  )
  return rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value],
  )
}

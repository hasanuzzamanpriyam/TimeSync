import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:timesync.db");
  return db;
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export { db };

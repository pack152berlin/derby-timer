import { Database } from "bun:sqlite";

let db: Database | null = null;
const dbPath = Bun.env.DERBY_DB_PATH ?? "derby.db";

export function getDb(): Database {
  if (!db) {
    db = new Database(dbPath);
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

import { getDb } from "../connection";

const db = getDb();

export function up(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_planning_settings (
      event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      lane_count INTEGER NOT NULL,
      rounds INTEGER NOT NULL DEFAULT 1,
      lookahead INTEGER NOT NULL DEFAULT 3 CHECK (lookahead IN (2, 3)),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS round_racer_rosters (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      racer_id TEXT NOT NULL REFERENCES racers(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, round, racer_id)
    )
  `);

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_round_racer_rosters_event_round ON round_racer_rosters(event_id, round)"
  );
}

export function down(): void {
  db.exec("DROP TABLE IF EXISTS round_racer_rosters");
  db.exec("DROP TABLE IF EXISTS event_planning_settings");
}

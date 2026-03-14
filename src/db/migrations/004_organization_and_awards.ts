import { getDb } from "../connection";

const db = getDb();

export function up(): void {
  try {
    db.exec("ALTER TABLE events ADD COLUMN organization TEXT DEFAULT 'Cub Scouts of America'");
  } catch {
    // Column may already exist on partially migrated local databases.
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_awards (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      allow_second INTEGER NOT NULL DEFAULT 0,
      allow_third INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_event_awards_event ON event_awards(event_id)");

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_award_winners (
      id TEXT PRIMARY KEY,
      award_id TEXT NOT NULL REFERENCES event_awards(id) ON DELETE CASCADE,
      racer_id TEXT NOT NULL REFERENCES racers(id) ON DELETE CASCADE,
      place INTEGER NOT NULL DEFAULT 1 CHECK (place >= 1 AND place <= 3),
      UNIQUE(award_id, place)
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_event_award_winners_award ON event_award_winners(award_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_event_award_winners_racer ON event_award_winners(racer_id)");
}

export function down(): void {
  try {
    db.exec("DROP TABLE IF EXISTS event_award_winners");
    db.exec("DROP TABLE IF EXISTS event_awards");
    db.exec("ALTER TABLE events DROP COLUMN organization");
  } catch {
    // SQLite builds without DROP COLUMN support can keep the nullable column.
  }
}

import { getDb } from "../connection";

const db = getDb();

export function up(): void {
  try {
    db.exec("ALTER TABLE racers ADD COLUMN car_photo_filename TEXT");
  } catch {
    // Column may already exist on partially migrated local databases.
  }

  try {
    db.exec("ALTER TABLE racers ADD COLUMN car_photo_mime_type TEXT");
  } catch {
    // Column may already exist on partially migrated local databases.
  }

  try {
    db.exec("ALTER TABLE racers ADD COLUMN car_photo_bytes INTEGER");
  } catch {
    // Column may already exist on partially migrated local databases.
  }
}

export function down(): void {
  try {
    db.exec("ALTER TABLE racers DROP COLUMN car_photo_bytes");
    db.exec("ALTER TABLE racers DROP COLUMN car_photo_mime_type");
    db.exec("ALTER TABLE racers DROP COLUMN car_photo_filename");
  } catch {
    // SQLite builds without DROP COLUMN support can keep these nullable columns.
  }
}

import { getDb } from "../connection";
import type { Database } from "bun:sqlite";

export interface Racer {
  id: string;
  event_id: string;
  name: string;
  den: string | null;
  car_number: string;
  weight_ok: number;
  inspected_at: string | null;
  car_photo_filename: string | null;
  car_photo_mime_type: string | null;
  car_photo_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRacerInput {
  event_id: string;
  name: string;
  den?: string;
  car_number: string;
}

export interface UpdateRacerInput {
  name?: string;
  den?: string | null;
  car_number?: string;
  weight_ok?: boolean;
  inspected_at?: string | null;
  car_photo_filename?: string | null;
  car_photo_mime_type?: string | null;
  car_photo_bytes?: number | null;
}

export class RacerRepository {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  create(input: CreateRacerInput): Racer {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    this.db.run(
      `INSERT INTO racers (
         id,
         event_id,
         name,
         den,
         car_number,
         weight_ok,
         inspected_at,
         car_photo_filename,
         car_photo_mime_type,
         car_photo_bytes,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.event_id,
        input.name,
        input.den ?? null,
        input.car_number,
        0,
        null,
        null,
        null,
        null,
        now,
        now,
      ]
    );

    return {
      id,
      event_id: input.event_id,
      name: input.name,
      den: input.den ?? null,
      car_number: input.car_number,
      weight_ok: 0,
      inspected_at: null,
      car_photo_filename: null,
      car_photo_mime_type: null,
      car_photo_bytes: null,
      created_at: now,
      updated_at: now
    };
  }

  findById(id: string): Racer | null {
    const row = this.db.query(
      "SELECT * FROM racers WHERE id = ?"
    ).get(id) as Racer | undefined;
    return row ?? null;
  }

  findByEvent(eventId: string): Racer[] {
    return this.db.query(
      "SELECT * FROM racers WHERE event_id = ? ORDER BY CAST(car_number AS INTEGER)"
    ).all(eventId) as Racer[];
  }

  findByCarNumber(eventId: string, carNumber: string): Racer | null {
    const row = this.db.query(
      "SELECT * FROM racers WHERE event_id = ? AND car_number = ?"
    ).get(eventId, carNumber) as Racer | undefined;
    return row ?? null;
  }

  findInspectedByEvent(eventId: string): Racer[] {
    return this.db.query(
      "SELECT * FROM racers WHERE event_id = ? AND weight_ok = 1 ORDER BY CAST(car_number AS INTEGER)"
    ).all(eventId) as Racer[];
  }

  update(id: string, input: UpdateRacerInput): Racer | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = "name" in input ? (input.name ?? existing.name) : existing.name;
    const den = "den" in input ? (input.den ?? null) : existing.den;
    const car_number = "car_number" in input ? (input.car_number ?? existing.car_number) : existing.car_number;
    const weight_ok = input.weight_ok !== undefined ? (input.weight_ok ? 1 : 0) : existing.weight_ok;
    const inspected_at = "inspected_at" in input ? (input.inspected_at ?? null) : existing.inspected_at;
    const car_photo_filename = "car_photo_filename" in input
      ? (input.car_photo_filename ?? null)
      : existing.car_photo_filename;
    const car_photo_mime_type = "car_photo_mime_type" in input
      ? (input.car_photo_mime_type ?? null)
      : existing.car_photo_mime_type;
    const car_photo_bytes = "car_photo_bytes" in input
      ? (input.car_photo_bytes ?? null)
      : existing.car_photo_bytes;
    
    this.db.run(
      `UPDATE racers SET
        name = ?,
        den = ?,
        car_number = ?,
        weight_ok = ?,
        inspected_at = ?,
        car_photo_filename = ?,
        car_photo_mime_type = ?,
        car_photo_bytes = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        name,
        den,
        car_number,
        weight_ok,
        inspected_at,
        car_photo_filename,
        car_photo_mime_type,
        car_photo_bytes,
        now,
        id,
      ]
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.run("DELETE FROM racers WHERE id = ?", [id]);
    return result.changes > 0;
  }

  inspect(id: string, weightOk: boolean): Racer | null {
    return this.update(id, {
      weight_ok: weightOk,
      inspected_at: new Date().toISOString()
    });
  }

  getInspectionStats(eventId: string): { total: number; inspected: number } {
    const result = this.db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN weight_ok = 1 THEN 1 ELSE 0 END) as inspected
       FROM racers WHERE event_id = ?`
    ).get(eventId) as { total: number; inspected: number } | undefined;
    
    return {
      total: result?.total ?? 0,
      inspected: result?.inspected ?? 0
    };
  }
}

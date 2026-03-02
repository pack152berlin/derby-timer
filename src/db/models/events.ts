import { getDb } from "../connection";
import type { Database } from "bun:sqlite";

export interface Event {
  id: string;
  name: string;
  date: string;
  lane_count: number;
  racer_count: number;
  status: 'draft' | 'checkin' | 'racing' | 'complete';
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  name: string;
  date: string;
  lane_count?: number;
}

export interface UpdateEventInput {
  name?: string;
  date?: string;
  lane_count?: number;
  status?: 'draft' | 'checkin' | 'racing' | 'complete';
}

export class EventRepository {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  create(input: CreateEventInput): Event {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    this.db.run(
      `INSERT INTO events (id, name, date, lane_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.date, input.lane_count ?? 4, 'draft', now, now]
    );

    return {
      id,
      name: input.name,
      date: input.date,
      lane_count: input.lane_count ?? 4,
      racer_count: 0,
      status: 'draft',
      created_at: now,
      updated_at: now
    };
  }

  findById(id: string): Event | null {
    const row = this.db.query(
      `SELECT e.*, (SELECT COUNT(*) FROM racers r WHERE r.event_id = e.id) as racer_count 
       FROM events e WHERE e.id = ?`
    ).get(id) as Event | undefined;
    return row ?? null;
  }

  findAll(): Event[] {
    return this.db.query(
      `SELECT e.*, (SELECT COUNT(*) FROM racers r WHERE r.event_id = e.id) as racer_count 
       FROM events e ORDER BY date DESC`
    ).all() as Event[];
  }

  update(id: string, input: UpdateEventInput): Event | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = input.name ?? existing.name;
    const date = input.date ?? existing.date;
    const lane_count = input.lane_count ?? existing.lane_count;
    const status = input.status ?? existing.status;
    
    this.db.run(
      `UPDATE events SET
        name = ?,
        date = ?,
        lane_count = ?,
        status = ?,
        updated_at = ?
       WHERE id = ?`,
      [name, date, lane_count, status, now, id]
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.run("DELETE FROM events WHERE id = ?", [id]);
    return result.changes > 0;
  }
}

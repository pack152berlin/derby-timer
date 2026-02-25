import { getDb } from "../connection";
import type { Database } from "bun:sqlite";

export interface Heat {
  id: string;
  event_id: string;
  round: number;
  heat_number: number;
  status: 'pending' | 'running' | 'complete';
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeatLane {
  id: string;
  heat_id: string;
  lane_number: number;
  racer_id: string;
  created_at: string;
}

export interface CreateHeatInput {
  event_id: string;
  round: number;
  heat_number: number;
  lanes: { lane_number: number; racer_id: string }[];
}

export class HeatRepository {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  create(input: CreateHeatInput): Heat {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Insert heat
    this.db.run(
      `INSERT INTO heats (id, event_id, round, heat_number, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.event_id, input.round, input.heat_number, 'pending', now, now]
    );

    // Insert lanes
    for (const lane of input.lanes) {
      const laneId = crypto.randomUUID();
      this.db.run(
        `INSERT INTO heat_lanes (id, heat_id, lane_number, racer_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [laneId, id, lane.lane_number, lane.racer_id, now]
      );
    }

    return {
      id,
      event_id: input.event_id,
      round: input.round,
      heat_number: input.heat_number,
      status: 'pending',
      started_at: null,
      finished_at: null,
      created_at: now,
      updated_at: now
    };
  }

  findById(id: string): Heat | null {
    const row = this.db.query(
      "SELECT * FROM heats WHERE id = ?"
    ).get(id) as Heat | undefined;
    return row ?? null;
  }

  findByEvent(eventId: string): Heat[] {
    return this.db.query(
      "SELECT * FROM heats WHERE event_id = ? ORDER BY round, heat_number"
    ).all(eventId) as Heat[];
  }

  findRunning(): Heat | null {
    const row = this.db.query(
      "SELECT * FROM heats WHERE status = 'running' ORDER BY updated_at DESC LIMIT 1"
    ).get() as Heat | undefined;
    return row ?? null;
  }

  findWithLanes(heatId: string): (Heat & { lanes: (HeatLane & { car_number: string; racer_name: string })[] }) | null {
    const heat = this.findById(heatId);
    if (!heat) return null;

    const lanes = this.db.query(
      `SELECT hl.*, r.car_number, r.name as racer_name
       FROM heat_lanes hl
       JOIN racers r ON hl.racer_id = r.id
       WHERE hl.heat_id = ?
       ORDER BY hl.lane_number`
    ).all(heatId) as (HeatLane & { car_number: string; racer_name: string })[];

    return { ...heat, lanes };
  }

  findByEventWithLanes(eventId: string): (Heat & { lanes: (HeatLane & { car_number: string; racer_name: string })[] })[] {
    const heats = this.findByEvent(eventId);
    return heats.map(heat => {
      const lanes = this.db.query(
        `SELECT hl.*, r.car_number, r.name as racer_name
         FROM heat_lanes hl
         JOIN racers r ON hl.racer_id = r.id
         WHERE hl.heat_id = ?
         ORDER BY hl.lane_number`
      ).all(heat.id) as (HeatLane & { car_number: string; racer_name: string })[];
      return { ...heat, lanes };
    });
  }

  updateStatus(id: string, status: Heat['status']): Heat | null {
    const now = new Date().toISOString();
    
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: (string | number | null)[] = [status, now];
    
    if (status === 'running') {
      updates.push('started_at = ?');
      values.push(now);
    } else if (status === 'complete') {
      updates.push('finished_at = ?');
      values.push(now);
    } else if (status === 'pending') {
      updates.push('started_at = ?', 'finished_at = ?');
      values.push(null, null);
    }
    
    values.push(id);
    
    this.db.run(
      `UPDATE heats SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.run("DELETE FROM heats WHERE id = ?", [id]);
    return result.changes > 0;
  }

  deleteByEvent(eventId: string): void {
    this.db.run("DELETE FROM heats WHERE event_id = ?", [eventId]);
  }
}

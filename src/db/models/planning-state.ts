import { getDb } from "../connection";
import type { Database } from "bun:sqlite";

export interface PlanningSettingsRecord {
  event_id: string;
  lane_count: number;
  rounds: number;
  lookahead: 2 | 3;
  updated_at: string;
}

export class PlanningStateRepository {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  getSettings(eventId: string): PlanningSettingsRecord | null {
    const row = this.db
      .query("SELECT * FROM event_planning_settings WHERE event_id = ?")
      .get(eventId) as PlanningSettingsRecord | undefined;

    return row ?? null;
  }

  upsertSettings(input: {
    event_id: string;
    lane_count: number;
    rounds: number;
    lookahead: 2 | 3;
  }): void {
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO event_planning_settings (event_id, lane_count, rounds, lookahead, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(event_id) DO UPDATE SET
         lane_count = excluded.lane_count,
         rounds = excluded.rounds,
         lookahead = excluded.lookahead,
         updated_at = excluded.updated_at`,
      [input.event_id, input.lane_count, input.rounds, input.lookahead, now]
    );
  }

  clearSettings(eventId: string): void {
    this.db.run("DELETE FROM event_planning_settings WHERE event_id = ?", [eventId]);
  }

  getRoundRacerIds(eventId: string, roundNumber: number): string[] {
    const rows = this.db
      .query(
        `SELECT racer_id
         FROM round_racer_rosters
         WHERE event_id = ? AND round = ?
         ORDER BY racer_id`
      )
      .all(eventId, roundNumber) as { racer_id: string }[];

    return rows.map((row) => row.racer_id);
  }

  replaceRoundRacerIds(eventId: string, roundNumber: number, racerIds: string[]): void {
    const uniqueRacerIds = [...new Set(racerIds)];
    const now = new Date().toISOString();

    const writeRoster = this.db.transaction((ids: string[]) => {
      this.db.run(
        "DELETE FROM round_racer_rosters WHERE event_id = ? AND round = ?",
        [eventId, roundNumber]
      );

      for (const racerId of ids) {
        this.db.run(
          `INSERT INTO round_racer_rosters (event_id, round, racer_id, created_at)
           VALUES (?, ?, ?, ?)`,
          [eventId, roundNumber, racerId, now]
        );
      }
    });

    writeRoster(uniqueRacerIds);
  }

  clearRoundRosters(eventId: string): void {
    this.db.run("DELETE FROM round_racer_rosters WHERE event_id = ?", [eventId]);
  }
}

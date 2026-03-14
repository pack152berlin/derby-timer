import { getDb } from "../connection";
import type { Database } from "bun:sqlite";

export interface EventAward {
  id: string;
  event_id: string;
  name: string;
  allow_second: number;
  allow_third: number;
  sort_order: number;
}

export interface CreateAwardInput {
  name: string;
  allow_second?: boolean;
  allow_third?: boolean;
  sort_order?: number;
}

export interface EventAwardWinner {
  id: string;
  award_id: string;
  racer_id: string;
  place: number;
  award_name: string;
  racer_name: string;
}

export class EventAwardRepository {
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  findAwardsByEvent(eventId: string): EventAward[] {
    return this.db.query(
      "SELECT * FROM event_awards WHERE event_id = ? ORDER BY sort_order, rowid"
    ).all(eventId) as EventAward[];
  }

  createAward(eventId: string, input: CreateAwardInput): EventAward {
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO event_awards (id, event_id, name, allow_second, allow_third, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        eventId,
        input.name,
        input.allow_second ? 1 : 0,
        input.allow_third ? 1 : 0,
        input.sort_order ?? 0,
      ]
    );
    return this.db.query("SELECT * FROM event_awards WHERE id = ?").get(id) as EventAward;
  }

  updateAward(id: string, input: Partial<CreateAwardInput>): EventAward | null {
    const existing = this.db.query("SELECT * FROM event_awards WHERE id = ?").get(id) as EventAward | undefined;
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const allow_second = input.allow_second !== undefined ? (input.allow_second ? 1 : 0) : existing.allow_second;
    const allow_third = input.allow_third !== undefined ? (input.allow_third ? 1 : 0) : existing.allow_third;
    const sort_order = input.sort_order ?? existing.sort_order;

    this.db.run(
      `UPDATE event_awards SET name = ?, allow_second = ?, allow_third = ?, sort_order = ? WHERE id = ?`,
      [name, allow_second, allow_third, sort_order, id]
    );

    return this.db.query("SELECT * FROM event_awards WHERE id = ?").get(id) as EventAward;
  }

  deleteAward(id: string): boolean {
    const result = this.db.run("DELETE FROM event_awards WHERE id = ?", [id]);
    return result.changes > 0;
  }

  replaceAwardsForEvent(
    eventId: string,
    awards: CreateAwardInput[]
  ): EventAward[] {
    return this.db.transaction(() => {
      this.db.run("DELETE FROM event_awards WHERE event_id = ?", [eventId]);

      const created: EventAward[] = [];
      for (let i = 0; i < awards.length; i++) {
        created.push(this.createAward(eventId, { ...awards[i]!, sort_order: i }));
      }
      return created;
    })();
  }

  setWinnersForAward(
    awardId: string,
    winners: { racer_id: string; place: number }[]
  ): void {
    this.db.transaction(() => {
      this.db.run("DELETE FROM event_award_winners WHERE award_id = ?", [awardId]);

      for (const w of winners) {
        const id = crypto.randomUUID();
        this.db.run(
          `INSERT INTO event_award_winners (id, award_id, racer_id, place) VALUES (?, ?, ?, ?)`,
          [id, awardId, w.racer_id, w.place]
        );
      }
    })();
  }

  findWinnersByEvent(eventId: string): EventAwardWinner[] {
    return this.db.query(`
      SELECT w.id, w.award_id, w.racer_id, w.place,
             a.name AS award_name,
             r.name AS racer_name
      FROM event_award_winners w
      JOIN event_awards a ON a.id = w.award_id
      JOIN racers r ON r.id = w.racer_id
      WHERE a.event_id = ?
      ORDER BY a.sort_order, w.place
    `).all(eventId) as EventAwardWinner[];
  }

  deleteWinner(id: string): boolean {
    const result = this.db.run("DELETE FROM event_award_winners WHERE id = ?", [id]);
    return result.changes > 0;
  }
}

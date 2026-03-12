import type { RacerHistoryEntry } from '../types';

// --- Best lane ---

/**
 * Determine the lane where a racer performed best.
 * Prefers average time when timing data exists, falls back to average place.
 */
export function bestLane(history: RacerHistoryEntry[]): number | null {
  const valid = history.filter(h => !h.dnf && h.place != null);
  if (valid.length === 0) return null;

  const byLane = new Map<number, { totalTime: number; totalPlace: number; count: number; hasTimes: boolean }>();
  for (const h of valid) {
    const entry = byLane.get(h.lane_number) ?? { totalTime: 0, totalPlace: 0, count: 0, hasTimes: false };
    entry.totalPlace += h.place!;
    entry.count++;
    if (h.time_ms != null && h.time_ms > 0) {
      entry.totalTime += h.time_ms;
      entry.hasTimes = true;
    }
    byLane.set(h.lane_number, entry);
  }

  // If any lane has timing data, compare only timed lanes by avg time.
  // Otherwise fall back to avg place for all lanes.
  const anyTimed = [...byLane.values()].some(s => s.hasTimes);

  let best: number | null = null;
  let bestScore = Infinity;
  for (const [lane, stats] of byLane) {
    if (anyTimed && !stats.hasTimes) continue;
    const score = anyTimed ? stats.totalTime / stats.count : stats.totalPlace / stats.count;
    if (score < bestScore) {
      bestScore = score;
      best = lane;
    }
  }
  return best;
}

// --- Racer stats ---

export interface RacerStats {
  wins: number;
  second_place_count: number;
  third_place_count: number;
  best_time_ms: number | null;
  avg_time_ms: number | null;
  heats_raced: number;
}

export function computeRacerStats(results: RacerHistoryEntry[]): RacerStats {
  let wins = 0, second_place_count = 0, third_place_count = 0;
  let total_time_ms = 0, time_count = 0;
  let best_time_ms: number | null = null;
  for (const r of results) {
    if (!r.dnf) {
      if (r.place === 1) wins++;
      else if (r.place === 2) second_place_count++;
      else if (r.place === 3) third_place_count++;
    }
    if (r.time_ms != null && r.time_ms > 0) {
      total_time_ms += r.time_ms;
      time_count++;
      if (best_time_ms === null || r.time_ms < best_time_ms) best_time_ms = r.time_ms;
    }
  }
  return { wins, second_place_count, third_place_count, best_time_ms, avg_time_ms: time_count > 0 ? total_time_ms / time_count : null, heats_raced: results.length };
}

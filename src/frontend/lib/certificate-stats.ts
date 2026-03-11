import type { RacerHistoryEntry } from '../types';

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

export interface StatItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface StatsInput {
  wins: number;
  second_place_count: number;
  third_place_count: number;
  best_time_ms: number | null;
  avg_time_ms: number | null;
  heats_raced?: number;
}

function formatTime(ms: number | null): string {
  if (ms == null) return '\u2014';
  return (ms / 1000).toFixed(3) + 's';
}

/**
 * Build the balanced list of stat items for a certificate.
 *
 * Rules:
 * - Only include place counts that are > 0
 * - Always include Car #
 * - Include Avg Time only when it keeps the total count even
 *   (so stats balance evenly around the centered den logo)
 * - Wins is highlighted
 */
export function buildCertificateStats(stats: StatsInput, carNumber: string, opts?: { showRaces?: boolean }): StatItem[] {
  const items: StatItem[] = [];
  const canAddRaces = opts?.showRaces && stats.heats_raced;

  if (stats.wins > 0) items.push({ label: 'Wins', value: String(stats.wins), highlight: true });
  if (stats.second_place_count > 0) items.push({ label: '2nd Place', value: String(stats.second_place_count) });
  if (stats.third_place_count > 0) items.push({ label: '3rd Place', value: String(stats.third_place_count) });
  if (stats.best_time_ms != null) items.push({ label: 'Best Time', value: formatTime(stats.best_time_ms) });

  // Include avg time only when it keeps the total even
  if (stats.avg_time_ms != null && items.length % 2 !== 0) {
    items.push({ label: 'Avg Time', value: formatTime(stats.avg_time_ms) });
  }

  items.push({ label: 'Car #', value: carNumber });

  // Balance: try avg time first, then races count
  if (items.length % 2 !== 0) {
    if (stats.avg_time_ms != null && !items.some(i => i.label === 'Avg Time')) {
      items.splice(items.length - 1, 0, { label: 'Avg Time', value: formatTime(stats.avg_time_ms) });
    } else if (canAddRaces) {
      items.unshift({ label: 'Races', value: String(stats.heats_raced) });
    }
  }

  return items;
}

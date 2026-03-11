import { describe, expect, it } from 'bun:test';
import { buildCertificateStats } from '../src/frontend/lib/certificate-stats';

const base = {
  wins: 0,
  second_place_count: 0,
  third_place_count: 0,
  best_time_ms: null,
  avg_time_ms: null,
};

describe('buildCertificateStats', () => {
  it('always includes Car # even with no race stats', () => {
    const items = buildCertificateStats(base, '42');
    expect(items).toEqual([{ label: 'Car #', value: '42' }]);
  });

  it('wins only + avg_time: adds avg to balance before car#', () => {
    const items = buildCertificateStats(
      { ...base, wins: 3, avg_time_ms: 3500 },
      '7',
    );
    const labels = items.map(i => i.label);
    // wins = 1 item (odd) → avg added = 2 (even) → Car # = 3 (odd)
    // already has avg, so final is 3 (odd) — no way to make even without another stat
    expect(labels).toEqual(['Wins', 'Avg Time', 'Car #']);
  });

  it('wins + best_time is even, does not add avg time', () => {
    const items = buildCertificateStats(
      { ...base, wins: 5, best_time_ms: 3200, avg_time_ms: 3400 },
      '10',
    );
    const labels = items.map(i => i.label);
    // wins, best_time = 2 items (even), so avg_time NOT added
    // then Car # makes it 3 (odd), avg_time added before Car # to make 4
    expect(labels).toEqual(['Wins', 'Best Time', 'Avg Time', 'Car #']);
    expect(items.length % 2).toBe(0);
  });

  it('wins + 2nd + 3rd + best_time is even, skips avg time, adds Car # to make odd, then adds avg time', () => {
    const items = buildCertificateStats(
      { ...base, wins: 5, second_place_count: 2, third_place_count: 1, best_time_ms: 3100, avg_time_ms: 3300 },
      '12',
    );
    const labels = items.map(i => i.label);
    // 4 items (even) → skip avg → add Car # = 5 (odd) → insert avg before Car #
    expect(labels).toEqual(['Wins', '2nd Place', '3rd Place', 'Best Time', 'Avg Time', 'Car #']);
    expect(items.length % 2).toBe(0);
  });

  it('wins + 2nd + best_time is odd, adds avg time immediately', () => {
    const items = buildCertificateStats(
      { ...base, wins: 4, second_place_count: 3, best_time_ms: 2900, avg_time_ms: 3100 },
      '5',
    );
    const labels = items.map(i => i.label);
    // 3 items (odd) → add avg = 4 (even) → add Car # = 5 (odd)
    // but then avg is already added, so final is odd — hmm let me trace again
    // wins=4 → [Wins], 2nd=3 → [Wins, 2nd], best → [Wins, 2nd, Best] = 3 (odd)
    // avg_time != null && 3 % 2 !== 0 → push Avg → [Wins, 2nd, Best, Avg] = 4
    // push Car # → [Wins, 2nd, Best, Avg, Car#] = 5 (odd)
    // 5 % 2 !== 0 && avg != null && already has Avg → skip
    expect(labels).toEqual(['Wins', '2nd Place', 'Best Time', 'Avg Time', 'Car #']);
    expect(items.length).toBe(5);
  });

  it('highlights only Wins', () => {
    const items = buildCertificateStats(
      { ...base, wins: 3, second_place_count: 2, best_time_ms: 3000, avg_time_ms: 3200 },
      '8',
    );
    const highlighted = items.filter(i => i.highlight);
    expect(highlighted.length).toBe(1);
    expect(highlighted[0]!.label).toBe('Wins');
  });

  it('formats best_time_ms to seconds', () => {
    const items = buildCertificateStats(
      { ...base, wins: 1, best_time_ms: 3456 },
      '1',
    );
    const bestTime = items.find(i => i.label === 'Best Time');
    expect(bestTime?.value).toBe('3.456s');
  });

  it('no avg_time available keeps odd count as-is', () => {
    const items = buildCertificateStats(
      { ...base, wins: 2, best_time_ms: 3000 },
      '3',
    );
    const labels = items.map(i => i.label);
    // wins, best_time = 2 (even) → Car # = 3 (odd), no avg available
    expect(labels).toEqual(['Wins', 'Best Time', 'Car #']);
    expect(items.length).toBe(3);
  });

  it('zero wins are excluded', () => {
    const items = buildCertificateStats(
      { ...base, second_place_count: 4, best_time_ms: 3500, avg_time_ms: 3600 },
      '15',
    );
    const labels = items.map(i => i.label);
    expect(labels).not.toContain('Wins');
  });
});

import { describe, expect, it } from 'bun:test';
import { bestLane } from '../src/frontend/lib/racer-stats';
import type { RacerHistoryEntry } from '../src/frontend/types';

const entry = (lane_number: number, place: number | null, time_ms: number | null = null, dnf = false): RacerHistoryEntry => ({
  id: `${lane_number}-${place}`,
  heat_id: 'h1',
  lane_number,
  racer_id: 'r1',
  place,
  time_ms,
  dnf,
  round: 1,
  heat_number: 1,
  created_at: '',
  updated_at: '',
});

describe('bestLane', () => {
  it('returns null for empty history', () => {
    expect(bestLane([])).toBeNull();
  });

  it('returns null when all entries are DNF', () => {
    expect(bestLane([entry(1, null, null, true), entry(2, null, null, true)])).toBeNull();
  });

  it('picks lane with lowest average time when timing exists', () => {
    const history = [
      entry(1, 2, 3500),
      entry(1, 1, 3400),
      entry(2, 1, 3600),
      entry(2, 1, 3700),
    ];
    // Lane 1 avg: 3450, Lane 2 avg: 3650
    expect(bestLane(history)).toBe(1);
  });

  it('falls back to average place when no timing data', () => {
    const history = [
      entry(1, 3),
      entry(1, 2),
      entry(2, 1),
      entry(2, 2),
    ];
    // Lane 1 avg place: 2.5, Lane 2 avg place: 1.5
    expect(bestLane(history)).toBe(2);
  });

  it('ignores DNF entries', () => {
    const history = [
      entry(1, 1, 3000),
      entry(2, null, null, true),
      entry(2, 2, 3500),
    ];
    expect(bestLane(history)).toBe(1);
  });

  it('handles single entry', () => {
    expect(bestLane([entry(3, 1, 3200)])).toBe(3);
  });

  it('prefers timing over placement when timing exists', () => {
    // Lane 1: worse place (2nd) but faster time
    // Lane 2: better place (1st) but slower time
    const history = [
      entry(1, 2, 3000),
      entry(2, 1, 4000),
    ];
    expect(bestLane(history)).toBe(1);
  });

  it('mixed timing — only timed lanes compete when any have times', () => {
    const history = [
      entry(1, 1, 5000), // has timing
      entry(2, 1),       // no timing — skipped from comparison
    ];
    // Lane 1 is the only timed lane, so it wins
    expect(bestLane(history)).toBe(1);
  });
});

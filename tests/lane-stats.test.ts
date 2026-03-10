import { describe, expect, it } from 'bun:test';
import { computeLaneStats } from '../src/frontend/views/HeatsView';
import type { Heat } from '../src/frontend/types';

const makeHeat = (overrides: Partial<Heat> & { results: Heat['results'] }): Heat => ({
  id: 'h1',
  event_id: 'e1',
  round: 1,
  heat_number: 1,
  status: 'complete',
  started_at: null,
  finished_at: null,
  ...overrides,
});

describe('computeLaneStats', () => {
  it('counts placements for a 4-lane track', () => {
    const heats: Heat[] = [
      makeHeat({
        id: 'h1',
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1 },
          { lane_number: 2, racer_id: 'r2', place: 2 },
          { lane_number: 3, racer_id: 'r3', place: 3 },
          { lane_number: 4, racer_id: 'r4', place: 4 },
        ],
      }),
      makeHeat({
        id: 'h2',
        heat_number: 2,
        results: [
          { lane_number: 1, racer_id: 'r5', place: 2 },
          { lane_number: 2, racer_id: 'r6', place: 1 },
          { lane_number: 3, racer_id: 'r7', place: 3 },
          { lane_number: 4, racer_id: 'r8', place: 4 },
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 4);
    expect(stats).toHaveLength(4);

    // Lane 1: one 1st, one 2nd
    expect(stats[0].placeCounts).toEqual([1, 1, 0, 0]);
    expect(stats[0].avgFinish).toBe(1.5);

    // Lane 2: one 1st, one 2nd
    expect(stats[1].placeCounts).toEqual([1, 1, 0, 0]);

    // Lane 3: two 3rds
    expect(stats[2].placeCounts).toEqual([0, 0, 2, 0]);
    expect(stats[2].avgFinish).toBe(3.0);

    // Lane 4: two 4ths
    expect(stats[3].placeCounts).toEqual([0, 0, 0, 2]);
    expect(stats[3].avgFinish).toBe(4.0);
  });

  it('scales placeCounts to lane count (6 lanes)', () => {
    const heats: Heat[] = [
      makeHeat({
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1 },
          { lane_number: 2, racer_id: 'r2', place: 5 },
          { lane_number: 3, racer_id: 'r3', place: 6 },
          { lane_number: 4, racer_id: 'r4', place: 2 },
          { lane_number: 5, racer_id: 'r5', place: 3 },
          { lane_number: 6, racer_id: 'r6', place: 4 },
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 6);
    expect(stats).toHaveLength(6);
    expect(stats[0].placeCounts).toEqual([1, 0, 0, 0, 0, 0]);
    expect(stats[1].placeCounts).toEqual([0, 0, 0, 0, 1, 0]);
    expect(stats[2].placeCounts).toEqual([0, 0, 0, 0, 0, 1]);
    expect(stats[4].placeCounts).toEqual([0, 0, 1, 0, 0, 0]);
  });

  it('computes avg, best, worst with times', () => {
    const heats: Heat[] = [
      makeHeat({
        id: 'h1',
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1, time_ms: 3000 },
          { lane_number: 2, racer_id: 'r2', place: 2, time_ms: 3200 },
        ],
      }),
      makeHeat({
        id: 'h2',
        heat_number: 2,
        results: [
          { lane_number: 1, racer_id: 'r3', place: 1, time_ms: 3400 },
          { lane_number: 2, racer_id: 'r4', place: 2, time_ms: 3600 },
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 2);

    expect(stats[0].hasTimes).toBe(true);
    expect(stats[0].avg).toBe(3200);   // (3000 + 3400) / 2
    expect(stats[0].best).toBe(3000);
    expect(stats[0].worst).toBe(3400);

    expect(stats[1].avg).toBe(3400);   // (3200 + 3600) / 2
    expect(stats[1].best).toBe(3200);
    expect(stats[1].worst).toBe(3600);
  });

  it('excludes DNF results from stats', () => {
    const heats: Heat[] = [
      makeHeat({
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1, time_ms: 3000 },
          { lane_number: 2, racer_id: 'r2', place: 2, dnf: true, time_ms: null },
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 2);
    expect(stats[0].hasTimes).toBe(true);
    expect(stats[0].best).toBe(3000);
    expect(stats[0].placeCounts).toEqual([1, 0]);

    expect(stats[1].hasTimes).toBe(false);
    expect(stats[1].avg).toBeNull();
    expect(stats[1].placeCounts).toEqual([0, 0]);
    expect(stats[1].avgFinish).toBeNull();
  });

  it('returns empty stats for heats with no results', () => {
    const heats: Heat[] = [makeHeat({ results: [] })];
    const stats = computeLaneStats(heats, 4);
    expect(stats).toHaveLength(4);
    expect(stats[0].placeCounts).toEqual([0, 0, 0, 0]);
    expect(stats[0].hasTimes).toBe(false);
  });

  it('handles empty heats array', () => {
    const stats = computeLaneStats([], 4);
    expect(stats).toHaveLength(4);
    stats.forEach(s => {
      expect(s.placeCounts).toEqual([0, 0, 0, 0]);
      expect(s.avg).toBeNull();
      expect(s.avgFinish).toBeNull();
    });
  });

  it('handles partial lane fill (not all lanes used in a heat)', () => {
    const heats: Heat[] = [
      makeHeat({
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1 },
          { lane_number: 3, racer_id: 'r2', place: 2 },
          // lanes 2 and 4 empty
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 4);
    expect(stats[0].placeCounts).toEqual([1, 0, 0, 0]);
    expect(stats[0].avgFinish).toBe(1.0);
    expect(stats[1].placeCounts).toEqual([0, 0, 0, 0]);
    expect(stats[1].avgFinish).toBeNull();
    expect(stats[2].placeCounts).toEqual([0, 1, 0, 0]);
    expect(stats[2].avgFinish).toBe(2.0);
    expect(stats[3].avgFinish).toBeNull();
  });

  it('avgFinish includes all placements, not just top 3', () => {
    const heats: Heat[] = [
      makeHeat({
        results: [
          { lane_number: 1, racer_id: 'r1', place: 4 },
          { lane_number: 2, racer_id: 'r2', place: 4 },
          { lane_number: 3, racer_id: 'r3', place: 1 },
          { lane_number: 4, racer_id: 'r4', place: 2 },
        ],
      }),
      makeHeat({
        id: 'h2',
        heat_number: 2,
        results: [
          { lane_number: 1, racer_id: 'r5', place: 3 },
          { lane_number: 2, racer_id: 'r6', place: 4 },
          { lane_number: 3, racer_id: 'r7', place: 2 },
          { lane_number: 4, racer_id: 'r8', place: 1 },
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 4);
    // Lane 1: places 4 + 3 = avg 3.5
    expect(stats[0].avgFinish).toBe(3.5);
    // Lane 2: places 4 + 4 = avg 4.0
    expect(stats[1].avgFinish).toBe(4.0);
    // Lane 3: places 1 + 2 = avg 1.5
    expect(stats[2].avgFinish).toBe(1.5);
  });

  it('handles heats with undefined results gracefully', () => {
    const heats: Heat[] = [
      makeHeat({ results: undefined }),
      makeHeat({ id: 'h2', heat_number: 2, results: [
        { lane_number: 1, racer_id: 'r1', place: 1 },
      ]}),
    ];

    const stats = computeLaneStats(heats, 2);
    expect(stats[0].placeCounts).toEqual([1, 0]);
    expect(stats[1].placeCounts).toEqual([0, 0]);
  });

  it('times and placements are independent (times on some, not all)', () => {
    const heats: Heat[] = [
      makeHeat({
        id: 'h1',
        results: [
          { lane_number: 1, racer_id: 'r1', place: 1, time_ms: 3000 },
          { lane_number: 2, racer_id: 'r2', place: 2 },  // no time
        ],
      }),
    ];

    const stats = computeLaneStats(heats, 2);
    // Lane 1 has times
    expect(stats[0].hasTimes).toBe(true);
    expect(stats[0].avg).toBe(3000);
    expect(stats[0].avgFinish).toBe(1.0);

    // Lane 2 has no times but still has placement
    expect(stats[1].hasTimes).toBe(false);
    expect(stats[1].avg).toBeNull();
    expect(stats[1].avgFinish).toBe(2.0);
    expect(stats[1].placeCounts).toEqual([0, 1]);
  });
});

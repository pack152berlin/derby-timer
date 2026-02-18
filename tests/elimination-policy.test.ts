import { describe, expect, it } from 'bun:test';
import {
  buildEliminationPlan,
  getNextFieldSize,
  selectSurvivorsForNextRound,
} from '../src/race/elimination';

describe('elimination policy', () => {
  it('cuts the field roughly in half until two finalists', () => {
    expect(buildEliminationPlan(16)).toEqual([16, 8, 4, 2]);
    expect(buildEliminationPlan(9)).toEqual([9, 5, 3, 2]);
    expect(buildEliminationPlan(2)).toEqual([2]);
  });

  it('never cuts below two cars while reducing', () => {
    expect(getNextFieldSize(7)).toBe(4);
    expect(getNextFieldSize(3)).toBe(2);
    expect(getNextFieldSize(2)).toBe(2);
  });

  it('chooses survivors by wins, losses, then average time', () => {
    const racers = [
      { id: 'A', car_number: '101' },
      { id: 'B', car_number: '102' },
      { id: 'C', car_number: '103' },
      { id: 'D', car_number: '104' },
      { id: 'E', car_number: '105' },
    ];

    const survivors = selectSurvivorsForNextRound(racers, [
      { racer_id: 'A', wins: 4, losses: 0, heats_run: 4, avg_time_ms: 2511 },
      { racer_id: 'B', wins: 3, losses: 1, heats_run: 4, avg_time_ms: 2505 },
      { racer_id: 'C', wins: 3, losses: 1, heats_run: 4, avg_time_ms: 2520 },
      { racer_id: 'D', wins: 1, losses: 3, heats_run: 4, avg_time_ms: 2490 },
      { racer_id: 'E', wins: 0, losses: 4, heats_run: 4, avg_time_ms: 2600 },
    ]);

    expect(survivors.map((racer) => racer.id)).toEqual(['A', 'B', 'C']);
  });
});

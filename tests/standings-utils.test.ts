import { describe, expect, it } from 'bun:test';
import { calculatePlaceCounts } from '../src/frontend/lib/standings-utils';
import type { Heat } from '../src/frontend/types';

describe('standings utils', () => {
  describe('calculatePlaceCounts', () => {
    it('should correctly aggregate 2nd and 3rd place finishes', () => {
      const heats: Heat[] = [
        {
          id: 'h1',
          event_id: 'e1',
          round: 1,
          heat_number: 1,
          status: 'complete',
          started_at: null,
          finished_at: null,
          results: [
            { racer_id: 'r1', place: 1, lane_number: 1 },
            { racer_id: 'r2', place: 2, lane_number: 2 },
            { racer_id: 'r3', place: 3, lane_number: 3 },
          ]
        },
        {
          id: 'h2',
          event_id: 'e1',
          round: 1,
          heat_number: 2,
          status: 'complete',
          started_at: null,
          finished_at: null,
          results: [
            { racer_id: 'r2', place: 3, lane_number: 1 },
            { racer_id: 'r1', place: 2, lane_number: 2 },
            { racer_id: 'r4', place: 1, lane_number: 3 },
          ]
        }
      ];

      const counts = calculatePlaceCounts(heats);

      expect(counts['r1']).toEqual({ seconds: 1, thirds: 0 });
      expect(counts['r2']).toEqual({ seconds: 1, thirds: 1 });
      expect(counts['r3']).toEqual({ seconds: 0, thirds: 1 });
      expect(counts['r4']).toEqual({ seconds: 0, thirds: 0 });
    });

    it('should ignore DNF results', () => {
      const heats: Heat[] = [
        {
          id: 'h1',
          event_id: 'e1',
          round: 1,
          heat_number: 1,
          status: 'complete',
          started_at: null,
          finished_at: null,
          results: [
            { racer_id: 'r1', place: 2, lane_number: 1, dnf: true },
            { racer_id: 'r2', place: 3, lane_number: 2, dnf: true },
          ]
        }
      ];

      const counts = calculatePlaceCounts(heats);

      expect(counts['r1']).toEqual({ seconds: 0, thirds: 0 });
      expect(counts['r2']).toEqual({ seconds: 0, thirds: 0 });
    });

    it('should return empty object if no heats or results', () => {
      expect(calculatePlaceCounts([])).toEqual({});
      expect(calculatePlaceCounts([{ id: 'h1', event_id: 'e1', round: 1, heat_number: 1, status: 'pending', started_at: null, finished_at: null }])).toEqual({});
    });
  });
});

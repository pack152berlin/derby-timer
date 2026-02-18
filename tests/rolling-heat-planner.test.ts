import { describe, expect, it } from 'bun:test';
import {
  planHeatQueue,
  planNextHeat,
  type PlannerHeat,
  type PlannerRacer,
  type PlannerStanding,
} from '../src/race/heat-planner';

const createRacers = (count: number): PlannerRacer[] => {
  return Array.from({ length: count }, (_, idx) => ({
    id: String(idx + 1),
    car_number: String(100 + idx + 1),
  }));
};

describe('rolling heat planner', () => {
  it('only plans up to the requested lookahead window', () => {
    const racers = createRacers(8);

    const planned = planHeatQueue({
      racers,
      laneCount: 4,
      rounds: 1,
      lookahead: 3,
      existingHeats: [],
      standings: [],
    });

    expect(planned).toHaveLength(3);
    planned.forEach((heat) => {
      expect(heat.lanes).toHaveLength(4);
      expect(new Set(heat.lanes.map((lane) => lane.racer_id)).size).toBe(4);
    });
  });

  it('eventually gives each racer every lane', () => {
    const racers = createRacers(8);
    const heats: PlannerHeat[] = [];

    for (let i = 0; i < 80; i++) {
      const nextHeat = planNextHeat({
        racers,
        laneCount: 4,
        rounds: 1,
        existingHeats: heats,
        standings: [],
      });

      if (!nextHeat) break;

      heats.push({ status: 'complete', lanes: nextHeat.lanes });
    }

    racers.forEach((racer) => {
      const lanes = new Set<number>();
      heats.forEach((heat) => {
        heat.lanes.forEach((lane) => {
          if (lane.racer_id === racer.id) {
            lanes.add(lane.lane_number);
          }
        });
      });

      expect(lanes.size).toBe(4);
    });
  });

  it('handles fewer racers than lanes without duplicate racers per heat', () => {
    const racers = createRacers(3);
    const heats: PlannerHeat[] = [];

    for (let i = 0; i < 40; i++) {
      const nextHeat = planNextHeat({
        racers,
        laneCount: 4,
        rounds: 1,
        existingHeats: heats,
        standings: [],
      });

      if (!nextHeat) break;

      expect(new Set(nextHeat.lanes.map((lane) => lane.racer_id)).size).toBe(nextHeat.lanes.length);
      heats.push({ status: 'complete', lanes: nextHeat.lanes });
    }

    racers.forEach((racer) => {
      const lanes = new Set<number>();
      heats.forEach((heat) => {
        heat.lanes.forEach((lane) => {
          if (lane.racer_id === racer.id) {
            lanes.add(lane.lane_number);
          }
        });
      });

      expect(lanes.size).toBe(4);
    });
  });

  it('leans toward grouping similarly winning racers', () => {
    const racers = createRacers(8);
    const standings: PlannerStanding[] = racers.map((racer, idx) => {
      if (idx < 4) {
        return {
          racer_id: racer.id,
          wins: 4,
          losses: 1,
          heats_run: 5,
        };
      }

      return {
        racer_id: racer.id,
        wins: 1,
        losses: 4,
        heats_run: 5,
      };
    });

    const nextHeat = planNextHeat({
      racers,
      laneCount: 4,
      rounds: 1,
      standings,
      existingHeats: [],
    });

    expect(nextHeat).not.toBeNull();
    const topGroup = new Set(racers.slice(0, 4).map((racer) => racer.id));
    const topCarsInHeat =
      nextHeat?.lanes.filter((lane) => topGroup.has(lane.racer_id)).length ?? 0;

    expect(topCarsInHeat).toBeGreaterThanOrEqual(3);
  });
});

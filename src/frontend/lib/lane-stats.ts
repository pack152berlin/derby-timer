import type { Heat } from '../types';

export interface LaneStat {
  lane: number;
  avg: number | null;
  best: number | null;
  worst: number | null;
  placeCounts: number[];  // index 0 = 1st place, index 1 = 2nd, etc.
  avgFinish: number | null;
  hasTimes: boolean;
}

export function computeLaneStats(heats: Heat[], laneCount: number): LaneStat[] {
  const timeSums = new Array<number>(laneCount).fill(0);
  const timeCounts = new Array<number>(laneCount).fill(0);
  const placeSums = new Array<number>(laneCount).fill(0);
  const placeCountsAcc = new Array<number>(laneCount).fill(0);

  const lanes: LaneStat[] = Array.from({ length: laneCount }, (_, i) => ({
    lane: i + 1, avg: null, best: null, worst: null,
    placeCounts: new Array(laneCount).fill(0) as number[], avgFinish: null, hasTimes: false,
  }));

  for (const heat of heats) {
    if (!heat.results) continue;
    for (const r of heat.results) {
      const idx = r.lane_number - 1;
      if (idx < 0 || idx >= laneCount) continue;
      const s = lanes[idx]!;
      if (!r.dnf && r.place != null && r.place >= 1 && r.place <= laneCount) {
        s.placeCounts[r.place - 1]!++;
        placeSums[idx]! += r.place;
        placeCountsAcc[idx]!++;
      }
      if (r.time_ms != null && !r.dnf) {
        s.hasTimes = true;
        if (s.best === null || r.time_ms < s.best) s.best = r.time_ms;
        if (s.worst === null || r.time_ms > s.worst) s.worst = r.time_ms;
        timeSums[idx]! += r.time_ms;
        timeCounts[idx]!++;
      }
    }
  }

  for (let i = 0; i < lanes.length; i++) {
    const s = lanes[i]!;
    if (timeCounts[i]! > 0) s.avg = timeSums[i]! / timeCounts[i]!;
    s.avgFinish = placeCountsAcc[i]! > 0 ? placeSums[i]! / placeCountsAcc[i]! : null;
  }

  return lanes;
}

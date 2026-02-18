export type HeatStatus = "pending" | "running" | "complete";

export interface PlannerRacer {
  id: string;
  car_number: string;
}

export interface PlannerStanding {
  racer_id: string;
  wins: number;
  losses: number;
  heats_run: number;
}

export interface PlannerHeatLane {
  lane_number: number;
  racer_id: string;
}

export interface PlannerHeat {
  status: HeatStatus;
  lanes: PlannerHeatLane[];
}

export interface PlanNextHeatInput {
  racers: PlannerRacer[];
  laneCount: number;
  rounds?: number;
  standings?: PlannerStanding[];
  existingHeats: PlannerHeat[];
}

export interface PlannedHeat {
  lanes: PlannerHeatLane[];
}

export interface PlanHeatQueueInput extends PlanNextHeatInput {
  lookahead: number;
}

interface PlanningState {
  laneCountsByRacer: Map<string, number[]>;
  laneNeedsByRacer: Map<string, number[]>;
  totalAssignmentsByRacer: Map<string, number>;
  totalNeedsByRacer: Map<string, number>;
  laneUsageTotals: number[];
  pairCounts: Map<string, number>;
}

const DEFAULT_ROUNDS = 1;

const getPerformanceScore = (
  racerId: string,
  standingsByRacer: Map<string, PlannerStanding>
) => {
  const standing = standingsByRacer.get(racerId);
  if (!standing) return 0;

  const heatsRun = Math.max(standing.heats_run, 1);
  const winRate = standing.wins / heatsRun;
  return standing.wins * 100 + winRate * 10 - standing.losses * 2;
};

const compareCarNumbers = (a: string, b: string) => {
  const aNum = Number(a);
  const bNum = Number(b);

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }

  return a.localeCompare(b);
};

const buildPlanningState = (
  racers: PlannerRacer[],
  laneCount: number,
  rounds: number,
  existingHeats: PlannerHeat[]
): PlanningState => {
  const laneCountsByRacer = new Map<string, number[]>();
  const totalAssignmentsByRacer = new Map<string, number>();
  const laneUsageTotals = new Array(laneCount).fill(0);
  const pairCounts = new Map<string, number>();

  for (const racer of racers) {
    laneCountsByRacer.set(racer.id, new Array(laneCount).fill(0));
    totalAssignmentsByRacer.set(racer.id, 0);
  }

  for (const heat of existingHeats) {
    const heatRacerIds: string[] = [];

    for (const lane of heat.lanes) {
      const laneIdx = lane.lane_number - 1;
      if (laneIdx < 0 || laneIdx >= laneCount) {
        continue;
      }

      const racerLaneCounts = laneCountsByRacer.get(lane.racer_id);
      if (!racerLaneCounts) {
        continue;
      }

      racerLaneCounts[laneIdx] = (racerLaneCounts[laneIdx] ?? 0) + 1;
      totalAssignmentsByRacer.set(
        lane.racer_id,
        (totalAssignmentsByRacer.get(lane.racer_id) ?? 0) + 1
      );
      laneUsageTotals[laneIdx] = (laneUsageTotals[laneIdx] ?? 0) + 1;

      if (!heatRacerIds.includes(lane.racer_id)) {
        heatRacerIds.push(lane.racer_id);
      }
    }

    for (let i = 0; i < heatRacerIds.length; i++) {
      for (let j = i + 1; j < heatRacerIds.length; j++) {
        const firstId = heatRacerIds[i];
        const secondId = heatRacerIds[j];
        if (!firstId || !secondId) continue;

        const pairKey = [firstId, secondId].sort().join("|");
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
      }
    }
  }

  const laneNeedsByRacer = new Map<string, number[]>();
  const totalNeedsByRacer = new Map<string, number>();

  for (const racer of racers) {
    const laneCounts = laneCountsByRacer.get(racer.id) ?? new Array(laneCount).fill(0);
    const laneNeeds = laneCounts.map((count) => Math.max(0, rounds - count));
    const totalNeeds = laneNeeds.reduce((sum, count) => sum + count, 0);

    laneNeedsByRacer.set(racer.id, laneNeeds);
    totalNeedsByRacer.set(racer.id, totalNeeds);
  }

  return {
    laneCountsByRacer,
    laneNeedsByRacer,
    totalAssignmentsByRacer,
    totalNeedsByRacer,
    laneUsageTotals,
    pairCounts,
  };
};

const pickLanesForHeat = (
  laneCount: number,
  heatSize: number,
  racersNeedingRuns: PlannerRacer[],
  laneNeedsByRacer: Map<string, number[]>,
  laneUsageTotals: number[]
) => {
  const laneCandidates = Array.from({ length: laneCount }, (_, idx) => {
    const laneIdx = idx;
    const laneNumber = idx + 1;

    const demand = racersNeedingRuns.reduce((sum, racer) => {
      const laneNeeds = laneNeedsByRacer.get(racer.id);
      return sum + (laneNeeds?.[laneIdx] ?? 0);
    }, 0);

    return {
      laneNumber,
      demand,
      laneUsage: laneUsageTotals[laneIdx] ?? 0,
    };
  });

  laneCandidates.sort((a, b) => {
    if (b.demand !== a.demand) return b.demand - a.demand;
    if (a.laneUsage !== b.laneUsage) return a.laneUsage - b.laneUsage;
    return a.laneNumber - b.laneNumber;
  });

  return laneCandidates.slice(0, heatSize).map((lane) => lane.laneNumber);
};

const chooseParticipants = (
  racersNeedingRuns: PlannerRacer[],
  heatSize: number,
  selectedLanes: number[],
  laneNeedsByRacer: Map<string, number[]>,
  totalNeedsByRacer: Map<string, number>,
  totalAssignmentsByRacer: Map<string, number>,
  pairCounts: Map<string, number>,
  standingsByRacer: Map<string, PlannerStanding>
) => {
  const sortedByUrgency = [...racersNeedingRuns].sort((a, b) => {
    const aNeeds = totalNeedsByRacer.get(a.id) ?? 0;
    const bNeeds = totalNeedsByRacer.get(b.id) ?? 0;
    if (bNeeds !== aNeeds) return bNeeds - aNeeds;

    const aAssignments = totalAssignmentsByRacer.get(a.id) ?? 0;
    const bAssignments = totalAssignmentsByRacer.get(b.id) ?? 0;
    if (aAssignments !== bAssignments) return aAssignments - bAssignments;

    const aPerf = getPerformanceScore(a.id, standingsByRacer);
    const bPerf = getPerformanceScore(b.id, standingsByRacer);
    if (bPerf !== aPerf) return bPerf - aPerf;

    return compareCarNumbers(a.car_number, b.car_number);
  });

  const seedRacer = sortedByUrgency[0];
  if (!seedRacer) return [];

  const participants: PlannerRacer[] = [seedRacer];
  const usedRacerIds = new Set<string>([seedRacer.id]);
  const seedPerformance = getPerformanceScore(seedRacer.id, standingsByRacer);

  while (participants.length < heatSize) {
    let bestCandidate: PlannerRacer | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of racersNeedingRuns) {
      if (usedRacerIds.has(candidate.id)) continue;

      const laneNeeds = laneNeedsByRacer.get(candidate.id) ?? [];
      const neededOpenLanes = selectedLanes.reduce((sum, laneNumber) => {
        return sum + ((laneNeeds[laneNumber - 1] ?? 0) > 0 ? 1 : 0);
      }, 0);

      const performanceDistance = Math.abs(
        getPerformanceScore(candidate.id, standingsByRacer) - seedPerformance
      );

      const repeatedMatchPenalty = participants.reduce((sum, participant) => {
        const pairKey = [participant.id, candidate.id].sort().join("|");
        return sum + (pairCounts.get(pairKey) ?? 0);
      }, 0);

      const totalNeeds = totalNeedsByRacer.get(candidate.id) ?? 0;
      const totalAssignments = totalAssignmentsByRacer.get(candidate.id) ?? 0;
      const laneCoveragePenalty = neededOpenLanes === 0 ? 200 : 0;

      const score =
        laneCoveragePenalty +
        performanceDistance * 4 +
        repeatedMatchPenalty * 12 +
        totalAssignments * 2 -
        totalNeeds * 6;

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      break;
    }

    participants.push(bestCandidate);
    usedRacerIds.add(bestCandidate.id);
  }

  return participants;
};

const assignLanes = (
  participants: PlannerRacer[],
  selectedLanes: number[],
  laneNeedsByRacer: Map<string, number[]>,
  laneCountsByRacer: Map<string, number[]>,
  laneUsageTotals: number[]
) => {
  const bestAssignment: PlannerHeatLane[] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  const usedLaneIndexes = new Set<number>();
  const currentAssignment: PlannerHeatLane[] = [];

  const recurse = (participantIdx: number, currentCost: number) => {
    if (participantIdx >= participants.length) {
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestAssignment.splice(0, bestAssignment.length, ...currentAssignment);
      }
      return;
    }

    if (currentCost >= bestCost) {
      return;
    }

    const participant = participants[participantIdx];
    if (!participant) return;

    for (let laneIdx = 0; laneIdx < selectedLanes.length; laneIdx++) {
      if (usedLaneIndexes.has(laneIdx)) continue;

      const laneNumber = selectedLanes[laneIdx];
      if (!laneNumber) continue;
      const laneNeeds = laneNeedsByRacer.get(participant.id) ?? [];
      const historicalCounts = laneCountsByRacer.get(participant.id) ?? [];

      const need = laneNeeds[laneNumber - 1] ?? 0;
      const historicalLaneCount = historicalCounts[laneNumber - 1] ?? 0;
      const laneUsage = laneUsageTotals[laneNumber - 1] ?? 0;

      const laneNeedPenalty = need > 0 ? 0 : 80;
      const laneRepeatPenalty = historicalLaneCount * 8;
      const laneBalancePenalty = laneUsage;
      const candidateCost =
        currentCost + laneNeedPenalty + laneRepeatPenalty + laneBalancePenalty;

      currentAssignment.push({
        lane_number: laneNumber,
        racer_id: participant.id,
      });
      usedLaneIndexes.add(laneIdx);

      recurse(participantIdx + 1, candidateCost);

      usedLaneIndexes.delete(laneIdx);
      currentAssignment.pop();
    }
  };

  recurse(0, 0);

  const assignmentProgress = bestAssignment.reduce((sum, lane) => {
    const laneNeeds = laneNeedsByRacer.get(lane.racer_id) ?? [];
    return sum + ((laneNeeds[lane.lane_number - 1] ?? 0) > 0 ? 1 : 0);
  }, 0);

  if (bestAssignment.length === 0 || assignmentProgress === 0) {
    return null;
  }

  return bestAssignment.sort((a, b) => a.lane_number - b.lane_number);
};

export const planNextHeat = (input: PlanNextHeatInput): PlannedHeat | null => {
  const laneCount = Math.max(0, input.laneCount);
  const rounds = Math.max(DEFAULT_ROUNDS, input.rounds ?? DEFAULT_ROUNDS);

  if (laneCount === 0 || input.racers.length === 0) {
    return null;
  }

  const planningState = buildPlanningState(
    input.racers,
    laneCount,
    rounds,
    input.existingHeats
  );

  const standingsByRacer = new Map<string, PlannerStanding>();
  for (const standing of input.standings ?? []) {
    standingsByRacer.set(standing.racer_id, standing);
  }

  const racersNeedingRuns = input.racers.filter((racer) => {
    return (planningState.totalNeedsByRacer.get(racer.id) ?? 0) > 0;
  });

  if (racersNeedingRuns.length === 0) {
    return null;
  }

  const heatSize = Math.min(laneCount, racersNeedingRuns.length);
  const selectedLanes = pickLanesForHeat(
    laneCount,
    heatSize,
    racersNeedingRuns,
    planningState.laneNeedsByRacer,
    planningState.laneUsageTotals
  );

  const participants = chooseParticipants(
    racersNeedingRuns,
    heatSize,
    selectedLanes,
    planningState.laneNeedsByRacer,
    planningState.totalNeedsByRacer,
    planningState.totalAssignmentsByRacer,
    planningState.pairCounts,
    standingsByRacer
  );

  if (participants.length < heatSize) {
    return null;
  }

  const lanes = assignLanes(
    participants,
    selectedLanes,
    planningState.laneNeedsByRacer,
    planningState.laneCountsByRacer,
    planningState.laneUsageTotals
  );

  if (!lanes) {
    return null;
  }

  return { lanes };
};

export const planHeatQueue = (input: PlanHeatQueueInput): PlannedHeat[] => {
  const lookahead = Math.max(1, input.lookahead);
  const forwardHeats = input.existingHeats.filter((heat) => heat.status !== "complete").length;

  if (forwardHeats >= lookahead) {
    return [];
  }

  const plannedHeats: PlannedHeat[] = [];
  const planningHeats = [...input.existingHeats];

  for (let i = forwardHeats; i < lookahead; i++) {
    const nextHeat = planNextHeat({
      racers: input.racers,
      laneCount: input.laneCount,
      rounds: input.rounds,
      standings: input.standings,
      existingHeats: planningHeats,
    });

    if (!nextHeat) {
      break;
    }

    plannedHeats.push(nextHeat);
    planningHeats.push({
      status: "pending",
      lanes: nextHeat.lanes,
    });
  }

  return plannedHeats;
};

export const clampLookahead = (lookahead?: number) => {
  return lookahead === 2 ? 2 : 3;
};

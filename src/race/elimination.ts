export interface EliminationRacer {
  id: string;
  car_number: string;
}

export interface EliminationStanding {
  racer_id: string;
  wins: number;
  losses: number;
  heats_run: number;
  avg_time_ms: number | null;
}

const compareCarNumbers = (a: string, b: string) => {
  const aNum = Number(a);
  const bNum = Number(b);

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }

  return a.localeCompare(b);
};

const compareAverageTimes = (a: number | null, b: number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

export const getNextFieldSize = (currentFieldSize: number) => {
  if (currentFieldSize <= 2) {
    return Math.max(1, currentFieldSize);
  }

  return Math.max(2, Math.ceil(currentFieldSize / 2));
};

export const buildEliminationPlan = (startingFieldSize: number) => {
  if (startingFieldSize <= 0) return [];

  const plan: number[] = [startingFieldSize];
  let currentFieldSize = startingFieldSize;

  while (currentFieldSize > 2) {
    const nextSize = getNextFieldSize(currentFieldSize);
    if (nextSize === currentFieldSize) {
      break;
    }
    plan.push(nextSize);
    currentFieldSize = nextSize;
  }

  return plan;
};

export const selectSurvivorsForNextRound = (
  activeRacers: EliminationRacer[],
  standings: EliminationStanding[]
) => {
  if (activeRacers.length <= 2) {
    return [...activeRacers];
  }

  const standingsByRacerId = new Map<string, EliminationStanding>();
  for (const standing of standings) {
    standingsByRacerId.set(standing.racer_id, standing);
  }

  const rankedRacers = [...activeRacers].sort((a, b) => {
    const standingA = standingsByRacerId.get(a.id);
    const standingB = standingsByRacerId.get(b.id);

    const winsA = standingA?.wins ?? 0;
    const winsB = standingB?.wins ?? 0;
    if (winsB !== winsA) return winsB - winsA;

    const lossesA = standingA?.losses ?? 0;
    const lossesB = standingB?.losses ?? 0;
    if (lossesA !== lossesB) return lossesA - lossesB;

    const avgTimeComparison = compareAverageTimes(
      standingA?.avg_time_ms ?? null,
      standingB?.avg_time_ms ?? null
    );
    if (avgTimeComparison !== 0) return avgTimeComparison;

    const heatsRunA = standingA?.heats_run ?? 0;
    const heatsRunB = standingB?.heats_run ?? 0;
    if (heatsRunB !== heatsRunA) return heatsRunB - heatsRunA;

    return compareCarNumbers(a.car_number, b.car_number);
  });

  const survivorsNeeded = getNextFieldSize(activeRacers.length);
  return rankedRacers.slice(0, survivorsNeeded);
};

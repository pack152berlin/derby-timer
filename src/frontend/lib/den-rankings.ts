/**
 * Den ranking utilities for certificates and standings.
 * Computes within-den placements from the overall standings array.
 */

interface RankedStanding {
  racer_id: string;
  wins: number;
  losses: number;
  avg_time_ms: number | null;
}

interface RacerWithDen {
  id: string;
  den: string | null;
}

/**
 * Returns standings filtered to a specific den, sorted by
 * wins DESC → losses ASC → avg_time ASC (same as overall).
 */
export function denRankings<T extends RankedStanding>(
  standings: T[],
  racers: RacerWithDen[],
  den: string,
): T[] {
  const racerDen = new Map<string, string | null>();
  for (const r of racers) {
    racerDen.set(r.id, r.den);
  }

  return standings
    .filter(s => racerDen.get(s.racer_id) === den)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return (a.avg_time_ms ?? Infinity) - (b.avg_time_ms ?? Infinity);
    });
}

/**
 * Returns the den placement for a specific racer.
 * Returns null if the racer has no den or isn't found in standings.
 */
export function denPlacement<T extends RankedStanding>(
  standings: T[],
  racers: RacerWithDen[],
  racerId: string,
): { rank: number; total: number; den: string } | null {
  const racer = racers.find(r => r.id === racerId);
  if (!racer?.den) return null;

  const ranked = denRankings(standings, racers, racer.den);
  const idx = ranked.findIndex(s => s.racer_id === racerId);
  if (idx === -1) return null;

  return { rank: idx + 1, total: ranked.length, den: racer.den };
}

/**
 * Returns false if the racer is in the bottom 2 of their den —
 * we never show a ranking that makes a kid feel bad.
 * Top 3 in a den are always shown regardless of den size.
 */
export function shouldShowDenRank(rank: number, total: number): boolean {
  if (rank <= 3) return true;
  if (total <= 2) return true;
  return rank <= total - 2;
}

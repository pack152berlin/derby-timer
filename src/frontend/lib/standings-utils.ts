import type { Heat } from '../types';

export interface RacerPlaceCounts {
  seconds: number;
  thirds: number;
}

/**
 * Aggregates 2nd and 3rd place finishes from all heats for every racer.
 */
export function calculatePlaceCounts(heats: Heat[]): Record<string, RacerPlaceCounts> {
  const counts: Record<string, RacerPlaceCounts> = {};
  
  for (const heat of heats) {
    if (!heat.results) continue;
    
    for (const result of heat.results) {
      if (!counts[result.racer_id]) {
        counts[result.racer_id] = { seconds: 0, thirds: 0 };
      }
      
      const racerCounts = counts[result.racer_id]!;
      
      if (!result.dnf) {
        if (result.place === 2) {
          racerCounts.seconds++;
        } else if (result.place === 3) {
          racerCounts.thirds++;
        }
      }
    }
  }
  
  return counts;
}

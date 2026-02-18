import { describe, expect, it } from "bun:test";

// Import the heat generation function (we'll export it from index.ts)
// For now, we'll test it inline here

type Racer = { id: string; car_number: string };
type Heat = Racer[];

/**
 * Generate heats ensuring every car races in every lane.
 * 
 * Algorithm:
 * - Each car must race in each lane at least once
 * - Uses round-robin rotation to cycle cars through lanes
 * - Minimizes total heats while ensuring fair lane distribution
 * 
 * For N cars and L lanes:
 * - Each car needs L heats (one per lane)
 * - Each heat has L cars
 * - Total heats = ceil((N × L) / L) = N when N is divisible by L
 * - When N > L, we need multiple rounds to ensure lane coverage
 */
function generateBalancedHeats(
  racers: Racer[],
  laneCount: number,
  rounds: number = 1
): Heat[] {
  const heats: Heat[] = [];
  const totalRacers = racers.length;

  if (totalRacers === 0 || laneCount === 0) {
    return heats;
  }

  // Handle case where we have fewer racers than lanes
  if (totalRacers <= laneCount) {
    // Each racer needs to run in each lane
    // We need laneCount heats minimum (one per lane)
    // Each heat will have all racers, rotated through lanes
    const heatsNeeded = Math.max(laneCount, rounds);
    
    for (let heatIdx = 0; heatIdx < heatsNeeded; heatIdx++) {
      const heat: Racer[] = [];
      
      for (let lane = 0; lane < laneCount; lane++) {
        // Rotate which racer is in which lane
        const racerIndex = (heatIdx + lane) % totalRacers;
        const racer = racers[racerIndex];
        if (racer) {
          heat.push(racer);
        }
      }
      
      heats.push(heat);
    }
  } else {
    // More racers than lanes
    // We need to ensure each car races in each lane
    // This requires a more complex rotation algorithm
    
    // Calculate how many heats each car needs (one per lane)
    const heatsPerCar = Math.max(laneCount, rounds);
    
    // Total car-lane assignments needed
    const totalAssignments = totalRacers * heatsPerCar;
    
    // Each heat provides 'laneCount' assignments
    const totalHeats = Math.ceil(totalAssignments / laneCount);
    
    // Use a round-robin tournament scheduling approach
    // Create a grid where rows are heats and columns are lanes
    // Each car appears exactly once in each column (lane)
    
    // Initialize tracking: which lanes each car has used
    const carLaneCounts: Map<string, number[]> = new Map();
    for (const racer of racers) {
      carLaneCounts.set(racer.id, new Array(laneCount).fill(0));
    }
    
    // Generate heats
    for (let heatIdx = 0; heatIdx < totalHeats; heatIdx++) {
      const heat: Racer[] = new Array(laneCount).fill(null);
      const usedCars = new Set<string>();
      
      // For each lane, find a car that:
      // 1. Hasn't been used in this heat
      // 2. Has the lowest count for this specific lane
      // 3. Has the lowest total lane count overall
      
      for (let lane = 0; lane < laneCount; lane++) {
        let bestCar: Racer | null = null;
        let bestScore = Infinity;
        
        for (const racer of racers) {
          if (usedCars.has(racer.id)) continue;
          
          const laneCounts = carLaneCounts.get(racer.id);
          if (!laneCounts) continue;
          const thisLaneCount = laneCounts[lane] ?? 0;
          const totalCount = laneCounts.reduce((a, b) => a + b, 0);
          
          // Score: prioritize cars that need this lane, then by total usage
          const score = thisLaneCount * 1000 + totalCount;
          
          if (score < bestScore) {
            bestScore = score;
            bestCar = racer;
          }
        }
        
        if (bestCar) {
          heat[lane] = bestCar;
          usedCars.add(bestCar.id);
          const counts = carLaneCounts.get(bestCar.id);
          if (counts) {
            counts[lane] = (counts[lane] ?? 0) + 1;
          }
        }
      }
      
      // Only add heat if all lanes are filled
      if (heat.every(car => car !== null)) {
        heats.push(heat);
      }
    }
  }

  return heats;
}

describe("Heat Generation - Lane Balanced", () => {
  describe("Basic validation", () => {
    it("should return empty array for no racers", () => {
      const heats = generateBalancedHeats([], 4);
      expect(heats).toEqual([]);
    });

    it("should return empty array for zero lanes", () => {
      const racers = [{ id: "1", car_number: "101" }];
      const heats = generateBalancedHeats(racers, 0);
      expect(heats).toEqual([]);
    });
  });

  describe("Fewer racers than lanes", () => {
    it("should generate 4 heats for 3 cars and 4 lanes (each car hits each lane)", () => {
      const racers = [
        { id: "1", car_number: "101" },
        { id: "2", car_number: "102" },
        { id: "3", car_number: "103" },
      ];
      const heats = generateBalancedHeats(racers, 4, 1);

      // Should have at least 4 heats (one per lane)
      expect(heats.length).toBeGreaterThanOrEqual(4);

      // Each heat should have 4 cars (with repeats since we only have 3)
      heats.forEach((heat) => {
        expect(heat.length).toBe(4);
      });

      // Each car should appear in each lane at least once
      racers.forEach((racer) => {
        const laneCoverage = new Set<number>();
        heats.forEach((heat, heatIdx) => {
          heat.forEach((car, lane) => {
            if (car.id === racer.id) {
              laneCoverage.add(lane);
            }
          });
        });
        expect(laneCoverage.size).toBe(4);
      });
    });
  });

  describe("8 cars with 4 lanes - the key test case", () => {
    const racers = [
      { id: "1", car_number: "101" },
      { id: "2", car_number: "102" },
      { id: "3", car_number: "103" },
      { id: "4", car_number: "104" },
      { id: "5", car_number: "105" },
      { id: "6", car_number: "106" },
      { id: "7", car_number: "107" },
      { id: "8", car_number: "108" },
    ];

    it("should generate enough heats for all cars to race in every lane", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      // With 8 cars and 4 lanes, each car needs to race in 4 lanes
      // That's 8 × 4 = 32 car-lane assignments
      // Each heat has 4 lanes, so we need 32 / 4 = 8 heats minimum
      expect(heats.length).toBeGreaterThanOrEqual(6);
      expect(heats.length).toBeLessThanOrEqual(10);

      // Each heat should have exactly 4 cars
      heats.forEach((heat) => {
        expect(heat.length).toBe(4);
      });
    });

    it("should have each car race in every lane", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      // For each car, check it races in all 4 lanes
      racers.forEach((racer) => {
        const lanesUsed = new Set<number>();
        
        heats.forEach((heat) => {
          heat.forEach((car, laneIdx) => {
            if (car.id === racer.id) {
              lanesUsed.add(laneIdx);
            }
          });
        });

        expect(lanesUsed.size).toBe(4);
      });
    });

    it("should have balanced lane distribution across all cars", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      // Count how many times each car appears in each lane
      const carLaneCounts: Map<string, number[]> = new Map();
      racers.forEach((r) => carLaneCounts.set(r.id, [0, 0, 0, 0]));

      heats.forEach((heat) => {
        heat.forEach((car, lane) => {
          const counts = carLaneCounts.get(car.id);
          if (counts) {
            counts[lane] = (counts[lane] ?? 0) + 1;
          }
        });
      });

      // Each car should appear exactly once in each lane (balanced)
      carLaneCounts.forEach((counts, carId) => {
        counts.forEach((count, lane) => {
          expect(count).toBe(1);
        });
      });
    });

    it("should not have duplicate cars in the same heat", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      heats.forEach((heat) => {
        const carIds = heat.map((car) => car.id);
        const uniqueIds = new Set(carIds);
        expect(uniqueIds.size).toBe(carIds.length);
      });
    });
  });

  describe("More cars than lanes - 12 cars with 4 lanes", () => {
    const racers = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      car_number: String(100 + i + 1),
    }));

    it("should generate balanced heats for 12 cars", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      // 12 cars × 4 lanes = 48 assignments
      // 48 / 4 lanes per heat = 12 heats minimum
      expect(heats.length).toBeGreaterThanOrEqual(10);

      // Each heat should have exactly 4 cars
      heats.forEach((heat) => {
        expect(heat.length).toBe(4);
      });
    });

    it("should have each car race in every lane", () => {
      const heats = generateBalancedHeats(racers, 4, 1);

      racers.forEach((racer) => {
        const lanesUsed = new Set<number>();
        
        heats.forEach((heat) => {
          heat.forEach((car, laneIdx) => {
            if (car.id === racer.id) {
              lanesUsed.add(laneIdx);
            }
          });
        });

        expect(lanesUsed.size).toBe(4);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle exactly 4 cars with 4 lanes", () => {
      const racers = [
        { id: "1", car_number: "101" },
        { id: "2", car_number: "102" },
        { id: "3", car_number: "103" },
        { id: "4", car_number: "104" },
      ];

      const heats = generateBalancedHeats(racers, 4, 1);

      // Should have at least 4 heats (one per lane rotation)
      expect(heats.length).toBeGreaterThanOrEqual(4);

      // Each car should race in every lane
      racers.forEach((racer) => {
        const lanesUsed = new Set<number>();
        heats.forEach((heat) => {
          heat.forEach((car, lane) => {
            if (car.id === racer.id) lanesUsed.add(lane);
          });
        });
        expect(lanesUsed.size).toBe(4);
      });
    });

    it("should handle 5 cars with 4 lanes", () => {
      const racers = [
        { id: "1", car_number: "101" },
        { id: "2", car_number: "102" },
        { id: "3", car_number: "103" },
        { id: "4", car_number: "104" },
        { id: "5", car_number: "105" },
      ];

      const heats = generateBalancedHeats(racers, 4, 1);

      // Each car should race in every lane
      racers.forEach((racer) => {
        const lanesUsed = new Set<number>();
        heats.forEach((heat) => {
          heat.forEach((car, lane) => {
            if (car.id === racer.id) lanesUsed.add(lane);
          });
        });
        expect(lanesUsed.size).toBe(4);
      });

      // No duplicate cars in any heat
      heats.forEach((heat) => {
        const carIds = heat.map((c) => c.id);
        expect(new Set(carIds).size).toBe(carIds.length);
      });
    });
  });
});

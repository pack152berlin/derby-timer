import { describe, expect, it } from 'bun:test';
import { classifyRacer } from '../src/frontend/lib/certificate-stats';
import type { Racer, Standing } from '../src/frontend/types';

// Minimal factories — only fields classifyRacer actually reads
const standing = (racer_id: string, wins = 0, losses = 0): Standing => ({
  racer_id, wins, losses, car_number: '1', racer_name: '', heats_run: 0, avg_time_ms: null,
});

const racer = (id: string, den: string | null = null): Racer => ({
  id, event_id: 'e1', name: '', den, car_number: '1',
  weight_ok: 1, inspected_at: null, car_photo_filename: null,
  created_at: '', updated_at: '',
});

// Build a standings array of N racers, all in order
function makeStandings(n: number): Standing[] {
  return Array.from({ length: n }, (_, i) => standing(`r${i + 1}`, n - i, i));
}

function makeRacers(n: number, den: string | null = null): Racer[] {
  return Array.from({ length: n }, (_, i) => racer(`r${i + 1}`, den));
}

describe('classifyRacer', () => {
  const standings = makeStandings(15);

  describe('podium', () => {
    const racers = makeRacers(15);

    it('1st place → podium', () => {
      expect(classifyRacer(standings, racers, 'r1')).toEqual({ type: 'podium', place: 1 });
    });

    it('2nd place → podium', () => {
      expect(classifyRacer(standings, racers, 'r2')).toEqual({ type: 'podium', place: 2 });
    });

    it('3rd place → podium', () => {
      expect(classifyRacer(standings, racers, 'r3')).toEqual({ type: 'podium', place: 3 });
    });
  });

  describe('top5', () => {
    const racers = makeRacers(15);

    it('4th place → top5', () => {
      expect(classifyRacer(standings, racers, 'r4')).toEqual({ type: 'top5', place: 4 });
    });

    it('5th place → top5', () => {
      expect(classifyRacer(standings, racers, 'r5')).toEqual({ type: 'top5', place: 5 });
    });
  });

  describe('top10', () => {
    const racers = makeRacers(15);

    it('6th place → top10', () => {
      expect(classifyRacer(standings, racers, 'r6')).toEqual({ type: 'top10', place: 6 });
    });

    it('10th place → top10', () => {
      expect(classifyRacer(standings, racers, 'r10')).toEqual({ type: 'top10', place: 10 });
    });
  });

  describe('den_champion', () => {
    it('1st in den (outside top 10) → den_champion', () => {
      // r11 is 11th overall, 1st in a 4-person Wolves den
      const racers = [
        ...makeRacers(10),
        racer('r11', 'Wolves'), racer('r12', 'Wolves'),
        racer('r13', 'Wolves'), racer('r14', 'Wolves'),
        racer('r15', null),
      ];
      const tier = classifyRacer(standings, racers, 'r11');
      expect(tier).toEqual({ type: 'den_champion', rank: 1, den: 'Wolves', overallPlace: 11 });
    });
  });

  describe('den_top3', () => {
    it('2nd in den (outside top 10) → den_top3', () => {
      const racers = [
        ...makeRacers(10),
        racer('r11', 'Bears'), racer('r12', 'Bears'),
        racer('r13', 'Bears'), racer('r14', 'Bears'),
        racer('r15', null),
      ];
      const tier = classifyRacer(standings, racers, 'r12');
      expect(tier).toEqual({ type: 'den_top3', rank: 2, den: 'Bears', overallPlace: 12 });
    });

    it('bottom 2 of den are hidden → falls through to achievement', () => {
      // 4-person den: ranks 3 and 4 are hidden (bottom 2)
      const racers = [
        ...makeRacers(10),
        racer('r11', 'Tigers'), racer('r12', 'Tigers'),
        racer('r13', 'Tigers'), racer('r14', 'Tigers'),
        racer('r15', null),
      ];
      const tier = classifyRacer(standings, racers, 'r13');
      expect(tier).toEqual({ type: 'achievement', overallPlace: 13 });
    });
  });

  describe('achievement', () => {
    it('racer outside top 10 with no den → achievement', () => {
      const racers = makeRacers(15);
      const tier = classifyRacer(standings, racers, 'r11');
      expect(tier).toEqual({ type: 'achievement', overallPlace: 11 });
    });

    it('racer in tiny 2-person den gets den_champion not achievement', () => {
      // 2-person den: shouldShowDenRank always returns true
      const racers = [
        ...makeRacers(10),
        racer('r11', 'AOLs'), racer('r12', 'AOLs'),
        racer('r13', null), racer('r14', null), racer('r15', null),
      ];
      const tier = classifyRacer(standings, racers, 'r11');
      expect(tier).toEqual({ type: 'den_champion', rank: 1, den: 'AOLs', overallPlace: 11 });
    });

    it('2nd in 2-person den still gets den_top3', () => {
      const racers = [
        ...makeRacers(10),
        racer('r11', 'AOLs'), racer('r12', 'AOLs'),
        racer('r13', null), racer('r14', null), racer('r15', null),
      ];
      const tier = classifyRacer(standings, racers, 'r12');
      expect(tier).toEqual({ type: 'den_top3', rank: 2, den: 'AOLs', overallPlace: 12 });
    });
  });

  describe('edge cases', () => {
    it('top-10 racer ignores den ranking even if they are den champion', () => {
      // r5 is 5th overall AND 1st in Wolves — top5 wins
      const racers = [
        racer('r1', 'Wolves'), racer('r2', null), racer('r3', null),
        racer('r4', null), racer('r5', 'Wolves'),
        ...Array.from({ length: 10 }, (_, i) => racer(`r${i + 6}`, null)),
      ];
      const tier = classifyRacer(standings, racers, 'r5');
      expect(tier.type).toBe('top5');
    });

    it('racer not in standings at all gets overallPlace 0 → achievement', () => {
      const racers = [racer('ghost', null)];
      const tier = classifyRacer([], racers, 'ghost');
      expect(tier).toEqual({ type: 'achievement', overallPlace: 0 });
    });
  });
});

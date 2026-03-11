import { describe, expect, it } from 'bun:test';
import { denRankings, denPlacement, shouldShowDenRank } from '../src/frontend/lib/den-rankings';

const standing = (id: string, wins: number, losses: number, avg_time_ms: number | null = null) =>
  ({ racer_id: id, wins, losses, avg_time_ms });

const racer = (id: string, den: string | null) => ({ id, den });

describe('denRankings', () => {
  it('filters standings to the given den', () => {
    const standings = [standing('a', 3, 0), standing('b', 2, 1), standing('c', 1, 2)];
    const racers = [racer('a', 'Wolves'), racer('b', 'Tigers'), racer('c', 'Wolves')];
    const result = denRankings(standings, racers, 'Wolves');
    expect(result.map(s => s.racer_id)).toEqual(['a', 'c']);
  });

  it('sorts by wins DESC, losses ASC, avg_time ASC', () => {
    const standings = [
      standing('a', 2, 1, 3500),
      standing('b', 2, 1, 3200),
      standing('c', 3, 0, 3000),
    ];
    const racers = [racer('a', 'Bears'), racer('b', 'Bears'), racer('c', 'Bears')];
    const result = denRankings(standings, racers, 'Bears');
    expect(result.map(s => s.racer_id)).toEqual(['c', 'b', 'a']);
  });

  it('returns empty array when no racers in den', () => {
    const standings = [standing('a', 3, 0)];
    const racers = [racer('a', 'Lions')];
    expect(denRankings(standings, racers, 'Tigers')).toEqual([]);
  });

  it('treats null avg_time as worst (Infinity)', () => {
    const standings = [
      standing('a', 2, 1, null),
      standing('b', 2, 1, 3000),
    ];
    const racers = [racer('a', 'Wolves'), racer('b', 'Wolves')];
    const result = denRankings(standings, racers, 'Wolves');
    expect(result.map(s => s.racer_id)).toEqual(['b', 'a']);
  });
});

describe('denPlacement', () => {
  it('returns rank and total for a racer in their den', () => {
    const standings = [standing('a', 3, 0), standing('b', 2, 1), standing('c', 1, 2)];
    const racers = [racer('a', 'Wolves'), racer('b', 'Wolves'), racer('c', 'Wolves')];
    expect(denPlacement(standings, racers, 'b')).toEqual({ rank: 2, total: 3, den: 'Wolves' });
  });

  it('returns null for racer with no den', () => {
    const standings = [standing('a', 3, 0)];
    const racers = [racer('a', null)];
    expect(denPlacement(standings, racers, 'a')).toBeNull();
  });

  it('returns null for racer not found in standings', () => {
    const standings = [standing('a', 3, 0)];
    const racers = [racer('a', 'Lions'), racer('b', 'Lions')];
    expect(denPlacement(standings, racers, 'b')).toBeNull();
  });

  it('returns null for unknown racer id', () => {
    const standings = [standing('a', 3, 0)];
    const racers = [racer('a', 'Lions')];
    expect(denPlacement(standings, racers, 'unknown')).toBeNull();
  });
});

describe('shouldShowDenRank', () => {
  it('always shows rank in 1-person den', () => {
    expect(shouldShowDenRank(1, 1)).toBe(true);
  });

  it('always shows rank in 2-person den', () => {
    expect(shouldShowDenRank(1, 2)).toBe(true);
    expect(shouldShowDenRank(2, 2)).toBe(true);
  });

  it('shows top racers in 3-person den (rank 1 only)', () => {
    expect(shouldShowDenRank(1, 3)).toBe(true);
    expect(shouldShowDenRank(2, 3)).toBe(false);
    expect(shouldShowDenRank(3, 3)).toBe(false);
  });

  it('hides bottom 2 in larger dens', () => {
    // 5-person den: show ranks 1-3, hide 4-5
    expect(shouldShowDenRank(1, 5)).toBe(true);
    expect(shouldShowDenRank(3, 5)).toBe(true);
    expect(shouldShowDenRank(4, 5)).toBe(false);
    expect(shouldShowDenRank(5, 5)).toBe(false);
  });

  it('hides bottom 2 in 4-person den', () => {
    expect(shouldShowDenRank(1, 4)).toBe(true);
    expect(shouldShowDenRank(2, 4)).toBe(true);
    expect(shouldShowDenRank(3, 4)).toBe(false);
    expect(shouldShowDenRank(4, 4)).toBe(false);
  });
});

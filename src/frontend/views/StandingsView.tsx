import React, { useState, useMemo } from 'react';
import { Trophy, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '../context';
import { SearchInput } from '../components/SearchInput';
import { CUB_SCOUT_DENS } from '../constants';
import { calculatePlaceCounts } from '../lib/standings-utils';
import { StandingHeader, type SortCol, type SortDir } from './standings/StandingHeader';
import { StandingRow } from './standings/StandingRow';

export function StandingsView() {
  const { standings, racers, heats, setCurrentRacerId } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [denFilter, setDenFilter] = useState<string>('all');

  const placeCountsByRacer = useMemo(() => {
    return calculatePlaceCounts(heats);
  }, [heats]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const displayedStandings = useMemo(() => {
    let result = standings.map((s, i) => ({
      ...s,
      rank: i + 1,
      den: racers.find(r => r.id === s.racer_id)?.den ?? null,
    }));

    if (denFilter !== 'all') {
      result = result.filter(s => s.den === denFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.racer_name.toLowerCase().includes(q) || s.car_number.includes(q)
      );
    }

    result.sort((a, b) => {
      const ca = placeCountsByRacer[a.racer_id] ?? { seconds: 0, thirds: 0 };
      const cb = placeCountsByRacer[b.racer_id] ?? { seconds: 0, thirds: 0 };
      let cmp = 0;
      switch (sortCol) {
        case 'rank':    cmp = a.rank - b.rank; break;
        case 'car':     cmp = parseInt(a.car_number) - parseInt(b.car_number); break;
        case 'name':    cmp = a.racer_name.localeCompare(b.racer_name); break;
        case 'den':     cmp = (a.den ?? '').localeCompare(b.den ?? ''); break;
        case 'wins':    cmp = a.wins - b.wins; break;
        case 'seconds': cmp = ca.seconds - cb.seconds; break;
        case 'thirds':  cmp = ca.thirds - cb.thirds; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [standings, racers, heats, denFilter, searchTerm, sortCol, sortDir, placeCountsByRacer]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
          Race Standings
        </h1>
        <p className="text-slate-500 mt-1">
          Ranked by wins, then losses, then average time
        </p>
      </div>

      {standings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Name or car #"
            className="flex-1 min-w-[180px]"
          />

          <Select value={denFilter} onValueChange={setDenFilter}>
            <SelectTrigger className="h-9 bg-white border-slate-300 w-[140px] text-sm font-bold">
              <SelectValue placeholder="All Dens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dens</SelectItem>
              {CUB_SCOUT_DENS.map(den => (
                <SelectItem key={den} value={den}>{den}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {standings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No results yet</p>
            <p className="text-slate-400">Run some heats to see the standings</p>
          </CardContent>
        </Card>
      ) : displayedStandings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No racers match</p>
            <p className="text-slate-400">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : (
        <div
          className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-y-auto min-h-[24rem]"
          style={{ maxHeight: 'calc(100vh - 20rem)' }}
        >
          <StandingHeader sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />

          {displayedStandings.map((standing, idx) => {
            const { seconds = 0, thirds = 0 } = placeCountsByRacer[standing.racer_id] ?? {};
            return (
              <StandingRow
                key={standing.racer_id}
                standing={standing}
                idx={idx}
                seconds={seconds}
                thirds={thirds}
                onClick={() => setCurrentRacerId(standing.racer_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

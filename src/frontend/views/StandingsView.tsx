import React, { useState, useMemo } from 'react';
import { Trophy, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useApp } from '../context';
import { CUB_SCOUT_DENS } from '../constants';

export function StandingsView() {
  const { standings, racers, setCurrentRacerId } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'car'>('rank');
  const [denFilter, setDenFilter] = useState<string>('all');

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', numBg: 'bg-yellow-400' };
    if (rank === 2) return { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700', numBg: 'bg-slate-400' };
    if (rank === 3) return { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-700', numBg: 'bg-amber-600' };
    return { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700', numBg: 'bg-slate-300' };
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

    if (sortBy === 'car') {
      result.sort((a, b) => parseInt(a.car_number) - parseInt(b.car_number));
    }

    return result;
  }, [standings, racers, denFilter, searchTerm, sortBy]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
          Race Standings
        </h1>
        <p className="text-slate-500 mt-1">
          Ranked by wins, then losses, then average time
        </p>
      </div>

      {standings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm mb-6">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Name or car #"
              className="h-7 border-0 bg-transparent p-0 text-xs font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
            />
          </div>

          {/* Den filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Den:</span>
            <Select value={denFilter} onValueChange={setDenFilter}>
              <SelectTrigger className="h-8 bg-white border-slate-300 w-[120px] text-xs font-bold">
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

          {/* Sort switch */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort:</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-bold uppercase transition-colors",
                sortBy === 'rank' ? "text-slate-900" : "text-slate-400"
              )}>
                Rank
              </span>
              <Switch
                checked={sortBy === 'car'}
                onCheckedChange={(checked) => setSortBy(checked ? 'car' : 'rank')}
                className="data-[size=default]:h-5 data-[size=default]:w-9"
              />
              <span className={cn(
                "text-xs font-bold uppercase transition-colors",
                sortBy === 'car' ? "text-[#003F87]" : "text-slate-400"
              )}>
                Car #
              </span>
            </div>
          </div>
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
        <div className="space-y-3">
          {displayedStandings.map((standing) => {
            const { rank } = standing;
            const style = getRankStyle(rank);
            return (
              <Card
                key={standing.racer_id}
                data-testid={`standing-card-${standing.car_number}`}
                className={cn(
                  "border-2 cursor-pointer hover:scale-[1.01] transition-all active:scale-95",
                  style.bg, style.border
                )}
                onClick={() => setCurrentRacerId(standing.racer_id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Rank badge */}
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                    style.numBg,
                    rank <= 3 ? 'text-slate-900' : 'text-white'
                  )}>
                    {rank === 1 ? (
                      <Trophy className="w-6 h-6 text-slate-900" />
                    ) : (
                      <span className="text-xl font-black">{rank}</span>
                    )}
                  </div>

                  {/* Car number */}
                  <div className="w-16 text-center shrink-0">
                    <p className="text-2xl font-black text-[#003F87]">#{standing.car_number}</p>
                  </div>

                  {/* Name + den */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-slate-900 truncate">{standing.racer_name}</p>
                    {standing.den && (
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#CE1126] text-white mt-0.5">
                        {standing.den}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 sm:gap-6 text-center shrink-0">
                    <div>
                      <p className="text-2xl font-black text-emerald-600">{standing.wins}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">Wins</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-700">{standing.losses}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">Losses</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-2xl font-black text-slate-700">{standing.heats_run}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">Heats</p>
                    </div>
                    {standing.avg_time_ms && (
                      <div className="hidden md:block">
                        <p className="text-2xl font-black text-slate-700">{(standing.avg_time_ms / 1000).toFixed(3)}s</p>
                        <p className="text-xs text-slate-500 uppercase font-bold">Avg Time</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

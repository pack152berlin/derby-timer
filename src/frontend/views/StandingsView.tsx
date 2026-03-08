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

import lionImg    from '../assets/dens/lion-rank-normalized.png';
import tigersImg  from '../assets/dens/tigers-rank-normalized.png';
import wolvesImg  from '../assets/dens/wolves-rank-normalized.png';
import bearsImg   from '../assets/dens/bears-rank-normalized.png';
import webelosImg from '../assets/dens/webelos-rank-normalized.png';
import aolImg     from '../assets/dens/aol-rank-normalized.png';

const DEN_IMAGES: Record<string, string> = {
  'Lions':   lionImg,
  'Tigers':  tigersImg,
  'Wolves':  wolvesImg,
  'Bears':   bearsImg,
  'Webelos': webelosImg,
  'AOLs':    aolImg,
};

function DenBadge({ den }: { den: string }) {
  const img = DEN_IMAGES[den];
  if (img) {
    return <img src={img} alt={den} title={den} className="h-9 w-9 object-contain" />;
  }
  return (
    <span className="inline-block text-sm font-black tracking-widest leading-none text-slate-700">
      {den}
    </span>
  );
}

function ordinal(n: number) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

const RANK_ACCENT: Record<number, string> = {
  1: 'border-l-amber-400 bg-amber-50/40',
  2: 'border-l-slate-300 bg-slate-50/30',
  3: 'border-l-orange-400 bg-orange-50/20',
};

const RANK_TEXT: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-500',
  3: 'text-orange-600',
};

export function StandingsView() {
  const { standings, racers, heats, setCurrentRacerId } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'car'>('rank');
  const [denFilter, setDenFilter] = useState<string>('all');

  const placeCountsByRacer = useMemo(() => {
    const counts: Record<string, { seconds: number; thirds: number }> = {};
    for (const heat of heats) {
      for (const result of heat.results ?? []) {
        if (!counts[result.racer_id]) counts[result.racer_id] = { seconds: 0, thirds: 0 };
        if (result.place === 2 && !result.dnf) counts[result.racer_id].seconds++;
        if (result.place === 3 && !result.dnf) counts[result.racer_id].thirds++;
      }
    }
    return counts;
  }, [heats]);

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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Name or car #"
              className="h-7 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm font-black uppercase tracking-widest text-slate-400">Den:</span>
            <Select value={denFilter} onValueChange={setDenFilter}>
              <SelectTrigger className="h-8 bg-white border-slate-300 w-[120px] text-sm font-bold">
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

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm font-black uppercase tracking-widest text-slate-400">Sort:</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-bold uppercase transition-colors",
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
                "text-sm font-bold uppercase transition-colors",
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
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          {/* Column header */}
          <div className="flex items-center px-4 py-2 bg-slate-50 border-b border-slate-200 border-l-4 border-l-transparent">
            <div className="w-14 shrink-0">
              <span className="text-sm font-black uppercase tracking-widest text-slate-400">Rank</span>
            </div>
            <div className="w-14 shrink-0">
              <span className="text-sm font-black uppercase tracking-widest text-slate-400">Car</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black uppercase tracking-widest text-slate-400">Racer</span>
            </div>
            <div className="w-28 shrink-0">
              <span className="text-sm font-black uppercase tracking-widest text-slate-400">Den</span>
            </div>
            <div className="flex items-center shrink-0">
              <div className="w-14 text-center">
                <span className="text-sm font-black uppercase tracking-widest text-amber-500">Wins</span>
              </div>
              <div className="w-12 text-center">
                <span className="text-sm font-black uppercase tracking-widest text-slate-400">2nd</span>
              </div>
              <div className="w-12 text-center">
                <span className="text-sm font-black uppercase tracking-widest text-orange-400">3rd</span>
              </div>
            </div>
          </div>

          {displayedStandings.map((standing, idx) => {
            const { rank } = standing;
            const accent = RANK_ACCENT[rank] ?? 'border-l-transparent bg-white';
            const rankTextClass = RANK_TEXT[rank] ?? 'text-slate-400';
            const { seconds = 0, thirds = 0 } = placeCountsByRacer[standing.racer_id] ?? {};

            return (
              <div
                key={standing.racer_id}
                data-testid={`standing-card-${standing.car_number}`}
                className={cn(
                  "flex items-center px-4 py-3 cursor-pointer transition-colors border-l-4",
                  "hover:brightness-[0.97] active:brightness-95",
                  idx > 0 && "border-t border-slate-100",
                  accent,
                )}
                onClick={() => setCurrentRacerId(standing.racer_id)}
              >
                {/* Rank ordinal */}
                <div className="w-14 shrink-0 flex items-center gap-1">
                  {rank === 1 && <Trophy size={12} className="text-amber-400 shrink-0" />}
                  <span className={cn("text-sm font-black leading-none tabular-nums", rankTextClass)}>
                    {ordinal(rank)}
                  </span>
                </div>

                {/* Car number */}
                <div className="w-14 shrink-0">
                  <span className="text-base font-black text-[#003F87] leading-none">
                    #{standing.car_number}
                  </span>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-slate-900 leading-tight truncate">
                    {standing.racer_name}
                  </p>
                </div>

                {/* Den */}
                <div className="w-28 shrink-0">
                  {standing.den && <DenBadge den={standing.den} />}
                </div>

                {/* Stats */}
                <div className="flex items-center shrink-0">
                  <div className="w-14 text-center">
                    <p className={cn(
                      "text-xl font-black leading-none tabular-nums",
                      standing.wins > 0 ? "text-amber-600" : "text-slate-200"
                    )}>
                      {standing.wins}
                    </p>
                  </div>
                  <div className="w-12 text-center">
                    <p className={cn(
                      "text-xl font-black leading-none tabular-nums",
                      seconds > 0 ? "text-slate-600" : "text-slate-200"
                    )}>
                      {seconds}
                    </p>
                  </div>
                  <div className="w-12 text-center">
                    <p className={cn(
                      "text-xl font-black leading-none tabular-nums",
                      thirds > 0 ? "text-orange-600" : "text-slate-200"
                    )}>
                      {thirds}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

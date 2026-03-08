import React, { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useApp } from '../context';
import { SearchInput } from '../components/SearchInput';
import { CUB_SCOUT_DENS } from '../constants';
import { calculatePlaceCounts } from '../lib/standings-utils';

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

type SortCol = 'rank' | 'car' | 'name' | 'den' | 'wins' | 'seconds' | 'thirds';
type SortDir = 'asc' | 'desc';

function SortTriangle({ dir, visible }: { dir: SortDir; visible: boolean }) {
  return (
    <svg
      width="8" height="6" viewBox="0 0 8 6"
      fill="currentColor"
      className={cn("shrink-0 transition-opacity", !visible && "opacity-0")}
    >
      {dir === 'asc'
        ? <path d="M4 0L8 6H0L4 0Z" />
        : <path d="M4 6L0 0H8L4 6Z" />}
    </svg>
  );
}

// Column widths — shared between header and data rows so they always align
const COL = {
  rank: 'w-24 shrink-0',   // wide enough for left edge padding + "RANK" + chevron
  car:  'w-14 shrink-0',
  name: 'flex-1 min-w-0',
  den:  'w-28 shrink-0',
  wins: 'w-14 shrink-0',
  sec:  'w-12 shrink-0',
  thi:  'w-12 shrink-0',
};

function SortHeader({
  col, label,
  activeTextClass = 'text-slate-800',
  inactiveClass = 'text-slate-400 hover:text-slate-600',
  center = false,
  sortCol, sortDir, onSort,
}: {
  col: SortCol;
  label: string;
  activeTextClass?: string;
  inactiveClass?: string;
  center?: boolean;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
}) {
  const active = sortCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={cn(
        'w-full flex items-center gap-1.5 text-sm font-black uppercase tracking-normal',
        'transition-colors select-none cursor-pointer outline-none focus:outline-none',
        center && 'justify-center',
        active ? activeTextClass : inactiveClass,
      )}
    >
      {label}
      <SortTriangle dir={sortDir} visible={active} />
    </button>
  );
}

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

  const sortProps = { sortCol, sortDir, onSort: handleSort };
  const colBg = (col: SortCol, active: string) => sortCol === col ? active : 'bg-slate-50';

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
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <SearchInput
            variant="compact"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Name or car #"
            className="flex-1 min-w-[180px]"
          />

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
          {/* ── Sticky header ────────────────────────────────────────────────────
              Each cell owns its bg so the highlight is perfectly flush
              top-to-bottom and edge-to-edge with the column below.
              Rank absorbs the left edge; 3rd absorbs the right edge.
          ──────────────────────────────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 flex items-stretch border-b border-slate-200">
            {/* Rank — pl-4 absorbs the left edge so bg is fully flush */}
            <div className={cn(COL.rank, 'flex items-center pl-4 pr-2 py-2', colBg('rank', 'bg-slate-200'))}>
              <SortHeader col="rank" label="Rank" {...sortProps} />
            </div>
            <div className={cn(COL.car, 'flex items-center justify-center px-5 py-2', colBg('car', 'bg-slate-200'))}>
              <SortHeader col="car" label="Car" center {...sortProps} />
            </div>
            <div className={cn(COL.name, 'flex items-center px-2 py-2', colBg('name', 'bg-slate-200'))}>
              <SortHeader col="name" label="Racer" {...sortProps} />
            </div>
            <div className={cn(COL.den, 'flex items-center justify-center px-2 py-2', colBg('den', 'bg-slate-200'))}>
              <SortHeader col="den" label="Den" center {...sortProps} />
            </div>
            <div className={cn(COL.wins, 'flex items-center justify-center px-5 py-2', colBg('wins', 'bg-amber-100'))}>
              <SortHeader
                col="wins" label="Wins"
                activeTextClass="text-amber-800"
                inactiveClass="text-amber-500 hover:text-amber-700"
                center {...sortProps}
              />
            </div>
            <div className={cn(COL.sec, 'flex items-center justify-center px-5 py-2', colBg('seconds', 'bg-slate-200'))}>
              <SortHeader
                col="seconds" label="2nd"
                activeTextClass="text-slate-700"
                inactiveClass="text-slate-400 hover:text-slate-600"
                center {...sortProps}
              />
            </div>
            {/* 3rd — pr-4 absorbs the right edge so bg is fully flush */}
            <div className={cn(COL.thi, 'flex items-center justify-center px-1 py-2', colBg('thirds', 'bg-orange-100'))}>
              <SortHeader
                col="thirds" label="3rd"
                activeTextClass="text-orange-700"
                inactiveClass="text-orange-400 hover:text-orange-600"
                center {...sortProps}
              />
            </div>
          </div>

          {/* ── Data rows ─────────────────────────────────────────────────────── */}
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
                  "flex items-center py-3 cursor-pointer transition-colors border-l-4",
                  "hover:brightness-[0.97] active:brightness-95",
                  idx > 0 && "border-t border-slate-100",
                  accent,
                )}
                onClick={() => setCurrentRacerId(standing.racer_id)}
              >
                {/* Rank — pl-4 matches header */}
                <div className={cn(COL.rank, "flex items-center gap-1 pl-4 pr-2")}>
                  {rank === 1 && <Trophy size={12} className="text-amber-400 shrink-0" />}
                  <span className={cn("text-sm font-black leading-none tabular-nums", rankTextClass)}>
                    {ordinal(rank)}
                  </span>
                </div>

                <div className={cn(COL.car, "px-2 flex justify-center")}>
                  <span className="text-base font-black text-[#003F87] leading-none">
                    #{standing.car_number}
                  </span>
                </div>

                <div className={cn(COL.name, "px-2")}>
                  <p className="font-bold text-base text-slate-900 leading-tight truncate">
                    {standing.racer_name}
                  </p>
                </div>

                <div className={cn(COL.den, "px-2 flex justify-center")}>
                  {standing.den && <DenBadge den={standing.den} />}
                </div>

                <div className={cn(COL.wins, "text-center")}>
                  <p className={cn(
                    "text-xl font-black leading-none tabular-nums",
                    standing.wins > 0 ? "text-amber-600" : "text-slate-300"
                  )}>
                    {standing.wins}
                  </p>
                </div>

                <div className={cn(COL.sec, "text-center")}>
                  <p className={cn(
                    "text-xl font-black leading-none tabular-nums",
                    seconds > 0 ? "text-slate-600" : "text-slate-300"
                  )}>
                    {seconds}
                  </p>
                </div>

                {/* 3rd — pr-4 matches header */}
                <div className={cn(COL.thi, "text-center")}>
                  <p className={cn(
                    "text-xl font-black leading-none tabular-nums",
                    thirds > 0 ? "text-orange-600" : "text-slate-300"
                  )}>
                    {thirds}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

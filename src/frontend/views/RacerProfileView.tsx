import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Car,
  Trophy,
  Clock, Flag, CheckCircle } from 'lucide-react';
import { LilyChevronDown, LilyChevronLeft, LilyChevronUp } from '@/components/LilyChevron';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { splitName } from '@/lib/name-utils';
import { api } from '../api';
import { useApp } from '../context';
import type { Heat, Racer, RacerHistoryEntry } from '../types';

import { DEN_IMAGES } from '../lib/den-utils';
import { PLACE_STYLES } from '../lib/place-styles';

function ordinal(n: number) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}


type LaneCol = {
  lane_number: number;
  racer_id: string;
  car_number: string;
  name: string;
  place: number | null;
  dnf: boolean;
  isCurrent: boolean;
  time_ms: number | null;
  isEmpty?: boolean;
};


const EMPTY_COL = (laneNum: number): LaneCol => ({
  lane_number: laneNum,
  racer_id: '',
  car_number: '',
  name: '',
  place: null,
  dnf: false,
  isCurrent: false,
  time_ms: null,
  isEmpty: true,
});

function buildLaneCols(
  entry: RacerHistoryEntry,
  heat: Heat | undefined,
  currentRacerId: string,
  racers: Racer[],
  laneCount: number,
): LaneCol[] {
  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);

  if (heat?.lanes?.length) {
    const rawResults = (heat.results ?? []) as { racer_id: string; place: number | null; dnf?: boolean; time_ms?: number | null }[];
    return laneNums.map(laneNum => {
      const lane = heat.lanes!.find(l => l.lane_number === laneNum);
      if (!lane) return EMPTY_COL(laneNum);
      const result = rawResults.find(r => r.racer_id === lane.racer_id);
      const racer = racers.find(r => r.id === lane.racer_id);
      return {
        lane_number: lane.lane_number,
        racer_id: lane.racer_id,
        car_number: lane.car_number ?? racer?.car_number ?? '?',
        name: splitName(lane.racer_name ?? racer?.name ?? '').first,
        place: result?.place ?? null,
        dnf: !!result?.dnf,
        isCurrent: lane.racer_id === currentRacerId,
        time_ms: result?.time_ms ?? null,
      };
    });
  }

  // Fallback: no heat data, only know about current racer's lane
  const racer = racers.find(r => r.id === currentRacerId);
  return laneNums.map(laneNum =>
    laneNum === entry.lane_number
      ? {
          lane_number: laneNum,
          racer_id: currentRacerId,
          car_number: racer?.car_number ?? '?',
          name: splitName(racer?.name ?? '').first,
          place: entry.place ?? null,
          dnf: !!entry.dnf,
          isCurrent: true,
          time_ms: entry.time_ms,
        }
      : EMPTY_COL(laneNum)
  );
}

// ===== TOP BANNER =====

function ProfileBanner({ carNumber, rank, totalRacers }: {
  carNumber: string;
  rank: number | null;
  totalRacers: number;
}) {
  const isPodium = rank !== null && rank <= 3;
  return (
    <div className={cn(
      "flex items-center justify-between px-5 py-4",
      rank === 1 ? "bg-gradient-to-r from-amber-400 to-yellow-300" :
      rank === 2 ? "bg-gradient-to-r from-slate-400 to-slate-300" :
      rank === 3 ? "bg-gradient-to-r from-orange-500 to-orange-400" :
                   "bg-[#003F87]"
    )}>
      {/* Car number */}
      <div>
        <div data-testid="banner-car-number" className="text-4xl font-black italic text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.15)]">
          #{carNumber}
        </div>
        <div className={cn(
          "text-xs font-black uppercase tracking-widest leading-none mt-0.5",
          isPodium ? "text-white/60" : "text-blue-300"
        )}>Car</div>
      </div>

      {/* Rank: trophy inline before ordinal */}
      {rank !== null ? (
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Trophy
              size={26}
              strokeWidth={1.75}
              className={isPodium ? "text-white/90 drop-shadow-sm" : "text-amber-400/70"}
            />
            <span className="text-4xl font-black italic text-white leading-none [text-shadow:0_2px_4px_rgba(0,0,0,0.15)]">
              {ordinal(rank)}
            </span>
          </div>
          <div className={cn(
            "text-xs font-black uppercase tracking-widest mt-0.5",
            isPodium ? "text-white/60" : "text-blue-300"
          )}>
            of {totalRacers}
          </div>
        </div>
      ) : (
        <Trophy size={28} strokeWidth={1.75} className="text-amber-400/40" />
      )}
    </div>
  );
}

// ===== MAIN VIEW =====

export function RacerProfileView() {
  const { id } = useParams<{ id: string }>();
  const { setCurrentRacerId, currentEvent, racers, standings, heats } = useApp();
  const [history, setHistory] = useState<RacerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const racer = racers.find(r => r.id === id);
  const standing = standings.find(s => s.racer_id === id);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.getRacerHistory(id)
        .then(data => setHistory(data))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (!racer) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-slate-500 font-semibold">Racer not found</p>
        <Button variant="link" onClick={() => setCurrentRacerId(null)}>Back</Button>
      </div>
    );
  }

  const photoUrl = racer.car_photo_filename
    ? api.getRacerPhotoUrl(racer.id, racer.updated_at)
    : null;

  const rank = standing && (standing.wins > 0 || standing.losses > 0)
    ? standings.findIndex(s => s.racer_id === racer.id) + 1
    : null;

  const seconds = history.filter(r => r.place === 2 && !r.dnf).length;
  const thirds  = history.filter(r => r.place === 3 && !r.dnf).length;
  const timedRuns = history.filter(r => r.time_ms != null && !r.dnf);
  const bestMs = timedRuns.length > 0 ? Math.min(...timedRuns.map(r => r.time_ms!)) : null;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <Button
        variant="ghost"
        data-testid="btn-back"
        onClick={() => setCurrentRacerId(null)}
        className="mb-6 -ml-2 text-slate-500 hover:text-slate-900 font-bold uppercase text-xs tracking-widest gap-2"
      >
        <LilyChevronLeft size={16} />
        Back
      </Button>

      <div className="flex flex-col md:flex-row gap-6">

        {/* Left: Profile Card + Stats */}
        <div className="md:w-1/3 shrink-0 space-y-4">
          <Card className="overflow-hidden border-2 border-slate-200 shadow-lg py-0 gap-0 md:gap-0">

            <ProfileBanner
              carNumber={racer.car_number}
              rank={rank}
              totalRacers={racers.length}
            />

            {photoUrl && (
              <div className="aspect-square w-full bg-slate-100">
                <img src={photoUrl} alt={racer.name} className="w-full h-full object-cover" />
              </div>
            )}

            <CardContent className="px-5 pt-4 pb-5">
              <div className="flex items-start justify-between gap-3">
                {/* Left: name + inspection status */}
                <div className="min-w-0">
                  <h1 className="text-xl font-black text-slate-900 leading-tight">
                    {racer.name}
                  </h1>
                  {racer.weight_ok && (
                    <div className="flex items-center gap-1 mt-1">
                      <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Inspected</span>
                    </div>
                  )}
                </div>

                {/* Right: den image or badge */}
                {racer.den && (
                  <div className="shrink-0">
                    {DEN_IMAGES[racer.den] ? (
                      <img src={DEN_IMAGES[racer.den]} alt={racer.den} title={racer.den} className="h-12 w-12 object-contain" />
                    ) : (
                      <Badge className="bg-[#CE1126] text-white font-black uppercase tracking-widest px-3 py-1">
                        {racer.den}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <SidebarStats history={history} heats={heats} />
        </div>

        {/* Right: Stats + History */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex gap-3">
            <StatsCard
              label="Wins"
              value={standing?.wins ?? 0}
              icon={<Trophy size={16} className="text-amber-500" />}
              valueClass="text-amber-600"
              highlight
            />
            <StatsCard
              label="2nd Place"
              value={seconds}
              icon={<MedalDot place={2} />}
              valueClass="text-slate-600"
            />
            <StatsCard
              label="3rd Place"
              value={thirds}
              icon={<MedalDot place={3} />}
              valueClass="text-orange-600"
            />
            <StatsCard
              label="Best Time"
              value={bestMs ? (bestMs / 1000).toFixed(3) + 's' : '—'}
              icon={<Clock size={16} className="text-slate-400" />}
              valueClass="text-slate-900"
            />
          </div>

          <HeatHistory
            history={history}
            loading={loading}
            heats={heats}
            currentRacerId={id!}
            racers={racers}
            laneCount={currentEvent?.lane_count ?? 4}
          />
        </div>
      </div>
    </div>
  );
}

// ===== MEDAL DOT =====

function MedalDot({ place }: { place: 2 | 3 }) {
  return (
    <div className={cn(
      "w-4 h-4 rounded-full flex items-center justify-center text-xs font-black",
      place === 2 ? 'bg-slate-300 text-slate-700' : 'bg-orange-300 text-orange-800'
    )}>
      {place}
    </div>
  );
}

// ===== STATS CARD =====

function StatsCard({ label, value, icon, valueClass, highlight }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueClass: string;
  highlight?: boolean;
}) {
  const isZero = value === 0 || value === '—';
  return (
    <Card className={cn(
      "flex-1 border-2 shadow-sm py-0",
      highlight ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none">{label}</span>
          {icon}
        </div>
        <div className={cn(
          "font-black italic",
          highlight ? "text-5xl" : "text-3xl",
          isZero ? "text-slate-200" : valueClass
        )}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== SIDEBAR STATS =====

const PLACE_LABEL_STYLES: Record<number, string> = {
  1: 'text-amber-600',
  2: 'text-slate-500',
  3: 'text-orange-600',
};

function SidebarStats({ history, heats }: { history: RacerHistoryEntry[]; heats: Heat[] }) {
  if (history.length === 0) return null;

  const timed = history.filter(h => h.time_ms != null && !h.dnf);
  const maxLanes = Math.max(...heats.map(h => h.lanes?.length ?? 0), 1);

  // Timing
  const minEntry = timed.length > 0 ? timed.reduce((a, b) => a.time_ms! < b.time_ms! ? a : b) : null;
  const maxEntry = timed.length > 0 ? timed.reduce((a, b) => a.time_ms! > b.time_ms! ? a : b) : null;
  const avgMs = timed.length > 0 ? timed.reduce((s, h) => s + h.time_ms!, 0) / timed.length : null;

  // Place counts (hide zeros)
  const placeCounts = Array.from({ length: maxLanes }, (_, i) => i + 1)
    .map(place => ({ place, count: history.filter(h => h.place === place && !h.dnf).length }))
    .filter(p => p.count > 0);

  const dnfCount = history.filter(h => h.dnf).length;

  const hasTimings = timed.length > 0;
  const hasPlaces = placeCounts.length > 0 || dnfCount > 0;
  if (!hasTimings && !hasPlaces) return null;

  return (
    <Card className="border-2 border-slate-200 shadow-sm py-0">
      <CardContent className="px-4 py-4 space-y-4">

        {hasTimings && (
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Timing</span>
            <div className="space-y-1.5">
              <SideStatRow label="Best"  value={`${(minEntry!.time_ms! / 1000).toFixed(3)}s`} sub={`Lane ${minEntry!.lane_number}`} />
              <SideStatRow label="Worst" value={`${(maxEntry!.time_ms! / 1000).toFixed(3)}s`} sub={`Lane ${maxEntry!.lane_number}`} />
              <SideStatRow label="Avg"   value={`${(avgMs! / 1000).toFixed(3)}s`} />
            </div>
          </div>
        )}

        {hasPlaces && (
          <div className={cn("space-y-2", hasTimings && "border-t border-slate-100 pt-4")}>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Finishes</span>
            <div className="space-y-1.5">
              {placeCounts.map(({ place, count }) => (
                <SideStatRow
                  key={place}
                  label={ordinal(place)}
                  value={count}
                  labelClass={PLACE_LABEL_STYLES[place] ?? 'text-slate-500'}
                />
              ))}
              {dnfCount > 0 && (
                <SideStatRow label="DNF" value={dnfCount} labelClass="text-red-500" />
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

function SideStatRow({ label, value, sub, labelClass }: {
  label: string;
  value: string | number;
  sub?: string;
  labelClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn("text-xs font-bold", labelClass ?? "text-slate-500")}>{label}</span>
      <div className="text-right shrink-0">
        {sub && <span className="text-xs text-slate-400 mr-1.5">{sub}</span>} 
        <span className="text-sm font-black text-slate-700">{value}</span>
      </div>
    </div>
  );
}

// ===== HEAT HISTORY =====

function HeatHistory({ history, loading, heats, currentRacerId, racers, laneCount }: {
  history: RacerHistoryEntry[];
  loading: boolean;
  heats: Heat[];
  currentRacerId: string;
  racers: Racer[];
  laneCount: number;
}) {
  const [sortNewest, setSortNewest] = useState(true);

  const sorted = [...history].sort((a, b) => {
    const aKey = a.round * 1000 + a.heat_number;
    const bKey = b.round * 1000 + b.heat_number;
    return sortNewest ? bKey - aKey : aKey - bKey;
  });

  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Trophy size={15} className="text-[#003F87]" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-600">Race History</span>
        {history.length > 0 && (
          <span className="ml-auto text-xs font-bold text-slate-400">
            {new Set(history.map(h => h.round)).size} round{new Set(history.map(h => h.round)).size !== 1 ? 's' : ''} · {history.length} heat{history.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold">Loading...</div>
      ) : history.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Flag className="w-10 h-10 mx-auto text-slate-200" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No races completed yet</p>
        </div>
      ) : (
        <div>
          {/* Lane header — includes sort toggle in first column */}
          <LaneHeader laneCount={laneCount} sortNewest={sortNewest} onToggleSort={() => setSortNewest(n => !n)} />

          {sorted.map((entry, idx) => {
            const heat = heats.find(h => h.id === entry.heat_id);
            const cols = buildLaneCols(entry, heat, currentRacerId, racers, laneCount);
            return (
              <HeatSection
                key={entry.id}
                entry={entry}
                cols={cols}
                hasBorder={idx > 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== LANE HEADER =====

function LaneHeader({ laneCount, sortNewest, onToggleSort }: {
  laneCount: number;
  sortNewest: boolean;
  onToggleSort: () => void;
}) {
  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);
  return (
    <div className="flex border-b border-slate-200 bg-slate-100">
      {/* Sort toggle in the narrow first column */}
      <button
        data-testid="sort-history"
        onClick={onToggleSort}
        title={sortNewest ? 'Newest first — click for oldest' : 'Oldest first — click for newest'}
        className="w-10 shrink-0 border-r border-slate-200 flex items-center justify-center py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
      >
        {sortNewest ? <LilyChevronDown size={13} /> : <LilyChevronUp size={13} />}
      </button>
      <div className="flex-1 overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))` }}>
          {laneNums.map((n, i) => (
            <div key={n} className={cn("flex justify-center py-2 px-3 min-w-14", i > 0 && "border-l border-slate-200")}>
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                Lane {n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== HEAT SECTION =====

function PlaceBadge({ col }: { col: LaneCol }) {
  const style = !col.dnf && col.place !== null && col.place >= 1 && col.place <= 3
    ? PLACE_STYLES[col.place] : null;
  if (col.dnf) return (
    <span className="text-xs font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase leading-none">
      DNF
    </span>
  );
  if (style) return (
    <span className={cn("text-xs font-black px-2 py-0.5 rounded-full leading-none", style.pill)}>
      {style.label}
    </span>
  );
  if (col.place !== null) return (
    <span className="text-xs font-bold text-slate-600">{ordinal(col.place)}</span>
  );
  return <span className="text-xs text-slate-400">—</span>;
}

function HeatSection({ entry, cols, hasBorder }: {
  entry: RacerHistoryEntry;
  cols: LaneCol[];
  hasBorder: boolean;
}) {
  const { setCurrentRacerId } = useApp();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("flex", hasBorder && "border-t border-slate-100")}>

      {/* Narrow sidebar: round, heat label (rotated), expand chevron */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-10 shrink-0 flex flex-col items-center py-2 gap-1 border-r border-slate-200 bg-slate-50/40 hover:bg-slate-100 transition-colors"
        aria-label={expanded ? "Collapse heat" : "Expand heat"}
      >
        <span className="text-xs font-black text-slate-500 leading-none">
          R{entry.round}
        </span>
        <span className="flex-1 flex items-center justify-center text-xs font-black text-slate-700">
          H{entry.heat_number}
        </span>
        <LilyChevronDown
          size={13}
          className={cn(
            "text-slate-400 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Lane columns */}
      <div className="flex-1 overflow-x-auto">
        {/* Expanded header */}
        {expanded && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80">
            <span className="text-xs font-black text-slate-500">
              Round {entry.round} · Heat {entry.heat_number}
            </span>
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((col, colIdx) => {
            if (col.isEmpty) {
              return (
                <div key={col.lane_number} className={cn("flex items-center justify-center min-w-14", expanded ? "py-4" : "py-3", colIdx > 0 && "border-l border-slate-200")}>
                  <div className="relative text-slate-300">
                    <Car className="w-5 h-5" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-px bg-slate-300 rotate-45" />
                    </div>
                  </div>
                </div>
              );
            }
            return (
            <div
              key={col.lane_number}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 min-w-14",
                expanded ? "py-4" : "py-3",
                colIdx > 0 && "border-l border-slate-200",
                col.isCurrent
                  ? "bg-blue-50"
                  : "cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
              )}
              onClick={col.isCurrent ? undefined : () => setCurrentRacerId(col.racer_id)}
            >
              {/* Lane label — expanded only; persistent header covers collapsed */}
              {expanded && (
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none">
                  Lane {col.lane_number}
                </span>
              )}

              {/* Car number */}
              <span className={cn(
                "font-black leading-tight",
                expanded ? "text-base" : "text-sm",
                col.isCurrent ? "text-[#003F87]" : "text-slate-500"
              )}>
                #{col.car_number}
              </span>

              {/* Name — expanded only */}
              {expanded && (
                <span className={cn(
                  "text-sm text-center leading-snug",
                  col.isCurrent ? "text-[#003F87] font-semibold" : "text-slate-600"
                )}>
                  {col.name}
                </span>
              )}

              <PlaceBadge col={col} />

              {/* Time — show for all racers when available */}
              {col.time_ms != null && (
                <span className="text-xs font-mono text-slate-600">
                  {(col.time_ms / 1000).toFixed(3)}s
                </span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

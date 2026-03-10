import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { AlertCircle, Car, Clock, Play } from 'lucide-react';
import { LilyChevronDown } from '@/components/LilyChevron';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HeatLaneGrid } from '@/components/HeatLaneGrid';
import { AppTabs } from '@/components/AppTabs';
import { cn } from '@/lib/utils';
import { splitName } from '@/lib/name-utils';
import { PLACE_STYLES } from '@/lib/place-styles';
import { api } from '../api';
import { useApp } from '../context';
import type { Heat } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLACE_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const FIRST_NAME_COLOR: Record<number, string> = {
  1: 'text-amber-600',
  2: 'text-slate-700',
  3: 'text-orange-600',
};

// ─── HeatRow ─────────────────────────────────────────────────────────────────
// Memoized so that re-ordering rows (sort toggle) skips re-rendering each row.

interface HeatRowProps {
  heat: Heat;
  laneCount: number;
  isExpanded: boolean;
  heatHasTimes: boolean;
  onToggle: (id: string) => void;
  onSelectRacer: (id: string) => void;
}

const HeatRow = React.memo(function HeatRow({
  heat, laneCount, isExpanded, heatHasTimes, onToggle, onSelectRacer,
}: HeatRowProps) {
  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);
  const gridCols = `4.5rem repeat(${laneCount}, minmax(0, 1fr))`;
  const wideLayout = laneCount <= 4;

  return (
    <div
      data-testid="heat-card"
      className="grid bg-white border-t border-slate-200 first:border-t-0 transition-colors"
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Heat ID + expand toggle */}
      <div className="flex flex-col px-3 py-3 gap-1">
        <span className="text-sm font-black text-slate-800 leading-none">
          H{heat.heat_number}
        </span>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 leading-none">
            R{heat.round}
          </span>
          <button
            onClick={() => onToggle(heat.id)}
            className="text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors p-1 rounded cursor-pointer"
            aria-label={isExpanded ? 'Collapse heat' : 'Expand heat'}
          >
            <LilyChevronDown
              size={14}
              className={cn('transition-transform duration-150', !isExpanded && '-rotate-90')}
            />
          </button>
        </div>
      </div>

      {/* Lane cells */}
      {laneNums.map(laneNum => {
        const lane = heat.lanes?.find(l => l.lane_number === laneNum);
        const result = lane ? heat.results?.find(r => r.racer_id === lane.racer_id) : null;

        if (!lane) {
          return (
            <div
              key={laneNum}
              className={cn(
                'border-l border-slate-200 flex items-center justify-center',
                isExpanded ? 'py-5' : 'py-3',
              )}
            >
              <div className="relative text-slate-300">
                <Car className="w-6 h-6" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-px bg-slate-300 rotate-45" />
                </div>
              </div>
            </div>
          );
        }

        const isDNF = result?.dnf;
        const place = result?.place ?? null;
        const medal = place !== null ? PLACE_MEDAL[place] : null;
        const firstColor = isDNF
          ? 'text-slate-400'
          : place !== null ? (FIRST_NAME_COLOR[place] ?? 'text-slate-800') : 'text-slate-800';
        const { first, last } = splitName(lane.racer_name ?? '');

        if (isExpanded) {
          const placeBlock = isDNF ? (
            <span className="text-xs font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase leading-none">DNF</span>
          ) : place !== null ? (
            <div className="flex flex-col items-center gap-1">
              {medal && <span className={cn('leading-none', wideLayout ? 'text-4xl' : 'text-2xl')}>{medal}</span>}
              {PLACE_STYLES[place] ? (
                <span className={cn('font-black px-2 py-0.5 rounded-full leading-none', wideLayout ? 'text-sm' : 'text-xs', PLACE_STYLES[place].pill)}>
                  {PLACE_STYLES[place].label}
                </span>
              ) : (
                <span className={cn('font-bold text-slate-500', wideLayout ? 'text-sm' : 'text-xs')}>{place}th</span>
              )}
            </div>
          ) : null;

          if (wideLayout) {
            return (
              <button
                key={laneNum}
                data-testid={`completed-racer-${lane.racer_id}`}
                onClick={() => onSelectRacer(lane.racer_id)}
                className="group flex items-end gap-4 px-4 py-4 border-l border-slate-200 w-full cursor-pointer hover:bg-blue-50/50 active:bg-blue-50 transition-colors text-left"
              >
                <div className="shrink-0 flex flex-col items-center gap-1 pb-0.5">{placeBlock}</div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className={cn('text-base font-black leading-none group-hover:underline underline-offset-2', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                    #{lane.car_number}
                  </span>
                  <span className={cn('text-base font-black leading-tight', firstColor)}>{first}</span>
                  {last && <span className="text-sm text-slate-500 leading-tight">{last}</span>}
                  {heatHasTimes && !isDNF && (
                    result?.time_ms != null ? (
                      <span className="text-sm font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums leading-none self-start mt-0.5">
                        {(result.time_ms / 1000).toFixed(3)}s
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 leading-none">—</span>
                    )
                  )}
                </div>
              </button>
            );
          }

          return (
            <button
              key={laneNum}
              data-testid={`completed-racer-${lane.racer_id}`}
              onClick={() => onSelectRacer(lane.racer_id)}
              className="group flex flex-col items-center justify-end gap-1.5 px-2 py-4 border-l border-slate-200 w-full cursor-pointer hover:bg-blue-50/50 active:bg-blue-50 transition-colors"
            >
              {placeBlock}
              <span className={cn('text-sm font-black leading-none group-hover:underline underline-offset-2', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                #{lane.car_number}
              </span>
              <div className="flex flex-col items-center gap-0.5 w-full px-1">
                <span className={cn('text-sm font-black leading-tight text-center', firstColor)}>{first}</span>
                {last && <span className="text-xs text-slate-500 leading-tight text-center">{last}</span>}
              </div>
              {heatHasTimes && !isDNF && (
                result?.time_ms != null ? (
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums leading-none">
                    {(result.time_ms / 1000).toFixed(3)}s
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 leading-none">—</span>
                )
              )}
            </button>
          );
        }

        // Collapsed view
        return (
          <button
            key={laneNum}
            data-testid={`completed-racer-${lane.racer_id}`}
            onClick={() => onSelectRacer(lane.racer_id)}
            className="group flex items-center gap-0 px-1 py-1 border-l border-slate-200 text-left w-full cursor-pointer hover:bg-blue-50/50 active:bg-blue-50 transition-colors"
          >
            <div className="w-14 shrink-0 flex flex-col items-center gap-1 mr-2">
              {isDNF ? (
                <span className="text-xs font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase leading-none">DNF</span>
              ) : place !== null ? (
                PLACE_STYLES[place] ? (
                  <span className={cn('text-sm font-black px-2 py-0.5 rounded-full leading-none', PLACE_STYLES[place].pill)}>
                    {PLACE_STYLES[place].label}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-slate-600">{place}th</span>
                )
              ) : null}
              <span className={cn('text-sm font-black leading-none group-hover:underline underline-offset-2', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                #{lane.car_number}
              </span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className={cn('text-base font-black leading-tight truncate group-hover:text-[#003F87] transition-colors', firstColor)}>
                {first}
              </span>
              {last && <span className="text-sm text-slate-500 leading-tight truncate">{last}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
});

// ─── CompletedHeatsTable ─────────────────────────────────────────────────────

function CompletedHeatsTable({
  heats,
  laneCount,
  expandedIds,
  expandAll,
  onToggle,
}: {
  heats: Heat[];
  laneCount: number;
  expandedIds: Set<string>;
  expandAll: boolean;
  onToggle: (id: string) => void;
}) {
  const { setCurrentRacerId } = useApp();
  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);
  const gridCols = `4.5rem repeat(${laneCount}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto">
      {/* Column headers — outside the vertical scroll so the scrollbar doesn't overlap */}
      <div className="grid border-b border-slate-300 bg-slate-100" style={{ gridTemplateColumns: gridCols }}>
        <div className="px-3 py-2" />
        {laneNums.map(n => (
          <div key={n} className="px-3 py-2 border-l border-slate-300 text-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Lane {n}</span>
          </div>
        ))}
      </div>

      {/* Heat rows — only this section scrolls vertically */}
      <div className="overflow-y-auto min-h-[20rem]" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
        {heats.map(heat => (
          <HeatRow
            key={heat.id}
            heat={heat}
            laneCount={laneCount}
            isExpanded={expandAll || expandedIds.has(heat.id)}
            heatHasTimes={heat.results?.some(r => r.time_ms != null && !r.dnf) ?? false}
            onToggle={onToggle}
            onSelectRacer={setCurrentRacerId}
          />
        ))}
      </div>
    </div>
  );
}

// ─── HeatsView ────────────────────────────────────────────────────────────────

export function HeatsView() {
  const { currentEvent, racers, heats, refreshData } = useApp();
  const [lookahead, setLookahead] = useState<2 | 3>(3);
  // Default to completed tab if all heats are already done when the page loads
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>(
    () => heats.length > 0 && heats.every(h => h.status === 'complete') ? 'completed' : 'pending'
  );
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const deferredRoundFilter = useDeferredValue(roundFilter);
  const deferredSortOrder = useDeferredValue(sortOrder);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!currentEvent) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl text-slate-500 font-semibold">Please select an event first</p>
      </div>
    );
  }

  const pendingHeats = useMemo(() =>
    heats
      .filter(h => h.status !== 'complete')
      .sort((a, b) => a.round !== b.round ? a.round - b.round : a.heat_number - b.heat_number),
    [heats],
  );

  const allCompleted = useMemo(() => heats.filter(h => h.status === 'complete'), [heats]);

  const completedRounds = useMemo(() =>
    Array.from(new Set(allCompleted.map(h => h.round))).sort((a, b) => a - b),
    [allCompleted],
  );

  const completedHeats = useMemo(() => {
    let result = allCompleted;
    if (deferredRoundFilter !== 'all') result = result.filter(h => h.round === parseInt(deferredRoundFilter));
    result = [...result].sort((a, b) => {
      const aKey = a.round * 1000 + a.heat_number;
      const bKey = b.round * 1000 + b.heat_number;
      return deferredSortOrder === 'recent' ? bKey - aKey : aKey - bKey;
    });
    return result;
  }, [allCompleted, deferredRoundFilter, deferredSortOrder]);

  const lastCompletedHeat = useMemo(() => {
    if (allCompleted.length === 0) return null;
    return allCompleted.reduce((best, h) =>
      h.round * 1000 + h.heat_number > best.round * 1000 + best.heat_number ? h : best
    );
  }, [allCompleted]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eligibleRacers = racers.filter(r => r.weight_ok);
  const queuedHeats = pendingHeats.length;

  const tabs = [
    { id: 'pending',   label: 'Pending',   count: pendingHeats.length },
    { id: 'completed', label: 'Completed', count: allCompleted.length },
  ];

  const handleGenerate = async () => {
    if (eligibleRacers.length === 0) {
      alert('No racers have passed inspection. Please inspect racers first.');
      return;
    }
    setShowGenerateConfirm(true);
  };

  const confirmGenerate = async () => {
    setShowGenerateConfirm(false);
    await api.generateHeats(currentEvent.id, { lookahead, rounds: 1 });
    refreshData();
  };

  const confirmClear = async () => {
    setShowClearConfirm(false);
    await api.clearHeats(currentEvent.id);
    refreshData();
  };

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
            Heat Schedule
          </h1>
          <p className="text-slate-500 mt-1">
            {heats.length} generated • {queuedHeats} queued • {currentEvent.lane_count} lanes • {eligibleRacers.length} eligible racers
          </p>
        </div>

        {heats.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            data-testid="btn-clear-heats"
            onClick={() => setShowClearConfirm(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 font-bold uppercase text-xs tracking-widest h-10 px-4 shadow-sm"
          >
            Clear All
          </Button>
        )}

        {heats.length === 0 && (
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-1 flex items-center gap-1">
              {[2, 3].map((value) => (
                <button
                  key={value}
                  onClick={() => setLookahead(value as 2 | 3)}
                  className={cn(
                    'h-12 px-3 rounded-md text-sm font-semibold transition-colors',
                    lookahead === value ? 'bg-[#003F87] text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {value} ahead
                </button>
              ))}
            </div>
            <Button
              data-testid="btn-generate-heats"
              onClick={handleGenerate}
              size="lg"
              className="bg-[#003F87] hover:bg-[#002f66] text-white font-semibold px-6 shadow-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Rolling Heats
            </Button>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {heats.length === 0 && (
        <Card data-testid="empty-heats" className="border-2 border-dashed border-slate-300">
          <div className="text-center py-16">
            <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No heats generated yet</p>
            <p className="text-slate-400">DerbyTimer will queue only 2-3 heats at a time and keep matching by lane needs and wins.</p>
          </div>
        </Card>
      )}

      {/* ── Tabs ── */}
      {heats.length > 0 && (
        <AppTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as 'pending' | 'completed')}
          contentClassName="p-0"
        >

          {/* ── Pending tab ── */}
          {activeTab === 'pending' && (
            <div className="p-4 flex flex-col gap-4">

              {/* Last completed heat — hidden once all heats are done */}
              {lastCompletedHeat && pendingHeats.length > 0 && (() => {
                const laneNums = Array.from({ length: currentEvent.lane_count }, (_, i) => i + 1);
                return (
                  <div
                    className="grid border border-slate-200 rounded-xl overflow-hidden bg-white"
                    style={{ gridTemplateColumns: `4.5rem repeat(${currentEvent.lane_count}, minmax(0, 1fr))` }}
                  >
                    {/* Label cell */}
                    <div className="flex items-center px-3 py-2.5">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400 leading-tight">Last<br/>Heat</span>
                    </div>

                    {laneNums.map((laneNum, i) => {
                      const lane = lastCompletedHeat.lanes?.find(l => l.lane_number === laneNum);
                      const result = lane ? lastCompletedHeat.results?.find(r => r.racer_id === lane.racer_id) : null;
                      if (!lane) return (
                        <div key={laneNum} className={cn('flex items-center justify-center', i > 0 && 'border-l border-slate-200')}>
                          <div className="relative text-slate-300">
                            <Car className="w-6 h-6" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-7 h-px bg-slate-300 rotate-45" />
                            </div>
                          </div>
                        </div>
                      );
                      const isDNF = result?.dnf;
                      const place = result?.place ?? null;
                      return (
                        <div key={laneNum} className={cn('flex items-center justify-center gap-1.5 px-2 py-2.5', i > 0 && 'border-l border-slate-200')}>
                          <span className="text-sm font-black text-slate-400 shrink-0">L{laneNum}</span>
                          {place !== null && !isDNF && (
                            PLACE_STYLES[place] ? (
                              <span className={cn('text-sm font-black px-2 py-0.5 rounded-full leading-none shrink-0', PLACE_STYLES[place].pill)}>
                                {PLACE_STYLES[place].label}
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-slate-500 shrink-0">{place}th</span>
                            )
                          )}
                          <span className={cn('text-sm font-black shrink-0', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                            #{lane.car_number}
                          </span>
                          {isDNF && <span className="text-sm font-bold text-red-400 shrink-0">DNF</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {pendingHeats.length === 0 ? (
                <h2 className="text-center text-xl my-12 h-10 text-slate-600 font-semibold">
                  All heats complete!
                </h2>
              ) : (
                pendingHeats.map(heat => (
                  <Card
                    key={heat.id}
                    data-testid="heat-card"
                    className={cn(
                      "border-2 overflow-hidden py-0 gap-0 md:gap-0",
                      heat.status === 'pending' && "border-slate-200",
                      heat.status === 'running' && "border-red-300",
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-between px-5 py-3 border-b",
                      heat.status === 'pending' && "bg-white border-slate-100",
                      heat.status === 'running' && "bg-red-50 border-red-200",
                    )}>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-black text-slate-900">
                          Heat {heat.heat_number}
                        </span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-400">
                          Round {heat.round}
                        </span>
                      </div>
                      <Badge className={cn(
                        "uppercase tracking-wider text-xs font-bold",
                        heat.status === 'pending' && "bg-slate-100 text-slate-600",
                        heat.status === 'running' && "bg-[#CE1126] text-white",
                      )}>
                        {heat.status}
                      </Badge>
                    </div>
                    <HeatLaneGrid
                      heat={heat}
                      racers={racers}
                      laneCount={currentEvent.lane_count}
                    />
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── Completed tab ── */}
          {activeTab === 'completed' && (
            <div>
              {/* Filter bar */}
              {allCompleted.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200">
                  <Select value={roundFilter} onValueChange={setRoundFilter}>
                    <SelectTrigger className="h-9 bg-white border-slate-300 w-[140px] text-sm font-bold">
                      <SelectValue placeholder="All Rounds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rounds</SelectItem>
                      {completedRounds.map(r => (
                        <SelectItem key={r} value={r.toString()}>Round {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-100 border border-slate-300">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Sort:</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold uppercase transition-colors", sortOrder === 'oldest' ? "text-slate-900" : "text-slate-500")}>
                        Oldest
                      </span>
                      <Switch
                        checked={sortOrder === 'recent'}
                        onCheckedChange={(v) => setSortOrder(v ? 'recent' : 'oldest')}
                        className="data-[size=default]:h-5 data-[size=default]:w-9"
                      />
                      <span className={cn("text-xs font-bold uppercase transition-colors", sortOrder === 'recent' ? "text-slate-900" : "text-slate-500")}>
                        Recent
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-100 border border-slate-300">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Expand All</span>
                    <Switch
                      checked={expandAll}
                      onCheckedChange={setExpandAll}
                      className="data-[size=default]:h-5 data-[size=default]:w-9"
                    />
                  </div>
                </div>
              )}

                        {/* Table or empty state */}
              {completedHeats.length === 0 ? (
                <p className="text-center py-10 text-slate-400 font-semibold">
                  No completed heats yet
                </p>
              ) : (
                <CompletedHeatsTable
                  heats={completedHeats}
                  laneCount={currentEvent.lane_count}
                  expandedIds={expandedIds}
                  expandAll={expandAll}
                  onToggle={toggleExpanded}
                />
              )}
            </div>
          )}

        </AppTabs>
      )}

      {/* ── Dialogs ── */}
      <Dialog open={showGenerateConfirm} onOpenChange={(open) => !open && setShowGenerateConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Heats</DialogTitle>
            <DialogDescription>
              Generate heats for <strong>{eligibleRacers.length}</strong> eligible racers?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowGenerateConfirm(false)}>Cancel</Button>
            <Button className="bg-[#003F87] hover:bg-[#002f66] text-white" onClick={confirmGenerate}>
              Generate Heats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={(open) => !open && setShowClearConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Heats</DialogTitle>
            <DialogDescription>Are you sure you want to clear all heats? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmClear}>Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

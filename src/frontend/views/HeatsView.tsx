import React, { useState, useMemo } from 'react';
import { AlertCircle, Clock, Play } from 'lucide-react';
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

// ─── CompletedHeatsTable ─────────────────────────────────────────────────────
// No outer border — the AppTabs content panel provides the container.

function CompletedHeatsTable({ heats, laneCount }: { heats: Heat[]; laneCount: number }) {
  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);
  const gridCols = `4.5rem repeat(${laneCount}, minmax(0, 1fr))`;

  return (
    <>
      {/* Column headers */}
      <div className="grid border-b border-slate-300 bg-slate-100" style={{ gridTemplateColumns: gridCols }}>
        <div className="px-3 py-2" />
        {laneNums.map(n => (
          <div key={n} className="px-3 py-2 border-l border-slate-300 text-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Lane {n}
            </span>
          </div>
        ))}
      </div>

      {/* Heat rows */}
      {heats.map((heat, idx) => (
        <div
          key={heat.id}
          data-testid="heat-card"
          className={cn(
            'grid bg-white hover:bg-slate-50/50 transition-colors',
            idx > 0 && 'border-t border-slate-200',
          )}
          style={{ gridTemplateColumns: gridCols }}
        >
          {/* Heat ID */}
          <div className="flex flex-col justify-center px-3 py-3 gap-0.5">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 leading-none">
              R{heat.round}·H{heat.heat_number}
            </span>
            <span className="text-xs font-black text-emerald-600 leading-none">✓</span>
          </div>

          {/* Lane cells — always in lane-number order */}
          {laneNums.map(laneNum => {
            const lane = heat.lanes?.find(l => l.lane_number === laneNum);
            const result = lane ? heat.results?.find(r => r.racer_id === lane.racer_id) : null;

            if (!lane) {
              return <div key={laneNum} className="border-l border-slate-200" />;
            }

            const isDNF = result?.dnf;
            const place = result?.place ?? null;
            const medal = place !== null ? PLACE_MEDAL[place] : null;
            const firstColor = isDNF
              ? 'text-slate-400'
              : place !== null ? (FIRST_NAME_COLOR[place] ?? 'text-slate-800') : 'text-slate-800';
            const { first, last } = splitName(lane.racer_name ?? '');

            return (
              <div key={laneNum} className="flex items-center gap-0 px-3 py-3 border-l border-slate-200">
                {/* Fixed-width medal+car# column — all cells align to the same x */}
                <div className="w-10 shrink-0 flex flex-col items-center gap-0.5 mr-2">
                  {medal && !isDNF ? (
                    <span className="text-base leading-none">{medal}</span>
                  ) : isDNF ? (
                    <span className="text-xs font-black uppercase text-slate-400 leading-none">DNF</span>
                  ) : null}
                  <span className={cn('text-xs font-black leading-none', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                    #{lane.car_number}
                  </span>
                </div>
                {/* Name column — starts at same x across all cells */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={cn('text-base font-black leading-tight truncate', firstColor)}>
                    {first}
                  </span>
                  {last && (
                    <span className="text-sm text-slate-500 leading-tight truncate">{last}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
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

  const completedRounds = useMemo(() =>
    Array.from(new Set(heats.filter(h => h.status === 'complete').map(h => h.round))).sort((a, b) => a - b),
    [heats],
  );

  const completedHeats = useMemo(() => {
    let result = heats.filter(h => h.status === 'complete');
    if (roundFilter !== 'all') result = result.filter(h => h.round === parseInt(roundFilter));
    result.sort((a, b) => {
      const aKey = a.round * 1000 + a.heat_number;
      const bKey = b.round * 1000 + b.heat_number;
      return sortOrder === 'recent' ? bKey - aKey : aKey - bKey;
    });
    return result;
  }, [heats, roundFilter, sortOrder]);

  const allCompleted = heats.filter(h => h.status === 'complete');

  const lastCompletedHeat = useMemo(() => {
    const completed = heats.filter(h => h.status === 'complete');
    if (completed.length === 0) return null;
    return completed.reduce((best, h) =>
      h.round * 1000 + h.heat_number > best.round * 1000 + best.heat_number ? h : best
    );
  }, [heats]);

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

              {/* Last completed heat — single row, one column per lane, updates via WebSocket */}
              {lastCompletedHeat && (() => {
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
                      if (!lane) return <div key={laneNum} className={cn(i > 0 && 'border-l border-slate-200')} />;
                      const isDNF = result?.dnf;
                      const place = result?.place ?? null;
                      const medal = place !== null ? PLACE_MEDAL[place] : null;
                      const nameColor = isDNF ? 'text-slate-400 italic' :
                        place === 1 ? 'text-amber-600' :
                        place === 2 ? 'text-slate-700' :
                        place === 3 ? 'text-orange-600' : 'text-slate-800';
                      const { first } = splitName(lane.racer_name ?? '');
                      return (
                        <div key={laneNum} className={cn('flex items-center gap-1.5 px-3 py-2.5', i > 0 && 'border-l border-slate-200')}>
                          <span className="text-xs font-black text-slate-400 shrink-0">L{laneNum}</span>
                          {medal && !isDNF && <span className="text-sm leading-none shrink-0">{medal}</span>}
                          <span className={cn('text-xs font-black shrink-0', isDNF ? 'text-slate-400' : 'text-[#003F87]')}>
                            #{lane.car_number}
                          </span>
                          <span className={cn('text-sm font-bold truncate', nameColor)}>
                            {first}{isDNF ? ' DNF' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {pendingHeats.length === 0 ? (
                <p className="text-center py-10 text-slate-400 font-semibold">
                  All heats complete!
                </p>
              ) : (
                pendingHeats.map(heat => (
                  <Card
                    key={heat.id}
                    data-testid="heat-card"
                    className={cn(
                      "border-2 overflow-hidden py-0 gap-0",
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
                        <span className="text-sm font-black uppercase tracking-widest text-slate-400">
                          Round {heat.round}
                        </span>
                        <span className="text-2xl font-black text-slate-900">
                          Heat {heat.heat_number}
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
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Round:</span>
                    <Select value={roundFilter} onValueChange={setRoundFilter}>
                      <SelectTrigger className="h-8 bg-white border-slate-300 w-[120px] text-xs font-bold">
                        <SelectValue placeholder="All Rounds" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Rounds</SelectItem>
                        {completedRounds.map(r => (
                          <SelectItem key={r} value={r.toString()}>Round {r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Sort:</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold uppercase transition-colors", sortOrder === 'oldest' ? "text-slate-900" : "text-slate-400")}>
                        Oldest
                      </span>
                      <Switch
                        checked={sortOrder === 'recent'}
                        onCheckedChange={(v) => setSortOrder(v ? 'recent' : 'oldest')}
                        className="data-[size=default]:h-5 data-[size=default]:w-9"
                      />
                      <span className={cn("text-xs font-bold uppercase transition-colors", sortOrder === 'recent' ? "text-[#003F87]" : "text-slate-400")}>
                        Recent
                      </span>
                    </div>
                  </div>
                </div>
              )}

                        {/* Table or empty state */}
              {completedHeats.length === 0 ? (
                <p className="text-center py-10 text-slate-400 font-semibold">
                  No completed heats yet
                </p>
              ) : (
                <div
                  className="overflow-y-auto overflow-x-auto min-h-[20rem]"
                  style={{ maxHeight: 'calc(100vh - 20rem)' }}
                >
                  <CompletedHeatsTable
                    heats={completedHeats}
                    laneCount={currentEvent.lane_count}
                  />
                </div>
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

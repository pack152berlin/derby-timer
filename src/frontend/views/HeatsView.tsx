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
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useApp } from '../context';

export function HeatsView() {
  const { currentEvent, racers, heats, refreshData } = useApp();
  const [lookahead, setLookahead] = useState<2 | 3>(3);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending'>('all');
  const [roundFilter, setRoundFilter] = useState<string>('all');
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

  const rounds = Array.from(new Set(heats.map(h => h.round))).sort((a, b) => a - b);

  const filteredHeats = useMemo(() => {
    let result = [...heats];

    if (roundFilter !== 'all') {
      result = result.filter(h => h.round === parseInt(roundFilter));
    }

    if (statusFilter === 'pending') {
      result = result.filter(h => h.status !== 'complete');
    }

    result.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.heat_number - b.heat_number;
    });

    return result;
  }, [heats, statusFilter, roundFilter]);

  const eligibleRacers = racers.filter(r => r.weight_ok);
  const queuedHeats = heats.filter((heat) => heat.status !== 'complete').length;

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

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = async () => {
    setShowClearConfirm(false);
    await api.clearHeats(currentEvent.id);
    refreshData();
  };

  return (
    <div className="max-w-6xl mx-auto">
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
            onClick={handleClear}
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
                    lookahead === value
                      ? 'bg-[#003F87] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
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

      {heats.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Round:</span>
              <Select value={roundFilter} onValueChange={setRoundFilter}>
                <SelectTrigger className="h-8 bg-white border-slate-300 w-[120px] text-xs font-bold">
                  <SelectValue placeholder="All Rounds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rounds</SelectItem>
                  {rounds.map(r => (
                    <SelectItem key={r} value={r.toString()}>Round {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100" data-testid="status-toggle">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status:</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  statusFilter === 'all' ? "text-slate-900" : "text-slate-400"
                )}>
                  All
                </span>
                <Switch
                  checked={statusFilter === 'pending'}
                  onCheckedChange={(checked) => setStatusFilter(checked ? 'pending' : 'all')}
                  className="data-[size=default]:h-5 data-[size=default]:w-9"
                />
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  statusFilter === 'pending' ? "text-orange-600" : "text-slate-400"
                )}>
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {heats.length > 0 && (
        <div className="grid gap-4">
          {filteredHeats.map(heat => (
            <Card
              key={heat.id}
              data-testid="heat-card"
              className={cn(
                "border-2 overflow-hidden py-0 gap-0",
                heat.status === 'pending' && "border-slate-200",
                heat.status === 'running' && "border-red-300",
                heat.status === 'complete' && "border-emerald-300"
              )}
            >
              {/* Heat header */}
              <div className={cn(
                "flex items-center justify-between px-5 py-3 border-b",
                heat.status === 'pending' && "bg-white border-slate-100",
                heat.status === 'running' && "bg-red-50 border-red-200",
                heat.status === 'complete' && "bg-emerald-50 border-emerald-200"
              )}>
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Round {heat.round}
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    Heat {heat.heat_number}
                  </span>
                </div>
                <Badge
                  className={cn(
                    "uppercase tracking-wider text-xs font-bold",
                    heat.status === 'pending' && "bg-slate-100 text-slate-600",
                    heat.status === 'running' && "bg-[#CE1126] text-white",
                    heat.status === 'complete' && "bg-emerald-500 text-white"
                  )}
                >
                  {heat.status}
                </Badge>
              </div>

              {/* Lane grid */}
              <HeatLaneGrid
                heat={heat}
                racers={racers}
                laneCount={currentEvent.lane_count}
              />
            </Card>
          ))}
        </div>
      )}

      {heats.length === 0 && (
        <Card data-testid="empty-heats" className="border-2 border-dashed border-slate-300">
          <div className="text-center py-16">
            <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No heats generated yet</p>
            <p className="text-slate-400">DerbyTimer will queue only 2-3 heats at a time and keep matching by lane needs and wins.</p>
          </div>
        </Card>
      )}

      <Dialog open={showGenerateConfirm} onOpenChange={(open) => !open && setShowGenerateConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Heats</DialogTitle>
            <DialogDescription>
              Generate heats for <strong>{eligibleRacers.length}</strong> eligible racers?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowGenerateConfirm(false)}>
              Cancel
            </Button>
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
            <DialogDescription>
              Are you sure you want to clear all heats? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { AlertCircle, Car, Flag, CheckCircle, ChevronRight, Trophy, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeatLaneGrid } from '@/components/HeatLaneGrid';
import { cn } from '@/lib/utils';
import type { HeatResult } from '../types';
import { api } from '../api';
import { useApp } from '../context';

function ordinal(n: number) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export function RaceConsoleView() {
  const { currentEvent, racers, heats, refreshData } = useApp();
  const [heatResults, setHeatResults] = useState<Record<string, HeatResult[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isStartingHeat, setIsStartingHeat] = useState(false);

  if (!currentEvent) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl text-slate-500 font-semibold">Please select an event first</p>
      </div>
    );
  }

  if (heats.length === 0) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl text-slate-500 font-semibold mb-4">No heats generated yet</p>
      </div>
    );
  }

  const currentHeat = heats.find(h => h.status === 'running') || heats.find(h => h.status === 'pending');
  const completedCount = heats.filter(h => h.status === 'complete').length;
  const queuedCount = heats.filter(h => h.status !== 'complete').length;

  const handleStart = async () => {
    if (!currentHeat || isStartingHeat) return;

    setNotice(null);
    setIsStartingHeat(true);

    try {
      await api.startHeat(currentHeat.id);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start this heat.';
      setNotice(message);
    } finally {
      setIsStartingHeat(false);
    }
  };

  const handleComplete = async () => {
    if (!currentHeat) return;
    const results = heatResults[currentHeat.id] || [];

    const lanesInHeat = currentHeat.lanes?.length ?? currentEvent.lane_count;
    if (results.length < lanesInHeat) {
      alert('Please record a finish result for every lane first.');
      return;
    }

    const placed = results.filter((result) => !result.dnf).map((result) => result.place);
    if (new Set(placed).size !== placed.length) {
      alert('Each finishing place can only be used once.');
      return;
    }

    await api.saveResults(currentHeat.id, results);
    setHeatResults({});
    refreshData();
  };

  const recordPlace = (heatId: string, laneNumber: number, racerId: string, place: number) => {
    setHeatResults(prev => {
      const current = prev[heatId] || [];
      const filtered = current.filter((result) => {
        if (result.lane_number === laneNumber) {
          return false;
        }

        if (!result.dnf && result.place === place) {
          return false;
        }

        return true;
      });
      return { ...prev, [heatId]: [...filtered, { lane_number: laneNumber, racer_id: racerId, place }] };
    });
  };

  const recordDNF = (heatId: string, laneNumber: number, racerId: string) => {
    setHeatResults(prev => {
      const current = prev[heatId] || [];
      const filtered = current.filter(r => r.lane_number !== laneNumber);
      return { ...prev, [heatId]: [...filtered, { lane_number: laneNumber, racer_id: racerId, place: 99, dnf: true }] };
    });
  };

  if (!currentHeat) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <Trophy className="w-20 h-20 mx-auto mb-6 text-yellow-500" />
        <h2 className="text-4xl font-black mb-4 text-slate-900">Race Complete!</h2>
        <p className="text-xl text-slate-500 mb-8">All heats have been completed</p>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-lg px-8 py-6">
          <BarChart3 className="w-6 h-6 mr-2" />
          View Final Standings
        </Button>
      </div>
    );
  }

  const racerById = useMemo(() => {
    const map = new Map<string, typeof racers[0]>();
    racers.forEach(r => map.set(r.id, r));
    return map;
  }, [racers]);

  const currentResults = heatResults[currentHeat.id] || [];
  const expectedResults = currentHeat.lanes?.length ?? currentEvent.lane_count;
  const hasAllResults = currentResults.length === expectedResults;
  const nonDnfPlaces = currentResults.filter((result) => !result.dnf).map((result) => result.place);
  const hasDuplicatePlaces = new Set(nonDnfPlaces).size !== nonDnfPlaces.length;
  const canCompleteHeat = hasAllResults && !hasDuplicatePlaces;
  const laneCount = currentHeat.lanes?.length ?? currentEvent.lane_count;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
          Race Control
        </h1>
        <p className="text-slate-500 mt-1">
          {completedCount} heats complete • {queuedCount} queued
        </p>
      </div>

      <Card className="mb-6 bg-slate-900 text-white border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-stretch min-h-[100px]">
            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-slate-400 text-xs uppercase tracking-[0.2em] mb-1 font-black">Current Heat</p>
              <h2 className="text-3xl sm:text-4xl font-black">Round {currentHeat.round} • Heat {currentHeat.heat_number}</h2>
            </div>
            
            <div className="w-full sm:w-auto flex items-center px-6 pb-6 sm:pb-0">
              {currentHeat.status === 'pending' && (
                <Button
                  data-testid="btn-start-heat"
                  onClick={handleStart}
                  disabled={isStartingHeat}
                  size="lg"
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-12 px-8 shadow-lg"
                >
                  {isStartingHeat ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Flag className="w-5 h-5 mr-2" />
                  )}
                  {isStartingHeat ? 'Starting...' : 'Start Heat'}
                </Button>
              )}

              {currentHeat.status === 'running' && (
                <Badge className="bg-[#CE1126] text-white px-6 py-2 text-lg font-black uppercase tracking-widest animate-pulse border-0">
                  Racing
                </Badge>
              )}

              {currentHeat.status === 'complete' && (
                <Badge className="bg-emerald-500 text-white px-6 py-2 text-lg font-black uppercase tracking-widest border-0">
                  Complete
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {notice && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-3 text-sm font-semibold text-red-800">{notice}</CardContent>
        </Card>
      )}

      {currentHeat.status === 'pending' && (
        <Card className="mb-6 overflow-hidden border-2 border-slate-200 py-0 gap-0">
          <HeatLaneGrid
            heat={currentHeat}
            racers={racers}
            laneCount={currentEvent.lane_count}
          />
        </Card>
      )}

      {currentHeat.status !== 'pending' && (
        <Card className="mb-6 border-2 border-slate-200 py-0 gap-0 overflow-hidden">
          {currentHeat.lanes?.map((lane, idx) => {
            const result = currentResults.find(r => r.lane_number === lane.lane_number);
            const racer = racerById.get(lane.racer_id);
            const photoUrl = racer?.car_photo_filename
              ? api.getRacerPhotoUrl(lane.racer_id, racer.updated_at)
              : null;

            return (
              <div
                key={lane.id}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 transition-colors',
                  idx !== 0 && 'border-t border-slate-100',
                  result && !result.dnf && 'bg-emerald-50',
                  result?.dnf && 'bg-red-50',
                )}
              >
                {/* Lane number */}
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-lg text-white',
                  currentHeat.status === 'running' ? 'bg-[#CE1126]' : 'bg-emerald-600',
                )}>
                  {lane.lane_number}
                </div>

                {/* Photo */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Car #${lane.car_number}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <Car className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Car info */}
                <div className="w-40 shrink-0">
                  <div className="text-xl font-black text-[#003F87] leading-none">#{lane.car_number}</div>
                  <div className="text-xs font-bold text-slate-500 truncate mt-0.5">{lane.racer_name}</div>
                </div>

                {/* Place buttons */}
                {currentHeat.status === 'running' && (
                  <div className="flex flex-wrap gap-2 flex-1">
                    {Array.from({ length: laneCount }, (_, i) => i + 1).map(place => {
                      const takenByLane = currentResults.find(
                        e => !e.dnf && e.place === place && e.lane_number !== lane.lane_number
                      );
                      const isSelected = result?.place === place;

                      return (
                        <button
                          key={place}
                          disabled={!!takenByLane}
                          onClick={() => recordPlace(currentHeat.id, lane.lane_number, lane.racer_id!, place)}
                          className={cn(
                            'h-10 min-w-[52px] px-3 rounded-lg border-2 text-sm font-black transition-colors',
                            isSelected
                              ? 'bg-amber-400 border-amber-400 text-slate-900'
                              : takenByLane
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-[#003F87] hover:text-[#003F87]',
                          )}
                          title={takenByLane ? `Assigned to Lane ${takenByLane.lane_number}` : undefined}
                        >
                          {isSelected
                            ? ordinal(place)
                            : takenByLane
                              ? <span className="text-[10px] font-black tracking-wide">L{takenByLane.lane_number}</span>
                              : ordinal(place)}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => recordDNF(currentHeat.id, lane.lane_number, lane.racer_id!)}
                      className={cn(
                        'h-10 px-3 rounded-lg border-2 text-sm font-black transition-colors',
                        result?.dnf
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600',
                      )}
                    >
                      DNF
                    </button>
                  </div>
                )}

                {/* Result summary (complete state or recorded) */}
                {(currentHeat.status === 'complete' || result) && (
                  <div className="ml-auto shrink-0">
                    {result ? (
                      <Badge className={cn(
                        'px-4 py-1.5 text-sm font-black',
                        result.dnf ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white',
                      )}>
                        {result.dnf ? 'DNF' : `${ordinal(result.place)} Place`}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">—</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex justify-center gap-4">
        {currentHeat.status === 'running' && (
          <Button 
            onClick={handleComplete}
            disabled={!canCompleteHeat}
            className="bg-[#CE1126] hover:bg-[#ad0e20] text-white font-bold text-xl px-12 py-6 shadow-lg disabled:opacity-50"
          >
            <CheckCircle className="w-6 h-6 mr-3" />
            COMPLETE HEAT
          </Button>
        )}
        
        {currentHeat.status === 'complete' && (
          <Button 
            onClick={() => refreshData()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xl px-12 py-6 shadow-lg"
          >
            <ChevronRight className="w-6 h-6 mr-3" />
            NEXT HEAT
          </Button>
        )}
      </div>
    </div>
  );
}

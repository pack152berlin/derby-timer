import React, { useState } from 'react';
import { AlertCircle, Flag, CheckCircle, ChevronRight, Trophy, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HeatResult } from '../types';
import { api } from '../api';
import { useApp } from '../context';

export function RaceConsoleView() {
  const { currentEvent, heats, refreshData } = useApp();
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

  const currentResults = heatResults[currentHeat.id] || [];
  const expectedResults = currentHeat.lanes?.length ?? currentEvent.lane_count;
  const hasAllResults = currentResults.length === expectedResults;
  const nonDnfPlaces = currentResults.filter((result) => !result.dnf).map((result) => result.place);
  const hasDuplicatePlaces = new Set(nonDnfPlaces).size !== nonDnfPlaces.length;
  const canCompleteHeat = hasAllResults && !hasDuplicatePlaces;

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

      <Card className="mb-6 bg-slate-900 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm uppercase tracking-wider mb-1 font-semibold">Current Heat</p>
              <h2 className="text-4xl font-black">Round {currentHeat.round} • Heat {currentHeat.heat_number}</h2>
            </div>
            <Badge 
              className={cn(
                "px-6 py-3 text-lg font-bold uppercase",
                currentHeat.status === 'pending' && "bg-slate-700",
                currentHeat.status === 'running' && "bg-[#CE1126] text-white",
                currentHeat.status === 'complete' && "bg-emerald-500"
              )}
            >
              {currentHeat.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {notice && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-3 text-sm font-semibold text-red-800">{notice}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {currentHeat.lanes?.map(lane => {
          const result = currentResults.find(r => r.lane_number === lane.lane_number);
          return (
            <Card 
              key={lane.id} 
              className={cn(
                "border-2 transition-all",
                result ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
              )}
            >
              <CardContent className="p-5">
                <div className="mb-3">
                  <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Lane {lane.lane_number}</p>
                  <p className="text-3xl font-black text-[#003F87]">#{lane.car_number}</p>
                  <p className="text-base text-slate-700">{lane.racer_name}</p>
                </div>
                
                {currentHeat.status === 'running' && (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: currentHeat.lanes?.length ?? currentEvent.lane_count }, (_, idx) => idx + 1).map((place) => {
                      const placeTakenByOtherLane = currentResults.some((entry) => {
                        return !entry.dnf && entry.place === place && entry.lane_number !== lane.lane_number;
                      });

                      return (
                        <Button
                          key={place}
                          variant={result?.place === place ? "default" : "outline"}
                          onClick={() => recordPlace(currentHeat.id, lane.lane_number, lane.racer_id!, place)}
                          disabled={placeTakenByOtherLane}
                          className={cn(
                            "h-12 font-bold",
                            result?.place === place && "bg-yellow-400 text-slate-900 hover:bg-yellow-500",
                            placeTakenByOtherLane && "opacity-50"
                          )}
                        >
                          {place}{place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'}
                        </Button>
                      );
                    })}
                    <Button
                      variant={result?.dnf ? "default" : "outline"}
                      onClick={() => recordDNF(currentHeat.id, lane.lane_number, lane.racer_id!)}
                      className={cn(
                        "col-span-full h-12 font-bold",
                        result?.dnf && "bg-red-500 text-white hover:bg-red-600"
                      )}
                    >
                      DNF
                    </Button>
                  </div>
                )}
                
                {result && (
                  <div className="mt-3 text-center">
                    <Badge 
                      className={cn(
                        "px-4 py-2 text-sm font-bold",
                        result.dnf ? "bg-red-500" : "bg-emerald-500"
                      )}
                    >
                      {result.dnf ? 'DNF' : `${result.place}${result.place === 1 ? 'st' : result.place === 2 ? 'nd' : result.place === 3 ? 'rd' : 'th'} Place`}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center gap-4">
        {currentHeat.status === 'pending' && (
          <Button 
            onClick={handleStart}
            disabled={isStartingHeat}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl px-12 py-6 shadow-lg"
          >
            <Flag className="w-6 h-6 mr-3" />
            {isStartingHeat ? 'STARTING...' : 'START HEAT'}
          </Button>
        )}
        
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

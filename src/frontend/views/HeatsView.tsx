import React, { useState } from 'react';
import { AlertCircle, Clock, Flag, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useApp } from '../context';

export function HeatsView() {
  const { currentEvent, racers, heats, refreshData } = useApp();
  const [lookahead, setLookahead] = useState<2 | 3>(3);

  if (!currentEvent) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl text-slate-500 font-semibold">Please select an event first</p>
      </div>
    );
  }

  const eligibleRacers = racers.filter(r => r.weight_ok);
  const queuedHeats = heats.filter((heat) => heat.status !== 'complete').length;

  const handleGenerate = async () => {
    if (eligibleRacers.length === 0) {
      alert('No racers have passed inspection. Please inspect racers first.');
      return;
    }
    if (!confirm(`Generate heats for ${eligibleRacers.length} eligible racers?`)) return;
    await api.generateHeats(currentEvent.id, { lookahead, rounds: 1 });
    refreshData();
  };

  const handleClear = async () => {
    if (!confirm('Clear all heats? This cannot be undone.')) return;
    await api.clearHeats(currentEvent.id);
    refreshData();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
            Heat Schedule
          </h1>
          <p className="text-slate-500 mt-1">
            {heats.length} generated • {queuedHeats} queued • {currentEvent.lane_count} lanes • {eligibleRacers.length} eligible racers
          </p>
        </div>
        {heats.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-1 flex items-center gap-1">
              {[2, 3].map((value) => (
                <button
                  key={value}
                  onClick={() => setLookahead(value as 2 | 3)}
                  className={cn(
                    'h-12 px-3 rounded-md text-sm font-semibold transition-colors',
                    lookahead === value
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {value} ahead
                </button>
              ))}
            </div>
            <Button
              onClick={handleGenerate}
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 shadow-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Rolling Heats
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline"
            onClick={handleClear}
            className="border-red-300 text-red-500 hover:bg-red-50"
          >
            Clear All
          </Button>
        )}
      </div>

      {heats.length > 0 && (
        <div className="grid gap-4">
          {heats.map(heat => (
            <Card 
              key={heat.id}
              className={cn(
                "border-2",
                heat.status === 'pending' && "border-slate-200",
                heat.status === 'running' && "border-orange-300 bg-orange-50",
                heat.status === 'complete' && "border-emerald-300 bg-emerald-50"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Round {heat.round} • Heat {heat.heat_number}</CardTitle>
                  <Badge 
                    className={cn(
                      heat.status === 'pending' && "bg-slate-200 text-slate-700",
                      heat.status === 'running' && "bg-orange-500 text-white",
                      heat.status === 'complete' && "bg-emerald-500 text-white"
                    )}
                  >
                    {heat.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {heat.lanes?.map(lane => (
                    <Card key={lane.id} className="bg-slate-50">
                      <CardContent className="p-4">
                        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Lane {lane.lane_number}</p>
                        <p className="text-2xl font-black text-orange-600">#{lane.car_number}</p>
                        <p className="text-sm text-slate-700 mt-1">{lane.racer_name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {heats.length === 0 && (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No heats generated yet</p>
            <p className="text-slate-400">DerbyTimer will queue only 2-3 heats at a time and keep matching by lane needs and wins.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

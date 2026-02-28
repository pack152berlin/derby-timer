import React from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useApp } from '../context';

export function StandingsView() {
  const { standings } = useApp();

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', numBg: 'bg-yellow-400' };
    if (rank === 2) return { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700', numBg: 'bg-slate-400' };
    if (rank === 3) return { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-700', numBg: 'bg-amber-600' };
    return { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700', numBg: 'bg-slate-300' };
  };

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

      {standings.length > 0 ? (
        <div className="space-y-3">
          {standings.map((standing, index) => {
            const rank = index + 1;
            const style = getRankStyle(rank);
            return (
              <Card 
                key={standing.racer_id}
                className={cn(
                  "border-2",
                  style.bg, style.border
                )}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black", style.numBg, rank <= 3 ? 'text-slate-900' : 'text-white')}>
                    {rank}
                  </div>
                  
                  <div className="w-20 text-center">
                    <p className="text-2xl font-black text-[#003F87]">#{standing.car_number}</p>
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-lg text-slate-900">{standing.racer_name}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className="text-2xl font-black text-emerald-600">{standing.wins}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">Wins</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-700">{standing.losses}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">Losses</p>
                    </div>
                    <div>
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
      ) : (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No results yet</p>
            <p className="text-slate-400">Run some heats to see the standings</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

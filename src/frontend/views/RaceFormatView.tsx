import React from 'react';
import { BookOpen, Timer, Shuffle, Trophy, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApp } from '../context';
import { buildEliminationPlan } from '../../race/elimination';

export function RaceFormatView() {
  const { currentEvent, racers, standings } = useApp();

  const eligibleCars = racers.filter((racer) => racer.weight_ok).length;
  const laneCount = currentEvent?.lane_count ?? 4;
  const eliminationPlan = buildEliminationPlan(eligibleCars);
  const finalFieldSize = eliminationPlan[eliminationPlan.length - 1] ?? 0;
  const finalEliminatedCount = Math.max(0, eligibleCars - finalFieldSize);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
          How DerbyTimer Runs Race Day
        </h1>
        <p className="text-slate-600 mt-2 text-lg">
          Fast volunteer flow, fair lane usage, and matchups that get tighter as standings settle.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Timer className="w-5 h-5 text-[#003F87]" />
              Rolling Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <Badge className="bg-[#003F87] text-white">2-3 heats visible</Badge>
            <p>Only the next few heats are generated so late-breaking results can affect upcoming matchups.</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Route className="w-5 h-5 text-[#003F87]" />
              Lane Fairness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <Badge variant="outline">Every car, every lane</Badge>
            <p>Heat planning prioritizes lane coverage so each car gets a fair shot across the full track setup.</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shuffle className="w-5 h-5 text-[#003F87]" />
              Similar Records
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <Badge variant="outline">Best effort matching</Badge>
            <p>As wins and losses come in, DerbyTimer tries to group cars with similar records in the same heats.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="w-6 h-6 text-[#CE1126]" />
            Elimination Checkpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-800 text-lg">
          <p>
            Policy in this app: only inspected racers are eligible, each active field runs a full lane-coverage cycle, then the field is cut to about half (rounded up) until 2 racers remain.
          </p>
          <p>
            Elimination cuts rank racers by wins, then fewer losses, then faster average time, then more heats run, then lower car number.
          </p>
          <p>
            The final 2 racers run a finals round with the same lane-coverage rule; the champion is whoever finishes on top of standings after those heats.
          </p>
          {eligibleCars > 0 ? (
            <>
              <p className="font-semibold">
                For this event: {eliminationPlan.join(' -> ')} (start to final), {finalEliminatedCount} total eliminations.
              </p>
              <p>
                Lane target per stage: every active car must run each of the {laneCount} lanes once before the next cut.
              </p>
            </>
          ) : (
            <p className="font-semibold">Add and inspect cars to see this event&apos;s projected finals cut line.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Ranking Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-slate-700 text-lg">
          <p>Leaderboard standings sort by wins first, then fewer losses, then faster average time.</p>
          <p>
            Current leaderboard entries: <span className="font-bold">{standings.length}</span>
            {currentEvent ? ` in ${currentEvent.name}` : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

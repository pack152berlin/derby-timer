import React from 'react';
import { Timer, Route, Shuffle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApp } from '../../context';
import { buildEliminationPlan } from '../../../race/elimination';
import { SectionHeading, Callout } from './components';

export function OverviewPage() {
  const { currentEvent, racers, standings } = useApp();

  const eligibleCars = racers.filter((r) => r.weight_ok).length;
  const laneCount = currentEvent?.lane_count ?? 4;
  const eliminationPlan = buildEliminationPlan(eligibleCars);
  const finalFieldSize = eliminationPlan[eliminationPlan.length - 1] ?? 0;
  const finalEliminatedCount = Math.max(0, eligibleCars - finalFieldSize);

  const pillars = [
    {
      icon: <Timer className="w-6 h-6" />,
      title: 'Rolling Queue',
      tag: '2–3 heats ahead',
      desc: 'Only a few heats are generated at a time so late results can influence upcoming matchups.',
    },
    {
      icon: <Route className="w-6 h-6" />,
      title: 'Lane Fairness',
      tag: 'Every car, every lane',
      desc: 'Heat planning ensures each car gets a fair shot across every lane on the track.',
    },
    {
      icon: <Shuffle className="w-6 h-6" />,
      title: 'Similar Records',
      tag: 'Best effort matching',
      desc: 'As results come in, DerbyTimer groups cars with similar win/loss records together.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Three pillars */}
      <div className="grid gap-3 sm:grid-cols-3">
        {pillars.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-lg bg-[#003F87]/10 flex items-center justify-center text-[#003F87]">
              {p.icon}
            </div>
            <p className="font-bold text-slate-900">{p.title}</p>
            <Badge className="bg-[#003F87]/10 text-[#003F87] text-xs font-semibold hover:bg-[#003F87]/10">
              {p.tag}
            </Badge>
            <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Elimination */}
      <SectionHeading id="elimination">Elimination Checkpoint</SectionHeading>

      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 p-5 space-y-3 text-slate-800">
        <p>
          Only inspected racers are eligible. Each active field runs a full lane-coverage cycle,
          then the field is cut to about half (rounded up) until 2 racers remain.
        </p>
        <p>
          Elimination cuts rank racers by wins, then fewer losses, then faster average time, then
          more heats run, then lower car number.
        </p>
        <p>
          The final 2 racers run a finals round with the same lane-coverage rule; the champion is
          whoever finishes on top of standings after those heats.
        </p>
        {eligibleCars > 0 ? (
          <div className="rounded-lg bg-white/70 border border-blue-100 px-4 py-3 mt-2">
            <p className="font-bold text-[#003F87] text-sm">
              This event: {eliminationPlan.join(' → ')} (start to final) &middot;{' '}
              {finalEliminatedCount} total eliminations
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Lane target per stage: every active car must run each of the {laneCount} lanes once
              before the next cut.
            </p>
          </div>
        ) : (
          <Callout variant="blue">
            Add and inspect cars to see this event&apos;s projected finals cut line.
          </Callout>
        )}
      </div>

      {/* Ranking */}
      <SectionHeading id="ranking">Ranking Rules</SectionHeading>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
        <p className="text-slate-700">
          Leaderboard standings sort by <strong>wins first</strong>, then fewer losses, then faster
          average time.
        </p>
        {currentEvent && (
          <p className="text-sm text-slate-500">
            Current leaderboard: <span className="font-bold text-slate-700">{standings.length}</span>{' '}
            entries in {currentEvent.name}
          </p>
        )}
      </div>
    </div>
  );
}

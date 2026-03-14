import React from 'react';
import {
  Trophy,
  Target,
  Zap,
  Swords,
  Crown,
  Hash,
  Medal,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from './components';

export function StandingsPage() {
  return (
    <div className="space-y-8">
      <SectionHeading id="how-rankings">How Rankings Work</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Every heat produces a <strong>winner</strong> (1st place) and losses for everyone else.
          The leaderboard sorts primarily by <strong>win count</strong>: the car with the most wins
          sits at the top.
        </p>
        <p>
          This placement-based system works without electronic timing — even visual judging is enough
          to determine who crossed the line first.
        </p>
      </div>

      <SectionHeading id="tiebreakers">Tiebreaker Chain</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>When two or more cars share the same win count, ties are broken in order:</p>
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          {[
            {
              rank: 1,
              label: 'Most Wins',
              desc: 'Primary ranking factor. More wins = higher standing.',
              icon: <Trophy className="w-5 h-5 text-yellow-500" />,
              accent: 'bg-yellow-400',
            },
            {
              rank: 2,
              label: 'Fewest Losses',
              desc: 'Among equal winners, fewer losses means a better record.',
              icon: <Target className="w-5 h-5 text-[#003F87]" />,
              accent: 'bg-[#003F87]',
            },
            {
              rank: 3,
              label: 'Faster Average Time',
              desc: 'If wins and losses match, the faster car takes precedence. Requires electronic timing.',
              icon: <Clock className="w-5 h-5 text-emerald-600" />,
              accent: 'bg-emerald-500',
            },
            {
              rank: 4,
              label: 'More Heats Run',
              desc: 'Used during elimination — more race experience edges out fewer heats.',
              icon: <Swords className="w-5 h-5 text-slate-500" />,
              accent: 'bg-slate-400',
            },
            {
              rank: 5,
              label: 'Lower Car Number',
              desc: 'Final fallback. Purely deterministic — ensures no true ties.',
              icon: <Hash className="w-5 h-5 text-slate-400" />,
              accent: 'bg-slate-300',
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className={cn(
                'flex items-start gap-3 px-4 py-3 relative',
                i < 4 && 'border-b border-slate-100',
              )}
            >
              <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-r', item.accent)} />
              <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 mt-0.5 ml-1">
                {item.rank}
              </div>
              <div className="shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{item.label}</p>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionHeading id="leaderboard">Reading the Leaderboard</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>The standings table shows these columns for each racer:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              label: 'Place',
              desc: 'Overall rank after tiebreakers',
              icon: <Medal className="w-4 h-4" />,
            },
            {
              label: 'W / L',
              desc: 'Wins and losses from completed heats',
              icon: <Swords className="w-4 h-4" />,
            },
            {
              label: 'Avg Time',
              desc: 'Mean finish time (if timed)',
              icon: <Clock className="w-4 h-4" />,
            },
            {
              label: 'Best Time',
              desc: 'Single fastest heat',
              icon: <Zap className="w-4 h-4" />,
            },
            {
              label: 'Heats',
              desc: 'Total number raced',
              icon: <Hash className="w-4 h-4" />,
            },
            {
              label: 'Den',
              desc: 'Group assignment',
              icon: <Crown className="w-4 h-4" />,
            },
          ].map((col) => (
            <div
              key={col.label}
              className="rounded-lg border border-slate-150 bg-white px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 text-[#003F87] mb-0.5">
                {col.icon}
                <span className="font-bold text-xs uppercase tracking-wide">{col.label}</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">{col.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

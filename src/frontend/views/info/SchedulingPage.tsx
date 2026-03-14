import React from 'react';
import { Trophy, Target, Zap, Hash, ArrowUpDown, ChevronRight } from 'lucide-react';
import { SectionHeading, Callout, StepList } from './components';

export function SchedulingPage() {
  return (
    <div className="space-y-8">
      <SectionHeading id="how-heats">How Heats Are Generated</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          DerbyTimer uses an <strong>adaptive greedy algorithm</strong> with a rolling queue. Instead
          of locking in the entire schedule upfront, only 2–3 heats are planned ahead. As each heat
          completes, new ones are generated using the latest standings.
        </p>
        <StepList
          steps={[
            {
              title: 'Pick a seed racer',
              desc: 'The car with the greatest unmet lane-coverage need starts the heat.',
            },
            {
              title: 'Select companions',
              desc: 'Scored by lane need, avoiding repeat matchups, and grouping similar win rates.',
            },
            {
              title: 'Assign lanes',
              desc: 'Branch-and-bound search minimizes lane-need penalties, historical repeats, and global imbalance.',
            },
          ]}
        />
      </div>

      <SectionHeading id="lane-coverage">Lane Coverage</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Fairness starts with the track. Every car must race in <strong>every lane</strong> before
          the round is considered complete. No car gets stuck in a consistently fast or slow lane.
        </p>
        <Callout>
          On a 4-lane track, each car runs at least 4 heats per round — one in each lane.
        </Callout>
      </div>

      <SectionHeading id="matchup-quality">Matchup Quality</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          As W/L records diverge, the planner groups cars with <strong>similar records</strong> in
          the same heat. Top contenders increasingly face each other, producing tighter races — while
          every car still gets fair lane exposure.
        </p>
        <p>
          Past matchups are tracked. If two cars have already raced multiple times, that pairing is
          penalized to keep the field mixed.
        </p>
      </div>

      <SectionHeading id="elimination">Elimination Rounds</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          After all active cars complete a full lane cycle, the field is{' '}
          <strong>cut to roughly half</strong> (rounded up). Survivors are selected by a strict
          tiebreaker chain:
        </p>
        <div className="flex flex-wrap items-center gap-1.5 my-3">
          {[
            { label: 'Most Wins', icon: <Trophy className="w-3.5 h-3.5" /> },
            { label: 'Fewest Losses', icon: <Target className="w-3.5 h-3.5" /> },
            { label: 'Faster Avg Time', icon: <Zap className="w-3.5 h-3.5" /> },
            { label: 'More Heats Run', icon: <Hash className="w-3.5 h-3.5" /> },
            { label: 'Lower Car #', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-700">
                {step.icon}
                {step.label}
              </span>
            </React.Fragment>
          ))}
        </div>
        <p>
          This halving repeats — each surviving field runs another full lane cycle, then gets cut —
          until only <strong>2 racers remain</strong>.
        </p>
      </div>

      <SectionHeading id="finals">Finals</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          The final 2 cars race a dedicated <strong>finals round</strong> under the same
          lane-coverage rule: every lane, at least once. The champion is whoever finishes on top of
          standings.
        </p>
        <Callout variant="amber">
          On a 4-lane track, the finals require at least 2 heats (2 cars across 4 lanes, with empty
          lanes).
        </Callout>
      </div>
    </div>
  );
}

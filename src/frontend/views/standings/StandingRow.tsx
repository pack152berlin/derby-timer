import React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEN_IMAGES } from '../../lib/den-utils';

export const COL = {
  rank: 'w-24 shrink-0',
  time: 'w-20 shrink-0',
  car:  'w-14 shrink-0',
  name: 'flex-1 min-w-0',
  den:  'w-28 shrink-0',
  wins: 'w-14 shrink-0',
  sec:  'w-12 shrink-0',
  thi:  'w-12 shrink-0',
};

const RANK_ACCENT: Record<number, string> = {
  1: 'border-l-amber-400 bg-amber-50/40',
  2: 'border-l-slate-300 bg-slate-50/30',
  3: 'border-l-orange-400 bg-orange-50/20',
};

const RANK_TEXT: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-500',
  3: 'text-orange-600',
};

function ordinal(n: number) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function DenBadge({ den }: { den: string }) {
  const img = DEN_IMAGES[den];
  if (img) {
    return <img src={img} alt={den} title={den} className="h-9 w-9 object-contain" />;
  }
  return (
    <span className="inline-block text-sm font-black tracking-widest leading-none text-slate-700">
      {den}
    </span>
  );
}

interface StandingRowProps {
  standing: {
    racer_id: string;
    car_number: string;
    racer_name: string;
    wins: number;
    rank: number;
    den: string | null;
  };
  idx: number;
  seconds: number;
  thirds: number;
  bestTimeMs?: number | null;
  showTime?: boolean;
  onClick: () => void;
}

export function StandingRow({ standing, idx, seconds, thirds, bestTimeMs, showTime, onClick }: StandingRowProps) {
  const { rank } = standing;
  const accent = RANK_ACCENT[rank] ?? 'border-l-transparent bg-white';
  const rankTextClass = RANK_TEXT[rank] ?? 'text-slate-400';

  return (
    <div
      data-testid={`standing-card-${standing.car_number}`}
      className={cn(
        "flex items-center py-3 cursor-pointer transition-colors border-l-4",
        "hover:brightness-[0.97] active:brightness-95",
        idx > 0 && "border-t border-slate-100",
        accent,
      )}
      onClick={onClick}
    >
      <div className={cn(COL.rank, "flex items-center gap-1 pl-4 pr-2")}>
        {rank === 1 && <Trophy size={12} className="text-amber-400 shrink-0" />}
        <span className={cn("text-sm font-black leading-none tabular-nums", rankTextClass)}>
          {ordinal(rank)}
        </span>
      </div>

      {showTime && (
        <div className={cn(COL.time, "px-2 flex justify-center items-center")}>
          {bestTimeMs != null ? (
            <span className="text-sm font-mono font-bold text-slate-600 tabular-nums">
              {(bestTimeMs / 1000).toFixed(3)}s
            </span>
          ) : (
            <span className="text-sm text-slate-300">—</span>
          )}
        </div>
      )}
      <div className={cn(COL.car, "px-2 flex justify-center")}>
        <span className="text-base font-black text-[#003F87] leading-none">
          #{standing.car_number}
        </span>
      </div>

      <div className={cn(COL.name, "px-2")}>
        <p className="font-bold text-base text-slate-900 leading-tight truncate">
          {standing.racer_name}
        </p>
      </div>

      <div className={cn(COL.den, "px-2 flex justify-center")}>
        {standing.den && <DenBadge den={standing.den} />}
      </div>

      <div className={cn(COL.wins, "text-center")}>
        <p className={cn(
          "text-xl font-black leading-none tabular-nums",
          standing.wins > 0 ? "text-amber-600" : "text-slate-300"
        )}>
          {standing.wins}
        </p>
      </div>

      <div className={cn(COL.sec, "text-center")}>
        <p className={cn(
          "text-xl font-black leading-none tabular-nums",
          seconds > 0 ? "text-slate-600" : "text-slate-300"
        )}>
          {seconds}
        </p>
      </div>

      <div className={cn(COL.thi, "text-center")}>
        <p className={cn(
          "text-xl font-black leading-none tabular-nums",
          thirds > 0 ? "text-orange-600" : "text-slate-300"
        )}>
          {thirds}
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';
import { LilyChevronDown, LilyChevronUp } from '@/components/LilyChevron';
import { COL } from './StandingRow';

export type SortCol = 'rank' | 'time' | 'car' | 'name' | 'den' | 'wins' | 'seconds' | 'thirds';
export type SortDir = 'asc' | 'desc';

function SortIndicator({ dir, visible }: { dir: SortDir; visible: boolean }) {
  const Icon = dir === 'asc' ? LilyChevronUp : LilyChevronDown;
  return <Icon size={12} className={cn("shrink-0 transition-opacity", !visible && "opacity-0")} />;
}

interface SortHeaderProps {
  col: SortCol;
  label: string;
  activeTextClass?: string;
  inactiveClass?: string;
  center?: boolean;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
}

function SortHeader({
  col, label,
  activeTextClass = 'text-slate-800',
  inactiveClass = 'text-slate-400 hover:text-slate-600',
  center = false,
  sortCol, sortDir, onSort,
}: SortHeaderProps) {
  const active = sortCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={cn(
        'w-full flex items-center gap-1.5 text-sm font-black uppercase tracking-normal',
        'transition-colors select-none cursor-pointer outline-none focus:outline-none',
        center && 'justify-center',
        active ? activeTextClass : inactiveClass,
      )}
    >
      {label}
      <SortIndicator dir={sortDir} visible={active} />
    </button>
  );
}

interface StandingHeaderProps {
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  showTime?: boolean;
}

export function StandingHeader({ sortCol, sortDir, onSort, showTime }: StandingHeaderProps) {
  const sortProps = { sortCol, sortDir, onSort };
  const colBg = (col: SortCol, active: string) => sortCol === col ? active : 'bg-slate-50';

  return (
    <div className="flex items-stretch border-b border-slate-200">
      <div className={cn(COL.rank, 'flex items-center pl-4 pr-2 py-2', colBg('rank', 'bg-slate-200'))}>
        <SortHeader col="rank" label="Rank" {...sortProps} />
      </div>
      {showTime && (
        <div className={cn(COL.time, 'flex items-center justify-center px-2 py-2', colBg('time', 'bg-slate-200'))}>
          <SortHeader col="time" label="Best" center {...sortProps} />
        </div>
      )}
      <div className={cn(COL.car, 'flex items-center justify-center px-5 py-2', colBg('car', 'bg-slate-200'))}>
        <SortHeader col="car" label="Car" center {...sortProps} />
      </div>
      <div className={cn(COL.name, 'flex items-center px-2 py-2', colBg('name', 'bg-slate-200'))}>
        <SortHeader col="name" label="Racer" {...sortProps} />
      </div>
      <div className={cn(COL.den, 'flex items-center justify-center px-2 py-2', colBg('den', 'bg-slate-200'))}>
        <SortHeader col="den" label="Den" center {...sortProps} />
      </div>
      <div className={cn(COL.wins, 'flex items-center justify-center px-5 py-2', colBg('wins', 'bg-amber-100'))}>
        <SortHeader
          col="wins" label="Wins"
          activeTextClass="text-amber-800"
          inactiveClass="text-amber-500 hover:text-amber-700"
          center {...sortProps}
        />
      </div>
      <div className={cn(COL.sec, 'flex items-center justify-center px-5 py-2', colBg('seconds', 'bg-slate-200'))}>
        <SortHeader
          col="seconds" label="2nd"
          activeTextClass="text-slate-700"
          inactiveClass="text-slate-400 hover:text-slate-600"
          center {...sortProps}
        />
      </div>
      <div className={cn(COL.thi, 'flex items-center justify-center px-1 py-2', colBg('thirds', 'bg-orange-100'))}>
        <SortHeader
          col="thirds" label="3rd"
          activeTextClass="text-orange-700"
          inactiveClass="text-orange-400 hover:text-orange-600"
          center {...sortProps}
        />
      </div>
    </div>
  );
}

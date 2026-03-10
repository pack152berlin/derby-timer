import React, { useMemo } from 'react';
import { Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Heat, HeatLane, Racer } from '../types';
import { api } from '../api';

interface HeatLaneGridProps {
  heat: Heat;
  racers: Racer[];
  laneCount: number;
  /** Optional extra content rendered inside each lane tile, below the car info. */
  renderLaneFooter?: (lane: HeatLane) => React.ReactNode;
}

function EmptyLane({ laneNum, status }: { laneNum: number; status: string }) {
  return (
    <div className="flex flex-col bg-white overflow-hidden">
      <div className={cn(
        'flex items-center justify-center gap-2 px-3 py-2',
        status === 'pending' && 'bg-[#003F87]',
        status === 'running' && 'bg-[#CE1126]',
        status === 'complete' && 'bg-emerald-600',
      )}>
        <span className="text-xs font-black uppercase tracking-widest text-white/60">Lane</span>
        <span className="text-3xl font-black text-white leading-none">{laneNum}</span>
      </div>
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="relative text-slate-300">
          <Car className="w-10 h-10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-px bg-slate-300 rotate-45" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeatLaneGrid({ heat, racers, laneCount, renderLaneFooter }: HeatLaneGridProps) {
  const racerById = useMemo(() => {
    const map = new Map<string, Racer>();
    racers.forEach(r => map.set(r.id, r));
    return map;
  }, [racers]);

  const laneNums = Array.from({ length: laneCount }, (_, i) => i + 1);
  const anyPhotos = heat.lanes?.some(lane => racerById.get(lane.racer_id)?.car_photo_filename) ?? false;

  return (
    <div
      className={cn(
        'grid gap-px',
        heat.status === 'pending' && 'bg-slate-100',
        heat.status === 'running' && 'bg-red-200',
        heat.status === 'complete' && 'bg-emerald-200',
      )}
      style={{ gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))` }}
    >
      {laneNums.map(laneNum => {
        const lane = heat.lanes?.find(l => l.lane_number === laneNum);

        if (!lane) {
          return <EmptyLane key={laneNum} laneNum={laneNum} status={heat.status} />;
        }

        const racer = racerById.get(lane.racer_id);
        const photoUrl = racer?.car_photo_filename
          ? api.getRacerPhotoUrl(lane.racer_id, racer.updated_at)
          : null;

        const result = heat.results?.find(r => r.racer_id === lane.racer_id);

        return (
          <div key={lane.id} className="flex flex-col bg-white overflow-hidden relative">
            {/* Result Badge Overlay */}
            {heat.status === 'complete' && result && (
              <div className={cn(
                "absolute top-12 left-2 z-10 px-2 py-1 rounded shadow-md font-black text-xs uppercase tracking-wider border-2",
                result.place === 1 ? "bg-amber-400 border-amber-500 text-amber-950" : "bg-white border-slate-200 text-slate-600"
              )}>
                {result.dnf ? 'DNF' : (result.place === 1 ? 'Winner' : `${result.place}${result.place === 2 ? 'nd' : (result.place === 3 ? 'rd' : 'th')}`)}
              </div>
            )}

            {/* Lane number band */}
            <div className={cn(
              'flex items-center justify-center gap-2 px-3 py-2',
              heat.status === 'pending' && 'bg-[#003F87]',
              heat.status === 'running' && 'bg-[#CE1126]',
              heat.status === 'complete' && 'bg-emerald-600',
            )}>
              <span className="text-xs font-black uppercase tracking-widest text-white/60">Lane</span>
              <span className="text-3xl font-black text-white leading-none">{lane.lane_number}</span>
            </div>

            {/* Photo — only rendered when at least one car in the heat has a photo */}
            {anyPhotos && (
              <div className="aspect-square w-full bg-slate-300 relative overflow-hidden">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={`Car #${lane.car_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-100">
                    <Car className="w-10 h-10 text-slate-500" />
                    <span className="text-lg font-black text-slate-500">#{lane.car_number}</span>
                  </div>
                )}
              </div>
            )}

            {/* Car info */}
            <div className="px-3 pb-3 bg-white flex-1 text-center">
              <div className="text-xs font-bold text-slate-500 truncate mt-1 mb-2">
                {lane.racer_name}
              </div>
              <div className="text-2xl font-black text-[#003F87] leading-none mt-1">
                #{lane.car_number}
              </div>
            </div>

            {renderLaneFooter && (
              <div className="px-3 pb-3 bg-white">
                {renderLaneFooter(lane)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

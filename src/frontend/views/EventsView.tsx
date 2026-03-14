import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Flag, Clock, Plus, X, Pencil, Users, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Event } from '../types';
import { api } from '../api';
import { useApp } from '../context';
import { AdminBanner } from '../components/AdminBanner';

const STATUS_CONFIG: Record<Event['status'], { label: string; accent: string; pill: string; pulse?: boolean; border?: string }> = {
  draft: {
    label: 'Draft',
    accent: 'bg-slate-300',
    pill: 'bg-slate-100 text-slate-600 border-slate-300',
    border: 'border-dashed border-slate-300',
  },
  checkin: {
    label: 'Check-in',
    accent: 'bg-blue-500',
    pill: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  racing: {
    label: 'Racing',
    accent: 'bg-[#CE1126]',
    pill: 'bg-red-50 text-[#CE1126] border-red-300',
    pulse: true,
  },
  complete: {
    label: 'Complete',
    accent: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
};

export function EventsView({ onSelectEvent }: { onSelectEvent: (e: Event) => void }) {
  const { canEdit } = useApp();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const data = await api.getEvents();
    setEvents(data);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await api.deleteEvent(eventToDelete.id);
      setEventToDelete(null);
      loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">
            Race Events
          </h1>
          <p className="text-slate-500 mt-1">Select an event or create a new race day</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => navigate('/new')}
            size="lg"
            className="bg-[#003F87] hover:bg-[#002f66] text-white font-semibold px-6 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Event
          </Button>
        )}
      </div>

      <AdminBanner />

      <div className="grid gap-4 md:grid-cols-2">
        {events.map(event => {
          const cfg = STATUS_CONFIG[event.status];
          return (
            <div
              key={event.id}
              data-testid={`event-card-${event.id}`}
              className={cn(
                'group relative rounded-xl border-2 bg-white overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-[#003F87]',
                cfg.border ?? 'border-slate-200',
              )}
              onClick={() => onSelectEvent(event)}
            >
              {/* Left accent band */}
              <div className={cn('absolute inset-y-0 left-0 w-1.5 rounded-l-xl', cfg.accent, cfg.pulse && 'animate-pulse')} />

              <div className="pl-5 pr-4 py-4">
                {/* Top row: name + status pill */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{event.name}</h3>
                  <span className={cn(
                    'shrink-0 inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                    cfg.pill,
                  )}>
                    {cfg.label}
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <Clock size={14} className="text-[#CE1126] shrink-0" />
                  <span className="font-medium">
                    {new Date(event.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                {/* Stat chips + action buttons row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-1">
                      <Users size={12} className="text-slate-400" />
                      {event.racer_count} Racers
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-1">
                      <Layers size={12} className="text-slate-400" />
                      {event.lane_count} Lanes
                    </span>
                  </div>

                  {/* Admin actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/event/${event.id}/edit`);
                        }}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#003F87] hover:bg-[#003F87]/10 transition-colors cursor-pointer"
                        title="Edit Event"
                      >
                        <Pencil size={14} />
                      </button>
                      {event.racer_count === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(event);
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Event"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{eventToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setEventToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEvent}>
              Delete Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="border-2 border-dashed border-slate-300 rounded-2xl py-20 px-8 text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-xl font-bold text-slate-700 mb-1">No events yet</p>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Create your first race day to start managing heats, racers, and standings.
          </p>
          {canEdit && (
            <Button
              onClick={() => navigate('/new')}
              size="lg"
              className="bg-[#003F87] hover:bg-[#002f66] text-white font-semibold px-8 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create First Event
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

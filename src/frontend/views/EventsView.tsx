import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Flag, Clock, Plus, X } from 'lucide-react';
import { LilyChevronRight } from '@/components/LilyChevron';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Event } from '../types';
import { api } from '../api';
import { useApp } from '../context';
import { AdminBanner } from '../components/AdminBanner';

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


  const getStatusBadge = (status: Event['status']) => {
    const variants: Record<string, { variant: any; className: string }> = {
      draft: { variant: 'secondary' as const, className: 'bg-slate-100 text-slate-600 border-slate-300' },
      checkin: { variant: 'default' as const, className: 'bg-blue-50 text-blue-800 border-blue-300' },
      racing: { variant: 'default' as const, className: 'bg-red-50 text-red-700 border-red-300' },
      complete: { variant: 'default' as const, className: 'bg-emerald-50 text-emerald-700 border-emerald-300' }
    };
    return variants[status] || { variant: 'secondary' as const, className: 'bg-slate-100 text-slate-600' };
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">
            Race Events
          </h1>
          <p className="text-slate-500 mt-1">Select an event or create a new race event!</p>
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
          const statusBadge = getStatusBadge(event.status);
          return (
            <Card 
              key={event.id}
              data-testid={`event-card-${event.id}`}
              className="group relative cursor-pointer hover:border-[#003F87] transition-all duration-200 hover:shadow-lg border-2 gap-2"
              onClick={() => onSelectEvent(event)}
            >
              {canEdit && event.racer_count === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEventToDelete(event);
                  }}
                  className="absolute -top-2 -right-2 h-8 px-2 rounded-full bg-white border shadow-sm text-slate-400 hover:text-white hover:bg-red-600 transition-all z-10 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Delete Event"
                >
                  <X className="h-3 w-3" />
                  <span className="text-[10px] font-bold uppercase">Delete</span>
                </Button>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl">{event.name}</CardTitle>
                  <Badge 
                    variant={statusBadge.variant}
                    className={cn("uppercase tracking-wider text-xs", statusBadge.className)}
                  >
                    {event.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-slate-500 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock size={16} className="text-[#CE1126]" />
                    <span className="font-medium">{new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag size={16} className="text-slate-400" />
                    <span className="font-medium">{event.racer_count} Racers / {event.lane_count} Lanes</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 flex items-center justify-end text-[#003F87] font-semibold text-sm">
                  Select Event
                  <LilyChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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

      {events.length === 0 && (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium">No events yet</p>
            <p className="text-slate-400 mt-1">Create your first race day to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

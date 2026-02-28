import React, { useState, useEffect } from 'react';
import { Trophy, Flag, Clock, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Event } from '../types';
import { api } from '../api';

export function EventsView({ onSelectEvent }: { onSelectEvent: (e: Event) => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const data = await api.getEvents();
    setEvents(data);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const event = await api.createEvent({
      name: formData.get('name') as string,
      date: formData.get('date') as string,
      lane_count: parseInt(formData.get('lane_count') as string)
    });
    setShowForm(false);
    onSelectEvent(event);
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
          <p className="text-slate-500 mt-1">Select an event or create a new race day</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          size="lg"
          className="bg-[#003F87] hover:bg-[#002f66] text-white font-semibold px-6 shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Event
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8 border-2 border-slate-200">
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-slate-600">Event Name</label>
                <Input 
                  name="name" 
                  required 
                  placeholder="Pack 123 Pinewood Derby"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-600">Date</label>
                <Input 
                  name="date" 
                  type="date" 
                  required 
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-600">Lanes</label>
                <select 
                  name="lane_count" 
                  defaultValue="4"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#003F87] focus:border-transparent"
                >
                  <option value="2">2 Lanes</option>
                  <option value="3">3 Lanes</option>
                  <option value="4">4 Lanes</option>
                  <option value="5">5 Lanes</option>
                  <option value="6">6 Lanes</option>
                </select>
              </div>
              <div className="md:col-span-4 flex gap-2">
                <Button type="submit" className="flex-1 bg-[#003F87] hover:bg-[#002f66] text-white font-semibold">
                  Create Event
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {events.map(event => {
          const statusBadge = getStatusBadge(event.status);
          return (
            <Card 
              key={event.id}
              className="cursor-pointer hover:border-[#003F87] transition-all duration-200 hover:shadow-lg border-2"
              onClick={() => onSelectEvent(event)}
            >
              <CardHeader className="pb-3">
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
                <div className="space-y-2 text-slate-500 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#CE1126]" />
                    <span className="font-medium">{new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag size={16} className="text-slate-400" />
                    <span className="font-medium">{event.lane_count} Racing Lanes</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-[#003F87] font-semibold text-sm">
                  Select Event
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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

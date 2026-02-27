import type { Event, Racer, Heat, Standing, HeatResult } from './types';

type CreateRacerInput = {
  name: string;
  den?: string | null;
};

export const api = {
  async getEvents(): Promise<Event[]> {
    const res = await fetch('/api/events');
    return res.ok ? res.json() : [];
  },
  
  async createEvent(data: Partial<Event>): Promise<Event> {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  async getRacers(eventId: string): Promise<Racer[]> {
    const res = await fetch(`/api/events/${eventId}/racers`);
    return res.ok ? res.json() : [];
  },
  
  async createRacer(eventId: string, data: CreateRacerInput): Promise<Racer> {
    const res = await fetch(`/api/events/${eventId}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to add racer');
    }

    return res.json();
  },

  async uploadRacerPhoto(id: string, file: File): Promise<Racer> {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch(`/api/racers/${id}/photo`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Photo upload failed');
    }

    return res.json();
  },

  async deleteRacerPhoto(id: string): Promise<Racer> {
    const res = await fetch(`/api/racers/${id}/photo`, {
      method: 'DELETE',
    });
    return res.json();
  },

  getRacerPhotoUrl(id: string, updatedAt?: string): string {
    const cacheKey = updatedAt ? encodeURIComponent(updatedAt) : Date.now().toString();
    return `/api/racers/${id}/photo?v=${cacheKey}`;
  },
  
  async deleteRacer(id: string): Promise<void> {
    await fetch(`/api/racers/${id}`, { method: 'DELETE' });
  },
  
  async inspectRacer(id: string, pass: boolean): Promise<void> {
    await fetch(`/api/racers/${id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: pass })
    });
  },
  
  async getHeats(eventId: string): Promise<Heat[]> {
    const res = await fetch(`/api/events/${eventId}/heats`);
    return res.ok ? res.json() : [];
  },
  
  async generateHeats(
    eventId: string,
    options?: { rounds?: number; lookahead?: 2 | 3; lane_count?: number }
  ): Promise<Heat[]> {
    const res = await fetch(`/api/events/${eventId}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rounds: options?.rounds ?? 1,
        lookahead: options?.lookahead,
        lane_count: options?.lane_count,
      })
    });
    return res.json();
  },
  
  async clearHeats(eventId: string): Promise<void> {
    await fetch(`/api/events/${eventId}/heats`, { method: 'DELETE' });
  },
  
  async startHeat(heatId: string): Promise<void> {
    await fetch(`/api/heats/${heatId}/start`, { method: 'POST' });
  },
  
  async completeHeat(heatId: string): Promise<void> {
    await fetch(`/api/heats/${heatId}/complete`, { method: 'POST' });
  },
  
  async saveResults(heatId: string, results: HeatResult[]): Promise<void> {
    await fetch(`/api/heats/${heatId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results })
    });
  },
  
  async getStandings(eventId: string): Promise<Standing[]> {
    const res = await fetch(`/api/events/${eventId}/standings`);
    return res.ok ? res.json() : [];
  }
};

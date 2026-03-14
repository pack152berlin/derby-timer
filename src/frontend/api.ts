import type { Event, Racer, Heat, Standing, HeatResult, RacerHistoryEntry, EventAward, EventAwardWinner } from './types';

export type AuthStatus = {
  admin: boolean;
  viewer: boolean;
  publicMode: boolean;
  privateMode: boolean;
};

type CreateRacerInput = {
  name: string;
  den?: string | null;
};

type UpdateRacerInput = {
  name?: string;
  den?: string | null;
  car_number?: string;
  weight_ok?: boolean;
};

export const api = {
  async getEvents(): Promise<Event[]> {
    const res = await fetch('/api/events');
    return res.ok ? res.json() : [];
  },

  async getEvent(id: string): Promise<Event | null> {
    const res = await fetch(`/api/events/${id}`);
    return res.ok ? res.json() : null;
  },
  
  async deleteEvent(id: string): Promise<void> {
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to delete event (${res.status})`);
    }
  },
  
  async updateEvent(id: string, data: { name?: string; date?: string; lane_count?: number; organization?: string; status?: string }): Promise<Event> {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to update event (${res.status})`);
    }
    return res.json();
  },

  async createEvent(data: Partial<Event>): Promise<Event> {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  async endRace(eventId: string): Promise<void> {
    const res = await fetch(`/api/events/${eventId}/end-race`, { method: 'POST' });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to end race');
    }
  },

  async getRacer(id: string): Promise<Racer | null> {
    const res = await fetch(`/api/racers/${id}`);
    return res.ok ? res.json() : null;
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

  async updateRacer(id: string, data: UpdateRacerInput): Promise<Racer> {
    const res = await fetch(`/api/racers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to update racer');
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
    const res = await fetch(`/api/heats/${heatId}/start`, { method: 'POST' });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Unable to start heat');
    }
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
  },

  async getAuthStatus(): Promise<AuthStatus> {
    const res = await fetch('/admin/status');
    if (!res.ok) return { admin: false, viewer: false, publicMode: false, privateMode: false };
    return res.json();
  },

  /** Unified login — tries admin key first, then viewer key. Returns the matched role or null. */
  async login(password: string): Promise<'admin' | 'viewer' | null> {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { role: string };
    if (data.role === 'admin' || data.role === 'viewer') return data.role;
    return null;
  },

  async logout(): Promise<void> {
    await fetch('/admin/logout', { method: 'POST' });
    await fetch('/viewer/logout', { method: 'POST' });
  },

  async getRacerHistory(racerId: string): Promise<RacerHistoryEntry[]> {
    const res = await fetch(`/api/racers/${racerId}/history`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: any) => ({
      ...r,
      dnf: !!r.dnf
    }));
  },

  async getAwards(eventId: string): Promise<EventAward[]> {
    const res = await fetch(`/api/events/${eventId}/awards`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((a: any) => ({
      ...a,
      allow_second: !!a.allow_second,
      allow_third: !!a.allow_third,
    }));
  },

  async setAwards(eventId: string, awards: { name: string; allow_second?: boolean; allow_third?: boolean }[]): Promise<EventAward[]> {
    const res = await fetch(`/api/events/${eventId}/awards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awards }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to set awards (${res.status})`);
    }
    const data = await res.json();
    return data.map((a: any) => ({ ...a, allow_second: !!a.allow_second, allow_third: !!a.allow_third }));
  },

  async updateAward(id: string, data: { name?: string; allow_second?: boolean; allow_third?: boolean }): Promise<EventAward> {
    const res = await fetch(`/api/awards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to update award (${res.status})`);
    }
    const award = await res.json();
    return { ...award, allow_second: !!award.allow_second, allow_third: !!award.allow_third };
  },

  async deleteAward(id: string): Promise<void> {
    const res = await fetch(`/api/awards/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to delete award (${res.status})`);
    }
  },

  async getAwardWinners(eventId: string): Promise<EventAwardWinner[]> {
    const res = await fetch(`/api/events/${eventId}/award-winners`);
    return res.ok ? res.json() : [];
  },

  async setAwardWinners(awardId: string, winners: { racer_id: string; place: number }[]): Promise<void> {
    const res = await fetch(`/api/awards/${awardId}/winners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winners }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to save award winners (${res.status})`);
    }
  },

  async deleteAwardWinner(id: string): Promise<void> {
    const res = await fetch(`/api/award-winners/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to delete award winner (${res.status})`);
    }
  },
};

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Trophy, Flag, Car, Timer, AlertCircle, Zap, Target, TrendingUp, Activity } from 'lucide-react';
import './styles/styles.css';

interface Event {
  id: string;
  name: string;
  date: string;
  lane_count: number;
  status: 'draft' | 'checkin' | 'racing' | 'complete';
  created_at: string;
  updated_at: string;
}

interface HeatLane {
  id: string;
  heat_id: string;
  lane_number: number;
  racer_id: string;
  car_number?: string;
  racer_name?: string;
}

interface Heat {
  id: string;
  event_id: string;
  round: number;
  heat_number: number;
  status: 'pending' | 'running' | 'complete';
  started_at: string | null;
  finished_at: string | null;
  lanes?: HeatLane[];
}

interface Standing {
  racer_id: string;
  car_number: string;
  racer_name: string;
  wins: number;
  losses: number;
  heats_run: number;
  avg_time_ms: number | null;
}

const api = {
  async getEvents(): Promise<Event[]> {
    const res = await fetch('/api/events');
    return res.ok ? res.json() : [];
  },

  async getHeats(eventId: string): Promise<Heat[]> {
    const res = await fetch(`/api/events/${eventId}/heats`);
    return res.ok ? res.json() : [];
  },

  async getStandings(eventId: string): Promise<Standing[]> {
    const res = await fetch(`/api/events/${eventId}/standings`);
    return res.ok ? res.json() : [];
  }
};

function DisplayApp() {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = async () => {
    try {
      if (!currentEvent) {
        const events = await api.getEvents();
        const activeEvent = events.find(e => e.status === 'racing') || events[events.length - 1];
        if (activeEvent) {
          setCurrentEvent(activeEvent);
          const [heatsData, standingsData] = await Promise.all([
            api.getHeats(activeEvent.id),
            api.getStandings(activeEvent.id)
          ]);
          setHeats(heatsData);
          setStandings(standingsData);
        }
      } else {
        const [heatsData, standingsData] = await Promise.all([
          api.getHeats(currentEvent.id),
          api.getStandings(currentEvent.id)
        ]);
        setHeats(heatsData);
        setStandings(standingsData);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [currentEvent?.id]);

  const getCurrentHeat = () => {
    const pendingOrRunning = heats.find(h => h.status !== 'complete');
    if (pendingOrRunning) return pendingOrRunning;
    return heats
      .filter(h => h.status === 'complete')
      .sort((a, b) => b.heat_number - a.heat_number)[0];
  };

  const getTopStandings = (count: number = 5) => {
    return standings.slice(0, count);
  };

  const currentHeat = getCurrentHeat();
  const topStandings = getTopStandings();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-orange-500 mb-6">
            <Activity size={80} />
          </div>
          <p className="text-3xl text-slate-600 font-black">Loading Race Data...</p>
        </div>
      </div>
    );
  }

  if (error || !currentEvent) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={80} className="text-red-500 mx-auto mb-6" />
          <p className="text-3xl text-slate-600 font-black">{error || 'No event found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-8">
      {/* Header - Airport Style Board */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b-4 border-slate-900">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Flag size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-6xl font-black text-slate-900 uppercase tracking-tight">
              {currentEvent.name}
            </h1>
            <p className="text-2xl text-slate-500 mt-1 font-bold">Pinewood Derby Championship</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 text-slate-500">
            <Timer size={28} className="text-orange-500" />
            <span className="text-2xl font-mono font-bold">{lastUpdated.toLocaleTimeString()}</span>
          </div>
          <p className="text-slate-400 mt-1 font-semibold">Live Updates</p>
        </div>
      </div>

      {/* Main Content Grid - Motorsport Timing Style */}
      <div className="grid grid-cols-2 gap-6 h-[calc(100vh-240px)]">
        {/* Left: Current Heat - Large, Clear */}
        <div className="bg-white rounded-3xl border-4 border-slate-900 p-8 flex flex-col shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Zap size={40} className="text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Current Heat</h2>
              {currentHeat && (
                <p className="text-2xl text-orange-600 font-bold mt-1">
                  Round {currentHeat.round} • Heat {currentHeat.heat_number}
                </p>
              )}
            </div>
          </div>

          {currentHeat?.lanes ? (
            <div className="flex-1 flex flex-col justify-center gap-4">
              {currentHeat.lanes
                .sort((a, b) => a.lane_number - b.lane_number)
                .map((lane, index) => (
                <div 
                  key={lane.id}
                  className="bg-slate-50 rounded-2xl p-6 flex items-center gap-6 border-l-8 border-orange-500 shadow-lg"
                >
                  <div className="w-24 h-24 bg-slate-900 rounded-xl flex items-center justify-center text-5xl font-black text-white">
                    {lane.lane_number}
                  </div>
                  <div className="flex-1">
                    <p className="text-4xl font-black text-slate-900">{lane.racer_name || 'Unknown'}</p>
                    <p className="text-3xl text-orange-600 font-bold mt-1">Car #{lane.car_number || '?'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Flag size={100} className="text-slate-300 mx-auto mb-6" />
                <p className="text-4xl text-slate-500 font-black">No Heat Scheduled</p>
                <p className="text-2xl text-slate-400 mt-3">Waiting for race to begin...</p>
              </div>
            </div>
          )}

          {currentHeat?.status === 'running' && (
            <div className="mt-6 bg-orange-500 rounded-2xl p-6 text-center shadow-xl animate-pulse">
              <p className="text-5xl font-black text-white uppercase tracking-widest">
                Race in Progress!
              </p>
            </div>
          )}
        </div>

        {/* Right: Top Standings - Tournament Card Style */}
        <div className="bg-white rounded-3xl border-4 border-slate-900 p-8 flex flex-col shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center">
              <Trophy size={40} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Top Racers</h2>
              <p className="text-2xl text-slate-500 font-bold mt-1">
                {standings.length} Cars Competing
              </p>
            </div>
          </div>

          {topStandings.length > 0 ? (
            <div className="flex-1 flex flex-col justify-center gap-3">
              {topStandings.map((standing, index) => (
                <div 
                  key={standing.racer_id}
                  className="rounded-2xl p-5 flex items-center gap-6 border-2 shadow-lg"
                  style={{ 
                    backgroundColor: index === 0 ? '#fef3c7' : index === 1 ? '#f3f4f6' : index === 2 ? '#fef3e2' : '#f8fafc',
                    borderColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#f59e0b' : '#e2e8f0'
                  }}
                >
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black shadow-lg"
                    style={{ 
                      backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#f59e0b' : '#cbd5e1',
                      color: index < 3 ? '#1e293b' : '#475569'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-3xl font-black text-slate-900 truncate">{standing.racer_name}</p>
                    <p className="text-2xl text-orange-600 font-bold">Car #{standing.car_number}</p>
                  </div>
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className="text-3xl font-black text-emerald-600">{standing.wins}</p>
                      <p className="text-sm text-slate-500 uppercase font-bold">Wins</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-slate-700">{standing.heats_run}</p>
                      <p className="text-sm text-slate-500 uppercase font-bold">Heats</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Trophy size={100} className="text-slate-300 mx-auto mb-6" />
                <p className="text-4xl text-slate-500 font-black">No Results Yet</p>
                <p className="text-2xl text-slate-400 mt-3">Races will appear here...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Clean Status Bar */}
      <div className="mt-6 flex items-center justify-between text-slate-500">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xl font-semibold">Live Display • Auto-refreshing every 5 seconds</span>
        </div>
        <p className="text-xl font-bold">DerbyTimer Pro</p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<DisplayApp />);

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Flag, Users, Monitor, ExternalLink, Clock, BarChart3, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import './styles/styles.css';

import type { Event, Racer, Heat, Standing } from './types';
import { AppContext, useApp } from './context';
import { api } from './api';

import { EventsView } from './views/EventsView';
import { RegistrationView } from './views/RegistrationView';
import { HeatsView } from './views/HeatsView';
import { RaceConsoleView } from './views/RaceConsoleView';
import { StandingsView } from './views/StandingsView';
import { RaceFormatView } from './views/RaceFormatView';
import { RacerProfileView } from './views/RacerProfileView';
import { CertificateView } from './views/CertificateView';
import { PinewoodFullLoader } from './components/PinewoodLoader';

// ===== MAIN APP ROUTES =====

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [returnPath, setReturnPath] = useState<string>('/standings');
  const [racers, setRacers] = useState<Racer[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const fetchData = async (eventId: string) => {
    const [eventData, racersData, heatsData, standingsData] = await Promise.all([
      api.getEvent(eventId),
      api.getRacers(eventId),
      api.getHeats(eventId),
      api.getStandings(eventId)
    ]);
    if (eventData) setCurrentEvent(eventData);
    setRacers(racersData);
    setHeats(heatsData);
    setStandings(standingsData);
  };

  // Hydrate from localStorage on initial load
  useEffect(() => {
    const hydrate = async () => {
      const savedEventId = localStorage.getItem('derby_current_event_id');
      if (savedEventId) {
        try {
          const events = await api.getEvents();
          const event = events.find(e => e.id === savedEventId);
          if (event) {
            setCurrentEvent(event);
            await fetchData(event.id);
          } else {
            localStorage.removeItem('derby_current_event_id');
          }
        } catch (e) {
          console.error('Failed to hydrate event:', e);
        }
      }
      setIsHydrated(true);
    };
    hydrate();
  }, []);

  // Sync with WebSocket
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (currentEvent && data.eventId === currentEvent.id) {
            fetchData(currentEvent.id);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        socket?.close();
      };
    };

    if (currentEvent) connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [currentEvent?.id]);

  const selectEvent = async (event: Event | null) => {
    if (!event) {
      setCurrentEvent(null);
      setRacers([]);
      setHeats([]);
      setStandings([]);
      localStorage.removeItem('derby_current_event_id');
      navigate('/');
      return;
    }
    
    setCurrentEvent(event);
    localStorage.setItem('derby_current_event_id', event.id);
    setLoading(true);
    await fetchData(event.id);
    setLoading(false);
    navigate('/register');
  };

  const contextValue = {
    currentEvent,
    racers,
    heats,
    standings,
    setCurrentRacerId: (id: string | null) => {
      if (id) {
        if (!location.pathname.startsWith('/racer/')) {
          setReturnPath(location.pathname);
        }
        navigate(`/racer/${id}`);
      } else {
        navigate(returnPath);
      }
    },
    refreshData: async () => {
      if (!currentEvent) return;
      setLoading(true);
      await fetchData(currentEvent.id);
      setLoading(false);
    },
    refreshDataSilent: async () => {
      if (!currentEvent) return;
      await fetchData(currentEvent.id);
    },
    selectEvent
  };

  if (!isHydrated) {
    return <PinewoodFullLoader visible />;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navigation onGoHome={() => selectEvent(null)} />
        <main className="max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-8">
          <PinewoodFullLoader visible={loading} />
          
          <Routes>
            <Route path="/" element={<EventsView onSelectEvent={selectEvent} />} />
            
            {/* Protected Routes - redirect to / if no event is active */}
            <Route 
              path="/register" 
              element={currentEvent ? <RegistrationView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/heats" 
              element={currentEvent ? <HeatsView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/race" 
              element={currentEvent ? <RaceConsoleView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/standings" 
              element={currentEvent ? <StandingsView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/format" 
              element={currentEvent ? <RaceFormatView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/racer/:id" 
              element={currentEvent ? <RacerProfileView /> : <Navigate to="/" replace />} 
            />
            
            {/* Catch-all: back to events */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AppContext.Provider>
  );
}

// ===== MAIN APP WRAPPER =====

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Certificate routes render without nav chrome */}
        <Route path="/certificate/:id" element={<CertificateView />} />
        <Route path="/certificates" element={<CertificateView />} />
        {/* All other routes go through the main app shell */}
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}

// ===== NAVIGATION =====

function Navigation({ 
  onGoHome
}: { 
  onGoHome: () => void;
}) {
  const { currentEvent } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { id: 'register', label: 'Registration', icon: Users, path: '/register' },
    { id: 'heats', label: 'Schedule', icon: Clock, path: '/heats' },
    { id: 'race', label: 'Race Control', icon: Flag, path: '/race' },
    { id: 'standings', label: 'Standings', icon: BarChart3, path: '/standings' }
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onGoHome}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-[#003F87] to-[#CE1126] rounded-lg flex items-center justify-center shadow-lg">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Derby<span className="text-[#CE1126]">Timer</span>
              </span>
              {currentEvent && (
                <span className="text-xs text-slate-500 font-medium truncate max-w-[68vw] sm:max-w-[200px]">
                  {currentEvent.name}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-1 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            <button
              onClick={() => navigate('/format')}
              className={cn(
                "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200",
                location.pathname === '/format'
                  ? "bg-[#003F87] text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <BookOpen size={18} />
              <span>Race Format</span>
            </button>

            {!currentEvent ? (
              <Badge variant="outline" className="h-11 px-4 text-sm font-semibold ml-1 sm:ml-2 flex items-center">
                Select an event to begin
              </Badge>
            ) : (
              <>
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.id}
                      data-testid={`nav-${item.id}`}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200",
                        isActive
                          ? "bg-[#003F87] text-white shadow-md"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                
                <a
                  href="/display"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-l border-slate-300 ml-2"
                  title="Open Display View for Projector"
                >
                  <Monitor size={18} />
                  <span>Display</span>
                  <ExternalLink size={14} className="text-slate-400" />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ===== MOUNT APP =====

const root = createRoot(document.getElementById('app')!);
root.render(<App />);

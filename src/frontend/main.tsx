import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Flag, Users, Monitor, ExternalLink, Clock, BarChart3, BookOpen, LogIn, LogOut, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, CURRENT_EVENT_KEY } from '@/lib/utils';
import './styles/styles.css';

import type { Event, Racer, Heat, Standing } from './types';
import type { AuthStatus } from './api';
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
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    admin: false, viewer: false, publicMode: true, privateMode: false,
  });

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
      try {
        const status = await api.getAuthStatus();
        setAuthStatus(status);
      } catch (e) {
        console.error('Failed to fetch auth status:', e);
      }

      const savedEventId = localStorage.getItem(CURRENT_EVENT_KEY);
      if (savedEventId) {
        try {
          const events = await api.getEvents();
          const event = events.find(e => e.id === savedEventId);
          if (event) {
            setCurrentEvent(event);
            await fetchData(event.id);
          } else {
            localStorage.removeItem(CURRENT_EVENT_KEY);
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
      localStorage.removeItem(CURRENT_EVENT_KEY);
      navigate('/');
      return;
    }
    
    setCurrentEvent(event);
    localStorage.setItem(CURRENT_EVENT_KEY, event.id);
    setLoading(true);
    await fetchData(event.id);
    setLoading(false);
    const canEdit = authStatus.admin || authStatus.publicMode;
    navigate(event.status === 'complete' ? '/standings' : canEdit ? '/register' : '/heats');
  };

  const refreshAuth = async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
    } catch (e) {
      console.error('Failed to refresh auth status:', e);
    }
  };

  const contextValue = {
    currentEvent,
    racers,
    heats,
    standings,
    isAdmin: authStatus.admin,
    isViewer: authStatus.viewer,
    isPublicMode: authStatus.publicMode,
    isPrivateMode: authStatus.privateMode,
    canEdit: authStatus.admin || authStatus.publicMode,
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
    refreshAuth,
    selectEvent
  };

  if (!isHydrated) {
    return <PinewoodFullLoader visible />;
  }

  // Private mode gate: show login screen when no auth at all
  if (authStatus.privateMode && !authStatus.admin && !authStatus.viewer) {
    return <PrivateLoginGate onAuth={refreshAuth} />;
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
            <Route path="/format" element={<RaceFormatView />} />
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

// ===== PASSWORD INPUT WITH TOGGLE =====

function PasswordInput({ value, onChange, placeholder, autoFocus, disabled, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// ===== PRIVATE MODE LOGIN GATE =====

function PrivateLoginGate({ onAuth }: { onAuth: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setSubmitting(true);
    try {
      const role = await api.login(password);
      if (role) {
        await onAuth();
      } else {
        setError(true);
        setSubmitting(false);
      }
    } catch {
      setError(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-[#003F87] to-[#CE1126] rounded-xl flex items-center justify-center shadow-lg mb-4">
            <Flag className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-black uppercase tracking-tight text-slate-900">
            Derby<span className="text-[#CE1126]">Timer</span>
          </span>
        </div>

        <Card className="border-2 border-slate-200">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-5">
              <div>
                <label className="block text-base font-semibold mb-2 text-slate-600">Event Password</label>
                <PasswordInput
                  value={password}
                  onChange={(v) => { setPassword(v); setError(false); }}
                  placeholder="Enter event password"
                  autoFocus
                  disabled={submitting}
                  className="h-12 text-base"
                />
                {error && (
                  <p className="text-sm text-red-600 mt-2">Invalid password</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={submitting || !password}
                className="w-full h-12 text-base bg-[#003F87] hover:bg-[#002f66] text-white font-semibold"
              >
                {submitting ? 'Logging in...' : 'Log In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== NAVIGATION =====

function Navigation({
  onGoHome
}: {
  onGoHome: () => void;
}) {
  const { currentEvent, canEdit, isAdmin, isViewer, isPublicMode, refreshAuth } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const allNavItems = [
    { id: 'register', label: 'Registration', icon: Users, path: '/register', adminOnly: true },
    { id: 'heats', label: 'Races', icon: Clock, path: '/heats', adminOnly: false },
    { id: 'race', label: 'Race Control', icon: Flag, path: '/race', adminOnly: true },
    { id: 'standings', label: 'Standings', icon: BarChart3, path: '/standings', adminOnly: false }
  ];
  const navItems = allNavItems.filter(item => !item.adminOnly || canEdit);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    const role = await api.login(loginPassword);
    if (role) {
      setShowLogin(false);
      setLoginPassword('');
      await refreshAuth();
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    await refreshAuth();
    navigate('/');
  };

  // Show login/logout when auth is configured (not public mode)
  const showAuthButton = !isPublicMode;

  return (
    <>
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

            <div className="flex items-center gap-1">
              <div className="flex gap-1 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                <button
                  onClick={() => navigate('/format')}
                  className={cn(
                    "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
                    location.pathname === '/format'
                      ? "bg-[#003F87] text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <BookOpen size={18} />
                  <span>Race Format</span>
                </button>

                {!currentEvent ? (
                  <Badge variant="outline" className="h-11 px-4 text-sm font-semibold ml-1 sm:ml-2 flex items-center cursor-not-allowed">
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
                            "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
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

              {showAuthButton && (
                (isAdmin || isViewer) ? (
                  <button
                    onClick={handleLogout}
                    className="h-11 shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-l border-slate-300 ml-1"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLogin(true)}
                    className="h-11 shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer text-amber-700 hover:text-amber-900 hover:bg-amber-50 border-l border-slate-300 ml-1"
                  >
                    <LogIn size={18} />
                    <span>Admin Login</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      <Dialog open={showLogin} onOpenChange={(open) => { if (!open) { setShowLogin(false); setLoginError(false); setLoginPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Admin Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="grid gap-5">
            <div>
              <label className="block text-base font-semibold mb-2 text-slate-600">Password</label>
              <PasswordInput
                value={loginPassword}
                onChange={(v) => { setLoginPassword(v); setLoginError(false); }}
                placeholder="Enter admin password"
                autoFocus
                className="h-12 text-base"
              />
              {loginError && (
                <p className="text-sm text-red-600 mt-2">Invalid password</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 text-base" onClick={() => setShowLogin(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-11 text-base bg-[#003F87] hover:bg-[#002f66] text-white">
                Login
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== MOUNT APP =====

const root = createRoot(document.getElementById('app')!);
root.render(<App />);

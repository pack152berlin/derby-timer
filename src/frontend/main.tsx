import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Flag, Users, Monitor, ExternalLink, Clock, BarChart3, Activity, BookOpen } from 'lucide-react';
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

// ===== MAIN APP =====

function App() {
  const [currentView, setCurrentView] = useState<'events' | 'register' | 'heats' | 'race' | 'standings' | 'format'>('events');
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    if (!currentEvent) return;
    setLoading(true);
    const [racersData, heatsData, standingsData] = await Promise.all([
      api.getRacers(currentEvent.id),
      api.getHeats(currentEvent.id),
      api.getStandings(currentEvent.id)
    ]);
    setRacers(racersData);
    setHeats(heatsData);
    setStandings(standingsData);
    setLoading(false);
  };

  const selectEvent = async (event: Event | null) => {
    if (!event) {
      setCurrentEvent(null);
      setRacers([]);
      setHeats([]);
      setStandings([]);
      setCurrentView('events');
      return;
    }
    
    setCurrentEvent(event);
    setLoading(true);
    const [racersData, heatsData, standingsData] = await Promise.all([
      api.getRacers(event.id),
      api.getHeats(event.id),
      api.getStandings(event.id)
    ]);
    setRacers(racersData);
    setHeats(heatsData);
    setStandings(standingsData);
    setLoading(false);
    setCurrentView('register');
  };

  const contextValue = {
    currentEvent,
    racers,
    heats,
    standings,
    refreshData,
    selectEvent
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navigation 
          currentView={currentView} 
          onNavigate={setCurrentView}
          onGoHome={() => selectEvent(null)}
        />
        <main className="max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-8">
          {loading && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white p-8 rounded-xl shadow-2xl border-l-4 border-orange-500">
                <div className="animate-spin text-orange-500 mb-4">
                  <Activity size={48} />
                </div>
                <p className="text-slate-600 font-semibold">Loading...</p>
              </div>
            </div>
          )}
          
          {currentView === 'events' && <EventsView onSelectEvent={selectEvent} />}
          {currentView === 'register' && <RegistrationView />}
          {currentView === 'heats' && <HeatsView />}
          {currentView === 'race' && <RaceConsoleView />}
          {currentView === 'standings' && <StandingsView />}
          {currentView === 'format' && <RaceFormatView />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

// ===== NAVIGATION =====

function Navigation({ 
  currentView, 
  onNavigate,
  onGoHome
}: { 
  currentView: string; 
  onNavigate: (view: any) => void;
  onGoHome: () => void;
}) {
  const { currentEvent } = useApp();
  
  const navItems = [
    { id: 'register', label: 'Registration', icon: Users },
    { id: 'heats', label: 'Schedule', icon: Clock },
    { id: 'race', label: 'Race Control', icon: Flag },
    { id: 'standings', label: 'Standings', icon: BarChart3 }
  ];

  const formatIsActive = currentView === 'format';

  return (
    <nav className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onGoHome}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Derby<span className="text-orange-500">Timer</span>
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
              onClick={() => onNavigate('format')}
              className={cn(
                "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200",
                formatIsActive
                  ? "bg-orange-500 text-white shadow-md"
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
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        "h-11 shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200",
                        isActive
                          ? "bg-slate-900 text-white shadow-md"
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

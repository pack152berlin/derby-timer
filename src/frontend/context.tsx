import React, { createContext, useContext } from 'react';
import type { Event, Racer, Heat, Standing } from './types';

export interface AppContextType {
  currentEvent: Event | null;
  racers: Racer[];
  heats: Heat[];
  standings: Standing[];
  currentRacerId: string | null;
  setCurrentRacerId: (id: string | null) => void;
  refreshData: () => Promise<void>;
  selectEvent: (event: Event | null) => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

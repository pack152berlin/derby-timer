import React from 'react';
import { Flag, Users, Clock, BarChart3, Monitor, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApp } from '../context';

export function Navigation({ 
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

  return (
    <nav className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onGoHome}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[#003F87] to-[#CE1126] rounded-lg flex items-center justify-center shadow-lg">
              <Flag className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Derby<span className="text-[#CE1126]">Timer</span>
              </span>
              {currentEvent && (
                <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                  {currentEvent.name}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-1">
            {!currentEvent ? (
              <Badge variant="outline" className="px-4 py-2 text-sm font-semibold">
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
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200",
                        isActive
                          ? "bg-slate-900 text-white shadow-md"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <Icon size={18} />
                      <span className="hidden md:inline">{item.label}</span>
                    </button>
                  );
                })}
                
                <a
                  href="/display"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-l border-slate-300 ml-2"
                  title="Open Display View for Projector"
                >
                  <Monitor size={18} />
                  <span className="hidden md:inline">Display</span>
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

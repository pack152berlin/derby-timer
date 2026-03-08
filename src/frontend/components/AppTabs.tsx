import React from 'react';
import { cn } from '@/lib/utils';

export interface AppTab {
  id: string;
  label: string;
  count?: number;
}

interface AppTabsProps {
  tabs: AppTab[];
  activeTab: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
  /** Extra classes for the content panel (e.g. padding). Defaults to p-4. */
  contentClassName?: string;
  className?: string;
}

/**
 * File-folder–style tabs. The active tab visually connects to the content
 * panel below — both share the same white background with a continuous border,
 * so the tab and its content read as a single unit.
 *
 * Usage:
 *   <AppTabs tabs={tabs} activeTab={activeTab} onChange={setTab}>
 *     {activeTab === 'a' && <ContentA />}
 *     {activeTab === 'b' && <ContentB />}
 *   </AppTabs>
 */
export function AppTabs({ tabs, activeTab, onChange, children, contentClassName, className }: AppTabsProps) {
  return (
    <div className={className}>
      {/* Tab strip */}
      <div className="flex items-end gap-1">
        {tabs.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-t-xl border text-sm transition-colors select-none',
                isActive
                  // White bg + white bottom border + -mb-px merges this tab into the panel below
                  ? 'bg-white border-slate-200 border-b-white font-black text-slate-900 -mb-px z-10'
                  // Slate bg makes inactive tabs clearly readable and obviously clickable
                  : 'bg-slate-200 border-slate-300 font-semibold text-slate-700 hover:bg-slate-300 hover:text-slate-900',
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  'text-xs font-black px-1.5 py-0.5 rounded-full leading-none tabular-nums',
                  isActive ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-500',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content panel — the border here is what the active tab "opens into" */}
      <div className={cn(
        'border border-slate-300 rounded-b-xl bg-white overflow-hidden',
        contentClassName,
      )}>
        {children}
      </div>
    </div>
  );
}

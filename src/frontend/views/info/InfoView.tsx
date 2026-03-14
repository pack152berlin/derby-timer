import React, { useState, useCallback } from 'react';
import { Timer, Shuffle, Trophy, ClipboardList, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Page } from './components';
import { PageTocMobile } from './components';
import { OverviewPage } from './OverviewPage';
import { RegistrationPage } from './RegistrationPage';
import { SchedulingPage } from './SchedulingPage';
import { StandingsPage } from './StandingsPage';

// ─── Page definitions ────────────────────────────────────────────────────────

const pages: Page[] = [
  {
    key: 'overview',
    title: 'Race Day Overview',
    subtitle: 'How the event flows from start to finish',
    icon: <Timer className="w-4 h-4" />,
    sections: [
      { id: 'elimination', title: 'Elimination Checkpoint' },
      { id: 'ranking', title: 'Ranking Rules' },
    ],
    component: OverviewPage,
  },
  {
    key: 'registration',
    title: 'Registration & Inspection',
    subtitle: 'Multi-device check-in and weigh-in',
    icon: <ClipboardList className="w-4 h-4" />,
    sections: [
      { id: 'how-registration', title: 'How Registration Works' },
      { id: 'parallel-stations', title: 'Parallel Stations' },
      { id: 'inspection', title: 'Separate Inspection Station' },
      { id: 'car-photos', title: 'Car Photos' },
      { id: 'tips', title: 'Tips for Smooth Check-In' },
    ],
    component: RegistrationPage,
  },
  {
    key: 'scheduling',
    title: 'Heat Scheduling',
    subtitle: 'Matchups, lanes, and field cuts',
    icon: <Shuffle className="w-4 h-4" />,
    sections: [
      { id: 'how-heats', title: 'How Heats Are Generated' },
      { id: 'lane-coverage', title: 'Lane Coverage' },
      { id: 'matchup-quality', title: 'Matchup Quality' },
      { id: 'elimination', title: 'Elimination Rounds' },
      { id: 'finals', title: 'Finals' },
    ],
    component: SchedulingPage,
  },
  {
    key: 'standings',
    title: 'Standings & Ranking',
    subtitle: 'Win counts, tiebreakers, and leaderboard',
    icon: <Trophy className="w-4 h-4" />,
    sections: [
      { id: 'how-rankings', title: 'How Rankings Work' },
      { id: 'tiebreakers', title: 'Tiebreaker Chain' },
      { id: 'leaderboard', title: 'Reading the Leaderboard' },
    ],
    component: StandingsPage,
  },
];

// ─── Main InfoView ───────────────────────────────────────────────────────────

export function InfoView() {
  const [activeKey, setActiveKey] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  // pages always has entries; fallback to first page
  const activePage = (pages.find((p) => p.key === activeKey) ?? pages[0]) as Page;
  const ActiveComponent = activePage.component;

  const selectPage = useCallback((key: string) => {
    setActiveKey(key);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-8">
        {/* Sidebar — desktop */}
        <nav className="hidden md:block w-56 shrink-0">
          <div className="sticky top-6">
            <div className="mb-4 px-1">
              <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Info
              </h1>
              <p className="text-sm text-slate-400 leading-snug">
                How DerbyTimer manages race day
              </p>
            </div>
            <div className="space-y-0.5">
              {pages.map((page) => {
                const isActive = page.key === activeKey;
                return (
                  <div key={page.key}>
                    <button
                      onClick={() => selectPage(page.key)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-md font-medium transition-all duration-150 flex items-center gap-2.5 cursor-pointer',
                        isActive
                          ? 'bg-[#003F87]/10 text-[#003F87] font-bold text-[15px]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-sm',
                      )}
                    >
                      <span className={cn('shrink-0', isActive ? 'text-[#003F87]' : 'text-slate-400')}>
                        {page.icon}
                      </span>
                      {page.title}
                    </button>
                    {/* Section TOC under active page */}
                    {isActive && page.sections.length > 0 && (
                      <div className="ml-6 border-l-2 border-slate-200 pl-3 mt-1 mb-2 space-y-0.5">
                        {page.sections.map((s) => (
                          <a
                            key={s.id}
                            href={`#${s.id}`}
                            className="block text-sm text-slate-500 hover:text-[#003F87] py-0.5 transition-colors"
                          >
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Mobile page selector */}
        <div className="md:hidden w-full">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-semibold text-slate-800 mb-4"
          >
            <span className="flex items-center gap-2">
              <span className="text-[#003F87]">{activePage.icon}</span>
              {activePage.title}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-slate-400 transition-transform duration-200',
                mobileOpen && 'rotate-180',
              )}
            />
          </button>

          {mobileOpen && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg mb-4 overflow-hidden divide-y divide-slate-100">
              {pages.map((page) => {
                const isActive = page.key === activeKey;
                return (
                  <button
                    key={page.key}
                    onClick={() => selectPage(page.key)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-2 transition-colors cursor-pointer text-sm',
                      isActive
                        ? 'bg-[#003F87]/5 text-[#003F87] font-bold'
                        : 'text-slate-600 hover:bg-slate-50 font-medium',
                    )}
                  >
                    <span className={isActive ? 'text-[#003F87]' : 'text-slate-400'}>
                      {page.icon}
                    </span>
                    {page.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content area — desktop */}
        <div className="hidden md:block flex-1 min-w-0">
          <div className="max-w-3xl">
            <div className="mb-6">
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                {activePage.title}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">{activePage.subtitle}</p>
            </div>
            <ActiveComponent />
          </div>
        </div>
      </div>

      {/* Content area — mobile (outside flex so it's full width) */}
      <div className="md:hidden">
        <PageTocMobile sections={activePage.sections} />
        <ActiveComponent />
      </div>
    </div>
  );
}

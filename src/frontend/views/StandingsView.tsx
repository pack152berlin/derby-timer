import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Trophy, Search, Award, ExternalLink, Save, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useApp } from '../context';
import { SearchInput } from '../components/SearchInput';
import { CUB_SCOUT_DENS } from '../constants';
import { calculatePlaceCounts } from '../lib/standings-utils';
import { StandingHeader, type SortCol, type SortDir } from './standings/StandingHeader';
import { StandingRow } from './standings/StandingRow';
import { api } from '../api';
import type { EventAward, EventAwardWinner } from '../types';

// --- Award Winner Assignment ---

function AwardWinnerPicker({
  award,
  racerOptions,
  currentWinners,
  onSave,
}: {
  award: EventAward;
  racerOptions: { id: string; name: string; car_number: string }[];
  currentWinners: EventAwardWinner[];
  onSave: (awardId: string, winners: { racer_id: string; place: number }[]) => Promise<void>;
}) {
  const maxPlace = award.allow_third ? 3 : award.allow_second ? 2 : 1;
  const awardWinners = currentWinners.filter(w => w.award_id === award.id);

  const [picks, setPicks] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const w of awardWinners) {
      map[w.place] = w.racer_id;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync picks when currentWinners changes (e.g. after save + reload)
  useEffect(() => {
    const map: Record<number, string> = {};
    for (const w of awardWinners) {
      map[w.place] = w.racer_id;
    }
    setPicks(map);
  }, [currentWinners]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const winners: { racer_id: string; place: number }[] = [];
    for (let p = 1; p <= maxPlace; p++) {
      if (picks[p]) {
        winners.push({ racer_id: picks[p]!, place: p });
      }
    }
    await onSave(award.id, winners);
    setSaving(false);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const placeLabels = ['', '1st', '2nd', '3rd'];

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-slate-100 last:border-b-0">
      <div className="w-40 shrink-0">
        <span className="font-bold text-sm text-slate-800">{award.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {Array.from({ length: maxPlace }, (_, i) => i + 1).map(place => (
          <div key={place} className="flex items-center gap-1.5">
            {maxPlace > 1 && (
              <span className="text-xs font-semibold text-slate-400">{placeLabels[place]}</span>
            )}
            <Select
              value={picks[place] ?? '_none'}
              onValueChange={(v) => setPicks(prev => ({ ...prev, [place]: v === '_none' ? '' : v }))}
            >
              <SelectTrigger className="h-9 w-[180px] text-sm bg-white border-slate-300">
                <SelectValue placeholder="Select racer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {racerOptions.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    #{r.car_number} {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving}
        className="h-9 gap-1.5 bg-[#003F87] hover:bg-[#002f66] text-white font-bold text-sm shrink-0"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </Button>
    </div>
  );
}

function CustomAwardsSection({
  eventId,
  racerOptions,
}: {
  eventId: string;
  racerOptions: { id: string; name: string; car_number: string }[];
}) {
  const [awards, setAwards] = useState<EventAward[]>([]);
  const [winners, setWinners] = useState<EventAwardWinner[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [a, w] = await Promise.all([
      api.getAwards(eventId),
      api.getAwardWinners(eventId),
    ]);
    setAwards(a);
    setWinners(w);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (awardId: string, newWinners: { racer_id: string; place: number }[]) => {
    await api.setAwardWinners(awardId, newWinners);
    await loadData();
  };

  if (loading) return null;
  if (awards.length === 0) return null;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="pt-5 pb-3 px-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-[#003F87]" />
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
            Custom Awards
          </h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Assign winners for each award category. Racers are listed by standings rank.
        </p>
        <div>
          {awards.map(award => (
            <AwardWinnerPicker
              key={award.id}
              award={award}
              racerOptions={racerOptions}
              currentWinners={winners}
              onSave={handleSave}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main View ---

export function StandingsView() {
  const { standings, racers, heats, setCurrentRacerId, currentEvent, canEdit } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [denFilter, setDenFilter] = useState<string>('all');

  const placeCountsByRacer = useMemo(() => {
    return calculatePlaceCounts(heats);
  }, [heats]);

  const bestTimesByRacer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const heat of heats) {
      for (const result of heat.results ?? []) {
        if (result.time_ms != null && !result.dnf) {
          if (!(result.racer_id in map) || result.time_ms < map[result.racer_id]!) {
            map[result.racer_id] = result.time_ms;
          }
        }
      }
    }
    return map;
  }, [heats]);

  const showTime = Object.keys(bestTimesByRacer).length > 0;

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const displayedStandings = useMemo(() => {
    let result = standings.map((s, i) => ({
      ...s,
      rank: i + 1,
      den: racers.find(r => r.id === s.racer_id)?.den ?? null,
    }));

    if (denFilter !== 'all') {
      result = result.filter(s => s.den === denFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.racer_name.toLowerCase().includes(q) || s.car_number.includes(q)
      );
    }

    result.sort((a, b) => {
      const ca = placeCountsByRacer[a.racer_id] ?? { seconds: 0, thirds: 0 };
      const cb = placeCountsByRacer[b.racer_id] ?? { seconds: 0, thirds: 0 };
      let cmp = 0;
      switch (sortCol) {
        case 'rank':    cmp = a.rank - b.rank; break;
        case 'time': {
          const at = bestTimesByRacer[a.racer_id] ?? Infinity;
          const bt = bestTimesByRacer[b.racer_id] ?? Infinity;
          cmp = at - bt; break;
        }
        case 'car':     cmp = parseInt(a.car_number) - parseInt(b.car_number); break;
        case 'name':    cmp = a.racer_name.localeCompare(b.racer_name); break;
        case 'den':     cmp = (a.den ?? '').localeCompare(b.den ?? ''); break;
        case 'wins':    cmp = a.wins - b.wins; break;
        case 'seconds': cmp = ca.seconds - cb.seconds; break;
        case 'thirds':  cmp = ca.thirds - cb.thirds; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [standings, racers, heats, denFilter, searchTerm, sortCol, sortDir, placeCountsByRacer]);

  // Build racer options sorted by standings rank for award pickers
  const racerOptions = useMemo(() => {
    const standingOrder = new Map(standings.map((s, i) => [s.racer_id, i]));
    return [...racers]
      .sort((a, b) => (standingOrder.get(a.id) ?? 9999) - (standingOrder.get(b.id) ?? 9999))
      .map(r => ({ id: r.id, name: r.name, car_number: r.car_number }));
  }, [racers, standings]);

  const showAwards = canEdit && currentEvent?.status === 'complete' && currentEvent?.id;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
            Race Standings
          </h1>
          <p className="text-slate-500 mt-1">
            Ranked by wins, then losses, then average time
          </p>
        </div>
        {canEdit && currentEvent?.status === 'complete' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => document.getElementById('custom-awards-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 px-4 h-12 rounded-lg font-bold text-sm border-2 border-[#003F87] text-[#003F87] hover:bg-[#003F87]/10 transition-colors cursor-pointer"
            >
              <Award size={18} />
              <span className="hidden sm:inline">Assign Awards</span>
            </button>
            <a
              href="/certificates"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 h-12 rounded-lg font-bold text-sm bg-[#003F87] hover:bg-[#002f66] text-white transition-colors shadow-sm"
            >
              <Award size={18} />
              <span className="hidden sm:inline">Print Certificates</span>
              <ExternalLink size={14} className="text-white/60" />
            </a>
          </div>
        )}
      </div>

      {standings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Name or car #"
            className="flex-1 min-w-[180px]"
          />

          <Select value={denFilter} onValueChange={setDenFilter}>
            <SelectTrigger className="h-9 bg-white border-slate-300 w-[140px] text-sm font-bold">
              <SelectValue placeholder="All Dens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dens</SelectItem>
              {CUB_SCOUT_DENS.map(den => (
                <SelectItem key={den} value={den}>{den}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {standings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No results yet</p>
            <p className="text-slate-400">Run some heats to see the standings</p>
          </CardContent>
        </Card>
      ) : displayedStandings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-16">
            <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium mb-2">No racers match</p>
            <p className="text-slate-400">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden">
          <StandingHeader sortCol={sortCol} sortDir={sortDir} onSort={handleSort} showTime={showTime} />
          <div
            className="overflow-y-auto min-h-[24rem]"
            style={{ maxHeight: 'calc(100vh - 22rem)' }}
          >
            {displayedStandings.map((standing, idx) => {
              const { seconds = 0, thirds = 0 } = placeCountsByRacer[standing.racer_id] ?? {};
              return (
                <StandingRow
                  key={standing.racer_id}
                  standing={standing}
                  idx={idx}
                  seconds={seconds}
                  thirds={thirds}
                  bestTimeMs={bestTimesByRacer[standing.racer_id] ?? null}
                  showTime={showTime}
                  onClick={() => setCurrentRacerId(standing.racer_id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {showAwards && (
        <div id="custom-awards-section" className="scroll-mt-20">
          <CustomAwardsSection
            eventId={currentEvent!.id}
            racerOptions={racerOptions}
          />
        </div>
      )}
    </div>
  );
}

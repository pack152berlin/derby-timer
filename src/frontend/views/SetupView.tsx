import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flag,
  Shuffle,
  Trophy,
  Clock,
  Upload,
  Eye,
  Timer,
  Scale,
  Camera,
  Gauge,
  Target,
  Swords,
  ArrowLeft,
  Check,
  Lock,
  Award,
  Plus,
  X,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, CURRENT_EVENT_KEY } from '@/lib/utils';
import { api } from '../api';

// ─── Shared pieces ───────────────────────────────────────────────────────────

type LockPoint = 'creation' | 'first-heat' | 'anytime';

const lockPointConfig: Record<LockPoint, { label: string; icon: React.ReactNode; className: string }> = {
  creation: {
    label: 'Locked after creation',
    icon: <Lock className="w-3 h-3" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'first-heat': {
    label: 'Editable until first heat',
    icon: <Pencil className="w-3 h-3" />,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  anytime: {
    label: 'Editable anytime',
    icon: <Pencil className="w-3 h-3" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

function SectionHeading({
  number,
  title,
  subtitle,
  lockPoint,
}: {
  number: number;
  title: string;
  subtitle: string;
  lockPoint?: LockPoint;
}) {
  const lock = lockPoint ? lockPointConfig[lockPoint] : null;
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-[#003F87] text-white">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{title}</h2>
          {lock && (
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', lock.className)}>
              {lock.icon}
              {lock.label}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <Badge className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 gap-1 shrink-0">
      <Lock className="w-3 h-3" />
      Coming Soon
    </Badge>
  );
}

function OptionRow({
  icon,
  title,
  desc,
  selected,
  disabled,
  onClick,
  badges,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  badges?: { label: string; value: string }[];
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        'text-left rounded-xl border-2 px-4 py-3 transition-all w-full flex items-center gap-4',
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
          : selected
            ? 'border-[#003F87] bg-[#003F87]/5 shadow-sm cursor-pointer'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer',
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          selected ? 'bg-[#003F87] text-white' : 'bg-slate-100 text-slate-500',
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold text-base', selected ? 'text-[#003F87]' : 'text-slate-900')}>
          {title}
        </p>
        <p className="text-sm text-slate-500 leading-snug">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badges && badges.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 rounded px-2 py-0.5"
              >
                <span className="text-slate-400">{b.label}:</span> {b.value}
              </span>
            ))}
          </div>
        )}
        {disabled && <ComingSoonBadge />}
        {selected && !disabled && (
          <Badge className="bg-[#003F87] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#003F87]">
            Active
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const steps = [
  { n: 1, key: 'basics', label: 'Event Basics' },
  { n: 2, key: 'registration', label: 'Registration' },
  { n: 3, key: 'format', label: 'Race Format' },
  { n: 4, key: 'awards', label: 'Custom Awards' },
];

function Sidebar({ active }: { active: string }) {
  return (
    <nav className="sticky top-20 space-y-1">
      <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-1">
        New Event
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Configure your race day
      </p>
      {steps.map((step) => {
        const isActive = step.key === active;
        return (
          <a
            key={step.key}
            href={`#section-${step.key}`}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-[15px] font-medium',
              isActive
                ? 'bg-[#003F87]/10 text-[#003F87]'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
            )}
          >
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                isActive
                  ? 'bg-[#003F87] text-white'
                  : 'bg-slate-200 text-slate-400',
              )}
            >
              {step.n}
            </div>
            {step.label}
          </a>
        );
      })}
    </nav>
  );
}

// ─── Default award categories ────────────────────────────────────────────────

const DEFAULT_AWARDS = [
  { id: 'most-scout', label: 'Most Scout-Like' },
  { id: 'best-build', label: 'Best Build Quality' },
  { id: 'not-a-car', label: "Best Car That's Not a Car" },
  { id: 'most-creative', label: 'Most Creative' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

export function SetupView() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [laneCount, setLaneCount] = useState(4);
  const [creating, setCreating] = useState(false);

  // Awards state
  const [enabledAwards, setEnabledAwards] = useState<Set<string>>(new Set());
  const [customAwards, setCustomAwards] = useState<string[]>([]);
  const [newAwardName, setNewAwardName] = useState('');

  const toggleAward = (id: string) => {
    setEnabledAwards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomAward = () => {
    const trimmed = newAwardName.trim();
    if (!trimmed) return;
    setCustomAwards((prev) => [...prev, trimmed]);
    setEnabledAwards((prev) => new Set([...prev, `custom-${customAwards.length}`]));
    setNewAwardName('');
  };

  const removeCustomAward = (index: number) => {
    setCustomAwards((prev) => prev.filter((_, i) => i !== index));
    setEnabledAwards((prev) => {
      const next = new Set(prev);
      next.delete(`custom-${index}`);
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && date.length > 0;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const event = await api.createEvent({ name: name.trim(), date, lane_count: laneCount });
      localStorage.setItem(CURRENT_EVENT_KEY, event.id);
      window.location.href = '/register';
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-28">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#003F87] font-medium mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      <div className="flex gap-10">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden md:block w-52 shrink-0">
          <Sidebar active="basics" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile header (no sidebar) */}
          <div className="md:hidden mb-2">
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
              New Race Event
            </h1>
            <p className="text-slate-500 mt-1">
              Create your derby event — name it, configure registration, and choose a race format.
            </p>
          </div>

          {/* ─── Section 1: Event Basics ─── */}
          <div id="section-basics" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeading
              number={1}
              title="Event Basics"
              subtitle="Name your event and pick a date"
              lockPoint="anytime"
            />

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pack 152 Pinewood Derby 2026"
                  className="text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-base"
                />
              </div>
            </div>
          </div>

          {/* ─── Section 2: Registration ─── */}
          <div id="section-registration" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 opacity-75">
            <SectionHeading
              number={2}
              title="Registration"
              subtitle="Pre-race roster and check-in options"
              lockPoint="first-heat"
            />

            {/* Roster upload */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-slate-700">Roster Upload</h3>
                <ComingSoonBadge />
              </div>
              <p className="text-sm text-slate-500 mb-3">
                Pre-load your pack roster so volunteers just confirm attendance instead of typing every name — cuts check-in time dramatically.
              </p>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-not-allowed">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-400">
                  Drop a CSV file here to pre-fill your racer list
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Columns: Name, Den, Car Number (optional)
                </p>
              </div>
            </div>

            {/* Late entrants */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-slate-700">Late Registration</h3>
                <ComingSoonBadge />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-not-allowed opacity-60">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    <UserPlus className="w-4 h-4 inline-block mr-1.5 -mt-0.5 text-slate-400" />
                    Allow new entrants after racing has started
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Late arrivals can join mid-event. They&apos;ll be slotted into upcoming heats with fewer total races.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ─── Section 3: Race Format ─── */}
          <div id="section-format" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 opacity-75">
            <SectionHeading
              number={3}
              title="Race Format"
              subtitle="Track setup, timing, scheduling, and scoring"
              lockPoint="first-heat"
            />

            {/* Lane count */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-700 mb-2">
                Number of Lanes
              </h3>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLaneCount(n)}
                    className={cn(
                      'flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all cursor-pointer',
                      laneCount === n
                        ? 'border-[#003F87] bg-[#003F87] text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Most pinewood derby tracks have 4 lanes
              </p>
            </div>

            {/* Timing Hardware */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-700 mb-2">Timing Hardware</h3>
              <div className="grid gap-2">
                <OptionRow
                  icon={<Eye className="w-5 h-5" />}
                  title="Manual Judging"
                  desc="Volunteers call finish order visually. No special hardware needed."
                  selected
                />
                <OptionRow
                  icon={<Timer className="w-5 h-5" />}
                  title="Electronic Timer"
                  desc="MicroWizard, BestTrack, NewBold, or compatible serial timer."
                  disabled
                />
                <OptionRow
                  icon={<Camera className="w-5 h-5" />}
                  title="Camera Finish"
                  desc="High-speed camera captures finish order automatically."
                  disabled
                />
              </div>
            </div>

            {/* Scheduling algorithm */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-700 mb-2">Scheduling Algorithm</h3>
              <div className="grid gap-2">
                <OptionRow
                  icon={<Shuffle className="w-5 h-5" />}
                  title="Adaptive"
                  desc="Rolling queue adapts to results. Every car hits every lane, then the field is cut."
                  selected
                  badges={[
                    { label: 'Fairness', value: 'High' },
                    { label: 'Speed', value: 'Medium' },
                    { label: 'Excitement', value: 'High' },
                  ]}
                />
                <OptionRow
                  icon={<Target className="w-5 h-5" />}
                  title="Chart (PPN)"
                  desc="Pre-computed Perfect-N schedule. Every car races every other car equally."
                  disabled
                  badges={[
                    { label: 'Fairness', value: 'Perfect' },
                    { label: 'Speed', value: 'Medium' },
                    { label: 'Excitement', value: 'Low' },
                  ]}
                />
                <OptionRow
                  icon={<Gauge className="w-5 h-5" />}
                  title="Quick"
                  desc="Fixed number of heats per car. Trades lane coverage for speed."
                  disabled
                  badges={[
                    { label: 'Fairness', value: 'Medium' },
                    { label: 'Speed', value: 'Fast' },
                    { label: 'Excitement', value: 'Medium' },
                  ]}
                />
                <OptionRow
                  icon={<Swords className="w-5 h-5" />}
                  title="Bracket"
                  desc="Double elimination. Lose twice and you're out. Classic tournament format."
                  disabled
                  badges={[
                    { label: 'Fairness', value: 'Low' },
                    { label: 'Speed', value: 'Fast' },
                    { label: 'Excitement', value: 'Very High' },
                  ]}
                />
              </div>
            </div>

            {/* Scoring mode */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-700 mb-2">Scoring Mode</h3>
              <div className="grid gap-2">
                <OptionRow
                  icon={<Trophy className="w-5 h-5" />}
                  title="Placement (W/L)"
                  desc="1st place wins, everyone else loses. Simple — works without a timer."
                  selected
                />
                <OptionRow
                  icon={<Flag className="w-5 h-5" />}
                  title="Points (4/3/2/1)"
                  desc="Points per finish position. 2nd place counts for something."
                  disabled
                />
                <OptionRow
                  icon={<Clock className="w-5 h-5" />}
                  title="Average Time"
                  desc="Ranked by finish time. Matchups don't matter — only the clock."
                  disabled
                />
                <OptionRow
                  icon={<Scale className="w-5 h-5" />}
                  title="Handicapped Time"
                  desc="Lane-corrected times for maximum fairness. Requires calibration."
                  disabled
                />
              </div>
            </div>

            {/* Elimination */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-slate-700">Elimination Rounds</h3>
                <ComingSoonBadge />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">
                      Field halving after each lane cycle
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Currently always enabled — cut to ~50% each round until 2 finalists remain
                    </p>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-[#003F87] flex items-center px-0.5">
                    <div className="w-5 h-5 rounded-full bg-white shadow-sm ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 4: Custom Awards ─── */}
          <div id="section-awards" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 opacity-75">
            <SectionHeading
              number={4}
              title="Custom Awards"
              subtitle="Special recognition beyond race results — voted by audience or picked by committee"
              lockPoint="anytime"
            />

            <p className="text-sm text-slate-500 mb-4">
              Toggle the awards you want for your event. Winners can be chosen by popular vote or selected by a judging committee.
            </p>

            {/* Default award toggles */}
            <div className="space-y-2 mb-4">
              {DEFAULT_AWARDS.map((award) => {
                const enabled = enabledAwards.has(award.id);
                return (
                  <label
                    key={award.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all cursor-pointer',
                      enabled
                        ? 'border-[#003F87] bg-[#003F87]/5'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAward(award.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[#003F87] accent-[#003F87] cursor-pointer"
                    />
                    <Award className={cn('w-5 h-5 shrink-0', enabled ? 'text-[#003F87]' : 'text-slate-400')} />
                    <span className={cn('font-bold text-base', enabled ? 'text-[#003F87]' : 'text-slate-900')}>
                      {award.label}
                    </span>
                  </label>
                );
              })}

              {/* Custom awards added by user */}
              {customAwards.map((label, i) => {
                const id = `custom-${i}`;
                const enabled = enabledAwards.has(id);
                return (
                  <div
                    key={id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all',
                      enabled
                        ? 'border-[#003F87] bg-[#003F87]/5'
                        : 'border-slate-200 bg-white',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAward(id)}
                      className="h-4 w-4 rounded border-slate-300 text-[#003F87] accent-[#003F87] cursor-pointer"
                    />
                    <Award className={cn('w-5 h-5 shrink-0', enabled ? 'text-[#003F87]' : 'text-slate-400')} />
                    <span className={cn('font-bold text-base flex-1', enabled ? 'text-[#003F87]' : 'text-slate-900')}>
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomAward(i)}
                      className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-1"
                      title="Remove award"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add custom award */}
            <div className="flex gap-2">
              <Input
                value={newAwardName}
                onChange={(e) => setNewAwardName(e.target.value)}
                placeholder="Add a custom award..."
                className="text-base h-11"
                onKeyDown={(e) => e.key === 'Enter' && addCustomAward()}
              />
              <Button
                type="button"
                onClick={addCustomAward}
                disabled={!newAwardName.trim()}
                variant="outline"
                className="shrink-0 h-11 w-11 px-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500 hidden sm:block">
            {canCreate ? (
              <span><strong className="text-slate-900">{name.trim()}</strong> — {new Date(date + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} — {laneCount} lanes</span>
            ) : (
              <span>Enter an event name to continue</span>
            )}
          </div>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            size="lg"
            className="bg-[#003F87] hover:bg-[#002f66] text-white font-bold text-base h-12 px-8 shrink-0"
          >
            {creating ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </div>
    </div>
  );
}

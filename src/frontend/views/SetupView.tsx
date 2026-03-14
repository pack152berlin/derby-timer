import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Building2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, CURRENT_EVENT_KEY } from '@/lib/utils';
import { DEN_IMAGES, DEN_ACCENT } from '../lib/den-utils';
import { Certificate } from './CertificateView';
import { api } from '../api';

// ─── Shared pieces ───────────────────────────────────────────────────────────

type LockPoint = 'creation' | 'registration' | 'first-heat' | 'anytime';

const lockPointConfig: Record<LockPoint, { label: string; icon: React.ReactNode; className: string }> = {
  creation: {
    label: 'Locked after creation',
    icon: <Lock className="w-3 h-3" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  registration: {
    label: 'Set before registration',
    icon: <Lock className="w-3 h-3" />,
    className: 'bg-violet-50 text-violet-700 border-violet-200',
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
  { n: 2, key: 'groups', label: 'Dens & Groups' },
  { n: 3, key: 'registration', label: 'Registration' },
  { n: 4, key: 'format', label: 'Race Format' },
  { n: 5, key: 'awards', label: 'Custom Awards' },
];

function Sidebar({ active, heading }: { active: string; heading: string }) {
  return (
    <nav className="sticky top-20 space-y-1">
      <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-1">
        {heading}
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

// ─── Den / group definitions ────────────────────────────────────────────────

const CUB_SCOUT_DENS = [
  { name: 'Lions',   color: DEN_ACCENT['Lions']   },
  { name: 'Tigers',  color: DEN_ACCENT['Tigers']  },
  { name: 'Wolves',  color: DEN_ACCENT['Wolves']  },
  { name: 'Bears',   color: DEN_ACCENT['Bears']   },
  { name: 'Webelos', color: DEN_ACCENT['Webelos'] },
  { name: 'AOLs',    color: DEN_ACCENT['AOLs']    },
];


// ─── Default award categories ────────────────────────────────────────────────

const DEFAULT_AWARDS = [
  { id: 'most-scout', label: 'Most Scout-Like' },
  { id: 'best-build', label: 'Best Build Quality' },
  { id: 'not-a-car', label: "Best Car That's Not a Car" },
  { id: 'most-creative', label: 'Most Creative' },
];

// ─── Certificate Preview ─────────────────────────────────────────────────────

const FAKE_RACER: import('../types').Racer = {
  id: 'preview',
  name: 'Samantha Rodriguez',
  den: 'Bears',
  car_number: '42',
  weight_ok: 1,
  event_id: '',
  inspected_at: null,
  car_photo_filename: null,
  car_photo_mime_type: null,
  car_photo_bytes: null,
  created_at: '',
  updated_at: '',
};

const FAKE_STATS: import('../lib/certificate-stats').RacerStats = {
  wins: 11,
  second_place_count: 3,
  third_place_count: 1,
  best_time_ms: 3245,
  avg_time_ms: 3412,
  heats_raced: 16,
};

function CertificatePreviewModal({
  open,
  onClose,
  organization,
  eventName,
}: {
  open: boolean;
  onClose: () => void;
  organization: string;
  eventName: string;
}) {
  const fakeEvent = {
    id: 'preview',
    name: eventName.trim() || 'Pack 152 Pinewood Derby 2026',
    date: '2026-02-15',
    lane_count: 4,
    racer_count: 24,
    organization: organization.trim() || 'Cub Scouts of America',
    status: 'complete' as const,
    created_at: '',
    updated_at: '',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] w-full p-0 overflow-auto">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-bold">Certificate Preview</DialogTitle>
          <p className="text-sm text-slate-500 mt-0.5">
            Sample 2nd-place certificate — organization name appears under the title
          </p>
        </DialogHeader>
        <div className="px-4 pb-6 pt-2 cert-preview-modal">
          <Certificate
            racer={FAKE_RACER}
            stats={FAKE_STATS}
            tier={{ type: 'podium', place: 2 }}
            event={fakeEvent}
            totalRacers={24}
            organization={organization.trim() || undefined}
          />
        </div>
        <style>{`
          .cert-preview-modal .cert-scale-wrapper {
            width: 100% !important;
            transform: none !important;
            margin-bottom: 0 !important;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function SetupView() {
  const navigate = useNavigate();
  const { id: editEventId } = useParams<{ id: string }>();
  const isEditMode = !!editEventId;

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [laneCount, setLaneCount] = useState(4);
  const [creating, setCreating] = useState(false);
  const [editLoading, setEditLoading] = useState(isEditMode);

  // Scroll-tracking for sidebar
  const [activeSection, setActiveSection] = useState('basics');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sectionIds = steps.map((s) => `section-${s.key}`);
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0]!.target.id;
          const key = id.replace('section-', '');
          setActiveSection(key);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Load existing event data in edit mode
  useEffect(() => {
    if (!editEventId) return;
    const loadEvent = async () => {
      try {
        const [event, awards] = await Promise.all([
          api.getEvent(editEventId),
          api.getAwards(editEventId),
        ]);
        if (!event) {
          navigate('/');
          return;
        }
        setName(event.name);
        setDate(event.date);
        setLaneCount(event.lane_count);
        setOrganization(event.organization || 'Cub Scouts of America');

        // Reconstruct awards state
        const enabledSet = new Set<string>();
        const customList: string[] = [];
        const opts: Record<string, { allow_second: boolean; allow_third: boolean }> = {};

        for (const award of awards) {
          // Try to match against default awards by label
          const defaultMatch = DEFAULT_AWARDS.find(d => d.label === award.name);
          if (defaultMatch) {
            enabledSet.add(defaultMatch.id);
            opts[defaultMatch.id] = { allow_second: !!award.allow_second, allow_third: !!award.allow_third };
          } else {
            const customIdx = customList.length;
            const customId = `custom-${customIdx}`;
            customList.push(award.name);
            enabledSet.add(customId);
            opts[customId] = { allow_second: !!award.allow_second, allow_third: !!award.allow_third };
          }
        }

        setEnabledAwards(enabledSet);
        setCustomAwards(customList);
        setAwardOptions(opts);
      } catch {
        navigate('/');
      } finally {
        setEditLoading(false);
      }
    };
    loadEvent();
  }, [editEventId]);

  // Awards state
  const [enabledAwards, setEnabledAwards] = useState<Set<string>>(new Set());
  const [customAwards, setCustomAwards] = useState<string[]>([]);
  const [newAwardName, setNewAwardName] = useState('');
  const [organization, setOrganization] = useState('Cub Scouts of America');
  const [showCertPreview, setShowCertPreview] = useState(false);

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
    setCustomAwards((prev) => {
      const newIndex = prev.length;
      setEnabledAwards((en) => new Set([...en, `custom-${newIndex}`]));
      return [...prev, trimmed];
    });
    setNewAwardName('');
  };

  const removeCustomAward = (index: number) => {
    setCustomAwards((prev) => prev.filter((_, i) => i !== index));

    // Re-map custom-N IDs: shift all N > index down by 1
    setEnabledAwards((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (!id.startsWith('custom-')) { next.add(id); continue; }
        const n = parseInt(id.slice(7));
        if (n < index) next.add(id);
        else if (n > index) next.add(`custom-${n - 1}`);
        // n === index → removed, skip
      }
      return next;
    });

    setAwardOptions((prev) => {
      const next: Record<string, { allow_second: boolean; allow_third: boolean }> = {};
      for (const [id, opts] of Object.entries(prev)) {
        if (!id.startsWith('custom-')) { next[id] = opts; continue; }
        const n = parseInt(id.slice(7));
        if (n < index) next[id] = opts;
        else if (n > index) next[`custom-${n - 1}`] = opts;
      }
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && date.length > 0;

  // Award place options state: tracks allow_second / allow_third per award
  const [awardOptions, setAwardOptions] = useState<Record<string, { allow_second: boolean; allow_third: boolean }>>({});

  const getAwardOption = (id: string) => awardOptions[id] ?? { allow_second: false, allow_third: false };

  const toggleAwardOption = (id: string, field: 'allow_second' | 'allow_third') => {
    setAwardOptions((prev) => {
      const current = prev[id] ?? { allow_second: false, allow_third: false };
      return { ...prev, [id]: { ...current, [field]: !current[field] } };
    });
  };

  const buildAwardsList = () => {
    const awardsList: { name: string; allow_second?: boolean; allow_third?: boolean }[] = [];
    for (const award of DEFAULT_AWARDS) {
      if (enabledAwards.has(award.id)) {
        const opts = getAwardOption(award.id);
        awardsList.push({ name: award.label, allow_second: opts.allow_second, allow_third: opts.allow_third });
      }
    }
    for (let i = 0; i < customAwards.length; i++) {
      const id = `custom-${i}`;
      if (enabledAwards.has(id)) {
        const opts = getAwardOption(id);
        awardsList.push({ name: customAwards[i]!, allow_second: opts.allow_second, allow_third: opts.allow_third });
      }
    }
    return awardsList;
  };

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      if (isEditMode && editEventId) {
        // Update existing event
        await api.updateEvent(editEventId, {
          name: name.trim(),
          date,
          lane_count: laneCount,
          organization: organization.trim() || 'Cub Scouts of America',
        });

        const awardsList = buildAwardsList();
        await api.setAwards(editEventId, awardsList);

        navigate('/');
      } else {
        // Create new event
        const event = await api.createEvent({
          name: name.trim(),
          date,
          lane_count: laneCount,
          organization: organization.trim() || 'Cub Scouts of America',
        });

        const awardsList = buildAwardsList();
        if (awardsList.length > 0) {
          await api.setAwards(event.id, awardsList);
        }

        localStorage.setItem(CURRENT_EVENT_KEY, event.id);
        navigate('/register');
      }
    } catch {
      setCreating(false);
    }
  };

  if (editLoading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center">
        <p className="text-slate-400 font-medium">Loading event...</p>
      </div>
    );
  }

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
          <Sidebar active={activeSection} heading={isEditMode ? 'Edit Event' : 'New Event'} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile header (no sidebar) */}
          <div className="md:hidden mb-2">
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
              {isEditMode ? 'Edit Event' : 'New Race Event'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isEditMode
                ? 'Update your event settings and awards.'
                : 'Create your derby event — name it, configure registration, and choose a race format.'}
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
                  data-testid="input-event-name"
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

          {/* ─── Section 2: Dens & Groups ─── */}
          <div id="section-groups" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeading
              number={2}
              title="Dens & Groups"
              subtitle="How racers are organized — shown on standings, certificates, and den awards"
              lockPoint="registration"
            />

            {/* Mode toggle */}
            <div className="grid gap-2 mb-5">
              <OptionRow
                icon={<Users className="w-5 h-5" />}
                title="Cub Scout Dens"
                desc="Standard BSA dens: Lions, Tigers, Wolves, Bears, Webelos, and AOLs."
                selected
              />
              <OptionRow
                icon={<Pencil className="w-5 h-5" />}
                title="Custom Groups"
                desc="Define your own group names and icons for non-BSA events or custom divisions."
                disabled
              />
            </div>

            {/* Cub Scout Dens preview */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Included Dens
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {CUB_SCOUT_DENS.map((den) => (
                    <div
                      key={den.name}
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <img
                        src={DEN_IMAGES[den.name]}
                        alt={den.name}
                        className="w-12 h-12 object-contain"
                      />
                      <span className="text-sm font-bold text-slate-700">{den.name}</span>
                      <div
                        className="w-5 h-2 rounded-full"
                        style={{ backgroundColor: den.color }}
                        title={`Accent: ${den.color}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Racers pick their den during registration. Den rankings and &ldquo;Fastest in Den&rdquo; awards are automatic.
                </p>
              </div>

          </div>

          {/* ─── Section 3: Registration ─── */}
          <div id="section-registration" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 opacity-75">
            <SectionHeading
              number={3}
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
                Pre-load your pack roster so volunteers just confirm attendance instead of typing every name — cuts check-in time dramatically. Uploaded names are added to any racers already registered — nothing gets overwritten.
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

          {/* ─── Section 4: Race Format ─── */}
          <div id="section-format" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeading
              number={4}
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

          {/* ─── Section 5: Custom Awards ─── */}
          <div id="section-awards" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeading
              number={5}
              title="Custom Awards"
              subtitle="Special recognition beyond race results — voted by audience or picked by committee"
              lockPoint="anytime"
            />

            {/* Awarding Organization */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Awarding Organization</label>
              </div>
              <div className="flex gap-2">
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Cub Scouts of America"
                  className="text-base h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCertPreview(true)}
                  className="shrink-0 h-11 text-sm font-semibold gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                This name appears on every racer&apos;s certificate under &ldquo;Certificate of Achievement&rdquo;
              </p>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Toggle the awards you want for your event. Winners can be chosen by popular vote or selected by a judging committee.
            </p>

            {/* Default award toggles */}
            <div className="space-y-2 mb-4">
              {DEFAULT_AWARDS.map((award) => {
                const enabled = enabledAwards.has(award.id);
                const opts = getAwardOption(award.id);
                return (
                  <div key={award.id}>
                    <label
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
                    {enabled && (
                      <div className="ml-12 mt-1 mb-1 flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opts.allow_second}
                            onChange={() => toggleAwardOption(award.id, 'allow_second')}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#003F87] cursor-pointer"
                          />
                          Award 2nd place
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opts.allow_third}
                            onChange={() => toggleAwardOption(award.id, 'allow_third')}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#003F87] cursor-pointer"
                          />
                          Award 3rd place
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Custom awards added by user */}
              {customAwards.map((label, i) => {
                const id = `custom-${i}`;
                const enabled = enabledAwards.has(id);
                const opts = getAwardOption(id);
                return (
                  <div key={id}>
                    <div
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
                    {enabled && (
                      <div className="ml-12 mt-1 mb-1 flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opts.allow_second}
                            onChange={() => toggleAwardOption(id, 'allow_second')}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#003F87] cursor-pointer"
                          />
                          Award 2nd place
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opts.allow_third}
                            onChange={() => toggleAwardOption(id, 'allow_third')}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#003F87] cursor-pointer"
                          />
                          Award 3rd place
                        </label>
                      </div>
                    )}
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

      {/* Certificate preview modal */}
      <CertificatePreviewModal
        open={showCertPreview}
        onClose={() => setShowCertPreview(false)}
        organization={organization}
        eventName={name}
      />

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
            {creating
              ? (isEditMode ? 'Saving...' : 'Creating...')
              : (isEditMode ? 'Save Changes' : 'Create Event')}
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DEN_IMAGES, DEN_SINGULAR, DEN_ACCENT } from '../lib/den-utils';
import { classifyRacer, buildCertificateStats, computeRacerStats } from '../lib/certificate-stats';
import type { CertTier, RacerStats } from '../lib/certificate-stats';
import type { Event, Racer, Standing } from '../types';
import { api } from '../api';

function OrdSuffix({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.65em] opacity-75">{children}</span>;
}

function ordinal(n: number): React.ReactNode {
  const mod100 = n % 100;
  const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return <>{n}<OrdSuffix>{suffix}</OrdSuffix></>;
}

function tierHeadline(tier: CertTier): React.ReactNode {
  switch (tier.type) {
    case 'podium':
      return <>{ordinal(tier.place)} Place</>;
    case 'top5':
      return <>Top 5</>;
    case 'top10':
      return <>Top 10</>;
    case 'den_champion':
      return <>Fastest {DEN_SINGULAR[tier.den] ?? tier.den}!</>;
    case 'den_top3':
      return <>{ordinal(tier.rank)} in {tier.den}!</>;
    case 'achievement':
      return 'Pinewood Derby Racer';
  }
}

function tierSubtitle(tier: CertTier, totalRacers: number): React.ReactNode | null {
  if (tier.type === 'top5' || tier.type === 'top10') {
    return <>{ordinal(tier.place)} place of {totalRacers} racers</>;
  }
  if (tier.type === 'den_champion' || tier.type === 'den_top3') {
    return <>{ordinal(tier.overallPlace)} place of {totalRacers} racers</>;
  }
  if (tier.type === 'achievement' && tier.overallPlace <= Math.ceil(totalRacers / 2)) {
    return <>{ordinal(tier.overallPlace)} place of {totalRacers} racers</>;
  }
  return null;
}

/** Detect leading ordinal in a string like "2nd Place" and wrap the suffix */
function formatOrdinalText(text: string): React.ReactNode {
  const m = text.match(/^(\d+)(st|nd|rd|th)\b(.*)$/);
  if (!m) return text;
  return <>{m[1]}<OrdSuffix>{m[2]}</OrdSuffix>{m[3]}</>;
}

/** Wrap the trailing "s" unit in time values like "3.245s" in a smaller span */
function formatStatValue(value: string): React.ReactNode {
  const m = value.match(/^(\d+\.\d+)(s)$/);
  if (m) return <>{m[1]}<span className="text-[0.7em]">{m[2]}</span></>;
  return value;
}

// --- Tier-specific colors ---

const TIER_COLORS: Record<string, { border: string; ribbon: string; ribbonText: string; glow: string }> = {
  'podium-1': { border: '#c9950c', ribbon: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)', ribbonText: '#78350f', glow: 'rgba(251,191,36,0.3)' },
  'podium-2': { border: '#94a3b8', ribbon: 'linear-gradient(135deg, #cbd5e1, #94a3b8, #64748b)', ribbonText: '#1e293b', glow: 'rgba(148,163,184,0.3)' },
  'podium-3': { border: '#c2410c', ribbon: 'linear-gradient(135deg, #fb923c, #f97316, #ea580c)', ribbonText: '#431407', glow: 'rgba(249,115,22,0.3)' },
  'top10':    { border: '#003F87', ribbon: 'linear-gradient(135deg, #1e40af, #003F87, #1e3a5f)', ribbonText: '#ffffff', glow: 'rgba(0,63,135,0.2)' },
  'den':      { border: '#003F87', ribbon: 'linear-gradient(135deg, #1e3a5f, #003F87)', ribbonText: '#ffffff', glow: 'rgba(0,63,135,0.15)' },
  'achievement': { border: '#003F87', ribbon: 'linear-gradient(135deg, #1e3a5f, #003F87)', ribbonText: '#ffffff', glow: 'rgba(0,63,135,0.1)' },
};

function getTierColors(tier: CertTier) {
  if (tier.type === 'podium') return TIER_COLORS[`podium-${tier.place}`]!;
  if (tier.type === 'top5' || tier.type === 'top10') return TIER_COLORS.top10!;
  if (tier.type === 'den_champion' || tier.type === 'den_top3') {
    const accent = DEN_ACCENT[tier.den] ?? '#003F87';
    return { border: accent, ribbon: `linear-gradient(135deg, ${accent}, ${accent}dd)`, ribbonText: '#ffffff', glow: `${accent}25` };
  }
  return TIER_COLORS.achievement!;
}

// --- SVG decorations ---

function FleurDeLis({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} className="block">
      <path d="M50 5 C50 5 58 25 58 45 C58 60 55 70 50 80 C45 70 42 60 42 45 C42 25 50 5 50 5Z" fill={color} />
      <path d="M15 50 C15 50 30 35 42 42 C48 46 50 55 50 80 C40 65 25 60 18 55 C12 50 15 50 15 50Z" fill={color} opacity={0.85} />
      <path d="M85 50 C85 50 70 35 58 42 C52 46 50 55 50 80 C60 65 75 60 82 55 C88 50 85 50 85 50Z" fill={color} opacity={0.85} />
      <circle cx={50} cy={45} r={4} fill="white" opacity={0.6} />
      <rect x={38} y={82} width={24} height={5} rx={2} fill={color} opacity={0.7} />
      <path d="M42 90 L50 105 L58 90Z" fill={color} opacity={0.5} />
    </svg>
  );
}

function RopeKnotBorder({ color }: { color: string }) {
  return (
    <>
      <svg viewBox="0 0 60 60" width={40} height={40} className="absolute top-3 left-3">
        <path d="M5 30 Q5 5 30 5" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M10 30 Q10 10 30 10" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      <svg viewBox="0 0 60 60" width={40} height={40} className="absolute top-3 right-3">
        <path d="M55 30 Q55 5 30 5" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M50 30 Q50 10 30 10" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      <svg viewBox="0 0 60 60" width={40} height={40} className="absolute bottom-3 left-3">
        <path d="M5 30 Q5 55 30 55" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M10 30 Q10 50 30 50" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      <svg viewBox="0 0 60 60" width={40} height={40} className="absolute bottom-3 right-3">
        <path d="M55 30 Q55 55 30 55" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M50 30 Q50 50 30 50" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
    </>
  );
}

// --- Certificate card ---

interface CertificateProps {
  racer: Racer;
  stats: RacerStats | undefined;
  tier: CertTier;
  event: Event;
  totalRacers: number;
}

function Certificate({ racer, stats, tier, event, totalRacers }: CertificateProps) {
  const colors = getTierColors(tier);
  const headline = tierHeadline(tier);
  const denImage = racer.den ? DEN_IMAGES[racer.den] : null;
  const isPodium = tier.type === 'podium';
  const subtitle = tierSubtitle(tier, totalRacers);
  const medal = isPodium
    ? tier.place === 1 ? '\uD83E\uDD47' : tier.place === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49'
    : null;

  return (
    <div
      data-testid="certificate"
      className="certificate-page break-after-page py-6 px-4"
    >
      <div className="rounded max-w-[960px] mx-auto bg-[#fffdf7] relative overflow-hidden font-serif">
        <div
          className="absolute inset-2 rounded-sm pointer-events-none"
          style={{ border: `2px solid ${colors.border}55` }}
        />

        <RopeKnotBorder color={colors.border} />

        <div className="pt-7 px-14 pb-5 relative flex flex-col min-h-[540px]">

          {/* TOP: Fleur-de-lis + Title */}
          <div className="text-center">
            <div className="flex justify-center items-center gap-5 mb-3">
              <FleurDeLis color={colors.border} size={44} />
              <div>
                <h1
                  className="text-3xl font-bold uppercase tracking-wider m-0"
                  style={{ color: colors.border }}
                >
                  Certificate of Achievement
                </h1>
                <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-stone-500 m-0">
                  Cub Scouts of America
                </h2>
              </div>
              <FleurDeLis color={colors.border} size={44} />
            </div>
            <div
              className="w-48 h-px mx-auto"
              style={{ background: `linear-gradient(90deg, transparent, ${colors.border}88, transparent)` }}
            />
          </div>

          {/* MAIN CONTENT: name + ribbon + stats */}
          <div className="flex-1 flex flex-col items-center justify-between py-6">

            <div className="text-center">
              <p className="text-sm text-stone-400 italic">
                This certificate is proudly presented to
              </p>
              <h2
                data-testid="certificate-racer-name"
                className="text-5xl text-yellow-950 leading-tight tracking-wide font-cert-heading"
              >
                {racer.name}
              </h2>
            </div>

            <div className="text-center max-w-lg">
              <div className={cn("rounded inline-flex items-center justify-center relative", isPodium ? "py-4 px-10 gap-6" : "py-3.5 px-9")}>
                {medal && (
                  <span className="text-[64px] shrink-0 leading-none">{medal}</span>
                )}
                <div className="text-center">
                  <span
                    data-testid="certificate-headline"
                    className="tracking-wide text-[42px] text-yellow-950 font-cert-heading leading-none"
                  >
                    {headline}
                  </span>
                  {subtitle && (
                    <div className="text-sm font-semibold tracking-wide opacity-70 font-body">
                      {subtitle}
                    </div>
                  )}
                  {isPodium && (
                    <div className="text-xs font-semibold tracking-widest uppercase opacity-60">
                      {event.name}
                    </div>
                  )}
                </div>
                {medal && (
                  <span className="text-[64px] shrink-0 leading-none">{medal}</span>
                )}
              </div>
            </div>

            {stats && (() => {
              const isAchievement = tier.type === 'achievement';
              const items = buildCertificateStats(stats, racer.car_number, { showRaces: isAchievement });
              const mid = Math.ceil(items.length / 2);
              const left = items.slice(0, mid);
              const right = items.slice(mid);

              if (denImage) {
                return (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                    <div className="flex justify-end gap-6">
                      {left.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                    </div>
                    <img
                      src={denImage}
                      alt={racer.den ?? ''}
                      className={cn(
                        "object-contain shrink-0",
                        isPodium ? "w-20 h-20 opacity-80" : "w-28 h-28"
                      )}
                    />
                    <div className="flex justify-start gap-6">
                      {right.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex justify-center items-center gap-6">
                  {items.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                </div>
              );
            })()}

          </div>{/* end main-content */}

          {/* BOTTOM: Event info + Signature */}
          <div className="flex justify-between items-end mt-auto">
            <div data-testid="certificate-event-name">
              <div className="text-base text-stone-700">
                {event.name}
              </div>
              <div className="text-sm text-stone-500">
                {new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>

            <div className="text-center min-w-[200px]">
              <div className="border-b border-stone-500 h-8 mb-0.5" />
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold m-0">
                Cubmaster
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="py-1 text-center">
      <div className={cn(
        "text-3xl font-extrabold leading-7 font-cert-numbers",
        highlight ? "text-stone-900" : "text-stone-700"
      )}>
        {formatStatValue(value)}
      </div>
      <div className="text-sm uppercase tracking-widest text-stone-400 font-bold font-body">
        {formatOrdinalText(label)}
      </div>
    </div>
  );
}

// --- View ---

function FullPageMessage({ children, color = 'text-stone-500' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className={cn("flex items-center justify-center min-h-screen font-serif text-xl", color)}>
      {children}
    </div>
  );
}

export function CertificateView() {
  const { id: singleRacerId } = useParams<{ id?: string }>();
  const isBatch = !singleRacerId;

  const [event, setEvent] = useState<Event | null>(null);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [racerStats, setRacerStats] = useState<Map<string, RacerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let targetEventId: string | null = null;

        if (singleRacerId) {
          const racer = await api.getRacer(singleRacerId);
          if (!racer) {
            setError('Racer not found');
            setLoading(false);
            return;
          }
          targetEventId = racer.event_id;
        }

        if (!targetEventId) {
          const events = await api.getEvents();
          const activeEvent =
            events.find(e => e.status === 'complete') ||
            events[events.length - 1];
          if (!activeEvent) {
            setError('No event found');
            setLoading(false);
            return;
          }
          targetEventId = activeEvent.id;
        }

        const [eventData, racerData, standingData] = await Promise.all([
          api.getEvent(targetEventId),
          api.getRacers(targetEventId),
          api.getStandings(targetEventId),
        ]);

        if (!eventData) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        setEvent(eventData);
        setRacers(racerData);
        setStandings(standingData);

        const histories = await Promise.all(racerData.map(r => api.getRacerHistory(r.id)));
        const statsMap = new Map<string, RacerStats>();
        racerData.forEach((r, i) => statsMap.set(r.id, computeRacerStats(histories[i]!)));
        setRacerStats(statsMap);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [singleRacerId]);

  if (loading) {
    return <FullPageMessage>Loading certificates...</FullPageMessage>;
  }

  if (error || !event) {
    return <FullPageMessage color="text-red-500">{error || 'No event found'}</FullPageMessage>;
  }

  if (event.status !== 'complete') {
    return <FullPageMessage>Certificates will be available after racing is complete.</FullPageMessage>;
  }

  let targetRacers: Racer[];
  if (singleRacerId) {
    const found = racers.find(r => r.id === singleRacerId);
    targetRacers = found ? [found] : [];
  } else if (isBatch) {
    const standingOrder = new Map(standings.map((s, i) => [s.racer_id, i]));
    targetRacers = [...racers].sort((a, b) => {
      const ai = standingOrder.get(a.id) ?? 9999;
      const bi = standingOrder.get(b.id) ?? 9999;
      return ai - bi;
    });
  } else {
    targetRacers = [];
  }

  if (targetRacers.length === 0) {
    return <FullPageMessage>No racer found</FullPageMessage>;
  }

  return (
    <div className="bg-stone-200 min-h-screen p-4">
      <div className="no-print text-center mb-4">
        <button
          data-testid="btn-print"
          onClick={() => window.print()}
          className="bg-primary text-white py-3 px-8 text-base font-bold rounded-md cursor-pointer font-body"
        >
          Print Certificates
        </button>
        <p className="text-stone-500 mt-1.5 text-sm font-body">
          {targetRacers.length} certificate{targetRacers.length !== 1 ? 's' : ''} ready
        </p>
      </div>

      {targetRacers.map(racer => {
        const stats = racerStats.get(racer.id);
        const tier = classifyRacer(standings, racers, racer.id);
        return (
          <Certificate
            key={racer.id}
            racer={racer}
            stats={stats}
            tier={tier}
            event={event}
            totalRacers={standings.length}
          />
        );
      })}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white !important; }
          .certificate-page {
            page-break-after: always;
            padding: 12px 0 !important;
          }
          .certificate-page:last-child {
            page-break-after: auto;
          }
        }
        @page {
          size: landscape;
          margin: 0.4in;
        }
      `}</style>
    </div>
  );
}

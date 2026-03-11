import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DEN_IMAGES } from './lib/den-utils';
import { denPlacement, shouldShowDenRank } from './lib/den-rankings';
import './styles/styles.css';

// --- Local types (standalone bundle, no shared imports from main app) ---

interface Event {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'checkin' | 'racing' | 'complete';
}

interface Racer {
  id: string;
  event_id: string;
  name: string;
  den: string | null;
  car_number: string;
  car_photo_filename: string | null;
}

interface Standing {
  racer_id: string;
  car_number: string;
  racer_name: string;
  wins: number;
  losses: number;
  heats_run: number;
  avg_time_ms: number | null;
}

interface RacerResult {
  place: number | null;
  time_ms: number | null;
  dnf: number;
}

interface RacerStats {
  wins: number;
  second_place_count: number;
  third_place_count: number;
  best_time_ms: number | null;
  avg_time_ms: number | null;
}

function computeStats(results: RacerResult[]): RacerStats {
  let wins = 0, second_place_count = 0, third_place_count = 0;
  let total_time_ms = 0, time_count = 0;
  let best_time_ms: number | null = null;
  for (const r of results) {
    if (!r.dnf) {
      if (r.place === 1) wins++;
      else if (r.place === 2) second_place_count++;
      else if (r.place === 3) third_place_count++;
    }
    if (r.time_ms) {
      total_time_ms += r.time_ms;
      time_count++;
      if (best_time_ms === null || r.time_ms < best_time_ms) best_time_ms = r.time_ms;
    }
  }
  return { wins, second_place_count, third_place_count, best_time_ms, avg_time_ms: time_count > 0 ? total_time_ms / time_count : null };
}

// --- API ---

const api = {
  async getEvents(): Promise<Event[]> {
    const res = await fetch('/api/events');
    return res.ok ? res.json() : [];
  },
  async getRacer(racerId: string): Promise<Racer | null> {
    const res = await fetch(`/api/racers/${racerId}`);
    return res.ok ? res.json() : null;
  },
  async getRacers(eventId: string): Promise<Racer[]> {
    const res = await fetch(`/api/events/${eventId}/racers`);
    return res.ok ? res.json() : [];
  },
  async getStandings(eventId: string): Promise<Standing[]> {
    const res = await fetch(`/api/events/${eventId}/standings`);
    return res.ok ? res.json() : [];
  },
  async getRacerHistory(racerId: string): Promise<RacerResult[]> {
    const res = await fetch(`/api/racers/${racerId}/history`);
    return res.ok ? res.json() : [];
  },
  async getEvent(eventId: string): Promise<Event | null> {
    const res = await fetch(`/api/events/${eventId}`);
    return res.ok ? res.json() : null;
  },
};

// --- Certificate tiering ---

type CertTier =
  | { type: 'podium'; place: 1 | 2 | 3 }
  | { type: 'top10'; place: number }
  | { type: 'den_champion'; rank: 1; den: string }
  | { type: 'den_top3'; rank: 2 | 3; den: string }
  | { type: 'achievement' };

function classifyRacer(
  standings: Standing[],
  racers: Racer[],
  racerId: string,
): CertTier {
  const overallIdx = standings.findIndex(s => s.racer_id === racerId);
  const overallPlace = overallIdx + 1;

  if (overallPlace >= 1 && overallPlace <= 3) {
    return { type: 'podium', place: overallPlace as 1 | 2 | 3 };
  }
  if (overallPlace >= 4 && overallPlace <= 10) {
    return { type: 'top10', place: overallPlace };
  }

  const dp = denPlacement(standings, racers, racerId);
  if (dp && shouldShowDenRank(dp.rank, dp.total)) {
    if (dp.rank === 1) {
      return { type: 'den_champion', rank: 1, den: dp.den };
    }
    if (dp.rank === 2 || dp.rank === 3) {
      return { type: 'den_top3', rank: dp.rank as 2 | 3, den: dp.den };
    }
  }

  return { type: 'achievement' };
}

function tierHeadline(tier: CertTier): string {
  switch (tier.type) {
    case 'podium':
      return tier.place === 1 ? '1st Place' : tier.place === 2 ? '2nd Place' : '3rd Place';
    case 'top10':
      return `Top 10 \u2014 ${ordinal(tier.place)} Place`;
    case 'den_champion':
      return `Fastest ${tier.den.replace(/s$/, '')}!`;
    case 'den_top3':
      return `${ordinal(tier.rank)} in ${tier.den}!`;
    case 'achievement':
      return 'Pinewood Derby Racer';
  }
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function formatTime(ms: number | null): string {
  if (ms == null) return '\u2014';
  return (ms / 1000).toFixed(3) + 's';
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

const DEN_ACCENT: Record<string, string> = {
  Lions: '#eab308', Tigers: '#ea580c', Wolves: '#2563eb',
  Bears: '#dc2626', Webelos: '#4f46e5', AOLs: '#059669',
};

function getTierColors(tier: CertTier) {
  if (tier.type === 'podium') return TIER_COLORS[`podium-${tier.place}`]!;
  if (tier.type === 'top10') return TIER_COLORS.top10!;
  if (tier.type === 'den_champion' || tier.type === 'den_top3') {
    const accent = DEN_ACCENT[tier.den] ?? '#003F87';
    return { border: accent, ribbon: `linear-gradient(135deg, ${accent}, ${accent}dd)`, ribbonText: '#ffffff', glow: `${accent}25` };
  }
  return TIER_COLORS.achievement!;
}

// --- SVG decorations ---

function FleurDeLis({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} style={{ display: 'block' }}>
      {/* Center petal */}
      <path d="M50 5 C50 5 58 25 58 45 C58 60 55 70 50 80 C45 70 42 60 42 45 C42 25 50 5 50 5Z" fill={color} />
      {/* Left petal */}
      <path d="M15 50 C15 50 30 35 42 42 C48 46 50 55 50 80 C40 65 25 60 18 55 C12 50 15 50 15 50Z" fill={color} opacity={0.85} />
      {/* Right petal */}
      <path d="M85 50 C85 50 70 35 58 42 C52 46 50 55 50 80 C60 65 75 60 82 55 C88 50 85 50 85 50Z" fill={color} opacity={0.85} />
      {/* Center dot */}
      <circle cx={50} cy={45} r={4} fill="white" opacity={0.6} />
      {/* Base bar */}
      <rect x={38} y={82} width={24} height={5} rx={2} fill={color} opacity={0.7} />
      {/* Base triangle */}
      <path d="M42 90 L50 105 L58 90Z" fill={color} opacity={0.5} />
    </svg>
  );
}

function RopeKnotBorder({ color }: { color: string }) {
  // Decorative rope-style corner knots
  return (
    <>
      {/* Top-left */}
      <svg viewBox="0 0 60 60" width={40} height={40} style={{ position: 'absolute', top: 12, left: 12 }}>
        <path d="M5 30 Q5 5 30 5" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M10 30 Q10 10 30 10" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      {/* Top-right */}
      <svg viewBox="0 0 60 60" width={40} height={40} style={{ position: 'absolute', top: 12, right: 12 }}>
        <path d="M55 30 Q55 5 30 5" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M50 30 Q50 10 30 10" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      {/* Bottom-left */}
      <svg viewBox="0 0 60 60" width={40} height={40} style={{ position: 'absolute', bottom: 12, left: 12 }}>
        <path d="M5 30 Q5 55 30 55" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M10 30 Q10 50 30 50" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
      {/* Bottom-right */}
      <svg viewBox="0 0 60 60" width={40} height={40} style={{ position: 'absolute', bottom: 12, right: 12 }}>
        <path d="M55 30 Q55 55 30 55" fill="none" stroke={color} strokeWidth={3} opacity={0.4} />
        <path d="M50 30 Q50 50 30 50" fill="none" stroke={color} strokeWidth={2} opacity={0.25} />
      </svg>
    </>
  );
}

// --- Certificate component ---

interface CertificateProps {
  racer: Racer;
  standing: Standing | undefined;
  stats: RacerStats | undefined;
  tier: CertTier;
  event: Event;
}

function Certificate({ racer, standing, stats, tier, event }: CertificateProps) {
  const colors = getTierColors(tier);
  const headline = tierHeadline(tier);
  const denImage = racer.den ? DEN_IMAGES[racer.den] : null;
  const isPodium = tier.type === 'podium';
  const isDen = tier.type === 'den_champion' || tier.type === 'den_top3';
  const medal = isPodium
    ? tier.place === 1 ? '\uD83E\uDD47' : tier.place === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49'
    : null;

  return (
    <div
      data-testid="certificate"
      className="certificate-page"
      style={{
        pageBreakAfter: 'always',
        padding: '24px 16px',
      }}
    >
      <div style={{
        borderRadius: '4px',
        maxWidth: '960px',
        margin: '0 auto',
        background: '#fffdf7',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}>
        {/* Inner border line */}
        <div style={{
          position: 'absolute',
          inset: '8px',
          border: `2px solid ${colors.border}55`,
          borderRadius: '2px',
          pointerEvents: 'none',
        }} />

        <RopeKnotBorder color={colors.border} />

        {/* Content */}
        <div style={{ padding: '28px 56px 20px', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '560px' }}>

          {/* === TOP SECTION: Fleur-de-lis + Title === */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '12px' }}>
              <FleurDeLis color={colors.border} size={44} />
              <div>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.border,
                  margin: '0 0 1px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Certificate of Achievement
                </h1>
                <h2 style={{
                  fontSize: '13px',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  color: '#78716c',
                  margin: 0,
                  fontWeight: 600,
                }}>
                  Cub Scouts of America
                </h2>
              </div>
              <FleurDeLis color={colors.border} size={44} />
            </div>
            <div style={{
              width: '200px',
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${colors.border}88, transparent)`,
              margin: '0 auto',
            }} />
          </div>

          {/* === MIDDLE: flex-1 to push footer down === */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

          {/* === PRESENTED TO === */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{
              fontSize: '13px',
              color: '#a8a29e',
              fontStyle: 'italic',
              margin: '0 0 8px',
            }}>
              This certificate is proudly presented to
            </p>

            <h2
              data-testid="certificate-racer-name"
              style={{
                fontFamily: 'var(--font-racing)',
                fontSize: '52px',
                color: '#1c1917',
                margin: '0 0 6px',
                lineHeight: 1.1,
              }}
            >
              {racer.name}
            </h2>


          </div>

          {/* === ACHIEVEMENT RIBBON === */}
          <div style={{
            textAlign: 'center',
            margin: '20px auto',
            maxWidth: '500px',
          }}>
            <div style={{
              background: colors.ribbon,
              color: colors.ribbonText,
              padding: isPodium ? '16px 40px' : '14px 36px',
              borderRadius: '4px',
              display: 'inline-block',
              boxShadow: `0 4px 16px ${colors.glow}`,
              position: 'relative',
            }}>
              {medal && (
                <span style={{ fontSize: '40px', marginRight: '12px', verticalAlign: 'middle' }}>{medal}</span>
              )}
              <span
                data-testid="certificate-headline"
                style={{
                  fontFamily: 'var(--font-racing)',
                  fontSize: isPodium ? '34px' : isDen ? '30px' : '26px',
                  letterSpacing: '0.04em',
                  verticalAlign: 'middle',
                }}
              >
                {headline}
              </span>
              {medal && (
                <span style={{ fontSize: '40px', marginLeft: '12px', verticalAlign: 'middle' }}>{medal}</span>
              )}
            </div>
          </div>

          {/* === STATS ROW with den logo centered === */}
          {stats && (() => {
            const leftStats: { label: string; value: string; highlight?: boolean }[] = [];
            const rightStats: { label: string; value: string; highlight?: boolean }[] = [];

            // Build stat items (order matters: wins first, car # last)
            const items: { label: string; value: string; highlight?: boolean }[] = [];
            if (stats.wins > 0) items.push({ label: 'Wins', value: String(stats.wins), highlight: true });
            if (stats.second_place_count > 0) items.push({ label: '2nd Place', value: String(stats.second_place_count) });
            if (stats.third_place_count > 0) items.push({ label: '3rd Place', value: String(stats.third_place_count) });
            if (stats.best_time_ms != null) items.push({ label: 'Best Time', value: formatTime(stats.best_time_ms) });
            // Include avg time only when it keeps the total even
            if (stats.avg_time_ms != null && items.length % 2 !== 0) {
              items.push({ label: 'Avg Time', value: formatTime(stats.avg_time_ms) });
            }
            items.push({ label: 'Car #', value: racer.car_number });
            // If still odd after Car #, add avg time if we haven't yet
            if (items.length % 2 !== 0 && stats.avg_time_ms != null && !items.some(i => i.label === 'Avg Time')) {
              items.splice(items.length - 1, 0, { label: 'Avg Time', value: formatTime(stats.avg_time_ms) });
            }

            const mid = items.length / 2;
            const balancedLeft = items.slice(0, mid);
            const balancedRight = items.slice(mid);

            return (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '32px',
                margin: '24px 0',
                fontFamily: 'var(--font-body)',
              }}>
                <div style={{ display: 'flex', gap: '48px', justifyContent: 'flex-end', flex: 1 }}>
                  {balancedLeft.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                </div>
                {denImage ? (
                  <img
                    src={denImage}
                    alt={racer.den ?? ''}
                    style={{
                      width: isDen ? '110px' : '80px',
                      height: isDen ? '110px' : '80px',
                      objectFit: 'contain',
                      flexShrink: 0,
                      opacity: isDen ? 1 : 0.8,
                    }}
                  />
                ) : (
                  <div style={{ width: '80px', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', gap: '48px', justifyContent: 'flex-start', flex: 1 }}>
                  {balancedRight.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                </div>
              </div>
            );
          })()}

          </div>{/* end middle flex-1 */}

          {/* === BOTTOM: Event info + Signature === */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: `1px solid ${colors.border}33`,
          }}>
            {/* Event */}
            <div data-testid="certificate-event-name">
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#44403c' }}>
                {event.name}
              </div>
              <div style={{ fontSize: '13px', color: '#78716c' }}>
                {new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>

            {/* Cubmaster signature line */}
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
              <div style={{
                borderBottom: '1px solid #78716c',
                height: '32px',
                marginBottom: '2px',
              }} />
              <p style={{
                fontSize: '11px',
                color: '#78716c',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                margin: 0,
                fontWeight: 600,
              }}>
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
    <div style={{ padding: '4px 0', textAlign: 'center' }}>
      <div style={{
        fontSize: '28px',
        fontWeight: 800,
        color: highlight ? '#1c1917' : '#44403c',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.1,
        marginBottom: '4px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#a8a29e',
        fontWeight: 700,
      }}>
        {label}
      </div>
    </div>
  );
}

// --- App ---

function CertificateApp() {
  const [event, setEvent] = useState<Event | null>(null);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [racerStats, setRacerStats] = useState<Map<string, RacerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse route
  const path = window.location.pathname;
  const singleMatch = path.match(/^\/certificate\/([^/]+)$/);
  const isBatch = path === '/certificates';
  const singleRacerId = singleMatch?.[1] ?? null;

  useEffect(() => {
    (async () => {
      try {
        let targetEventId: string | null = null;

        // Single-racer mode: look up the racer to find their event
        if (singleRacerId) {
          const racer = await api.getRacer(singleRacerId);
          if (!racer) {
            setError('Racer not found');
            setLoading(false);
            return;
          }
          targetEventId = racer.event_id;
        }

        // Batch mode or fallback: pick the active event
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

        // Fetch heat history for all racers in parallel to compute stats
        const histories = await Promise.all(racerData.map(r => api.getRacerHistory(r.id)));
        const statsMap = new Map<string, RacerStats>();
        racerData.forEach((r, i) => statsMap.set(r.id, computeStats(histories[i]!)));
        setRacerStats(statsMap);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: 'Georgia, serif', fontSize: '20px', color: '#78716c',
      }}>
        Loading certificates...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ef4444',
      }}>
        {error || 'No event found'}
      </div>
    );
  }

  if (event.status !== 'complete') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: 'Georgia, serif', fontSize: '20px', color: '#78716c',
      }}>
        Certificates will be available after racing is complete.
      </div>
    );
  }

  // Determine which racers to show
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
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: 'Georgia, serif', fontSize: '20px', color: '#78716c',
      }}>
        No racer found
      </div>
    );
  }

  return (
    <div style={{ background: '#e7e5e4', minHeight: '100vh', padding: '16px' }}>
      {/* Print button */}
      <div className="no-print" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button
          data-testid="btn-print"
          onClick={() => window.print()}
          style={{
            background: '#003F87',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            fontSize: '16px',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Print Certificates
        </button>
        <p style={{ color: '#78716c', marginTop: '6px', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
          {targetRacers.length} certificate{targetRacers.length !== 1 ? 's' : ''} ready
        </p>
      </div>

      {targetRacers.map(racer => {
        const standing = standings.find(s => s.racer_id === racer.id);
        const stats = racerStats.get(racer.id);
        const tier = classifyRacer(standings, racers, racer.id);
        return (
          <Certificate
            key={racer.id}
            racer={racer}
            standing={standing}
            stats={stats}
            tier={tier}
            event={event}
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

const root = createRoot(document.getElementById('app')!);
root.render(<CertificateApp />);

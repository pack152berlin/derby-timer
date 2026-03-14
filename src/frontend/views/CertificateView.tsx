import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { cn, CURRENT_EVENT_KEY } from '@/lib/utils';
import { DEN_IMAGES, DEN_SINGULAR, DEN_ACCENT, DENS_WITH_LIGHT_ACCENT } from '../lib/den-utils';
import { classifyRacer, buildCertificateStats, computeRacerStats, bestLane } from '../lib/certificate-stats';
import type { CertTier, RacerStats } from '../lib/certificate-stats';
import type { Event, Racer, Standing, RacerHistoryEntry, EventAwardWinner } from '../types';
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
    const raw = DEN_ACCENT[tier.den] ?? '#003F87';
    const accent = DENS_WITH_LIGHT_ACCENT.has(tier.den) ? '#003F87' : raw;
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

/** Scouts fleur-de-lis (BSA-style) for events that use dens */
function ScoutFleurDeLis({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 588 598" width={size} height={size * 1.017} className="block">
      <path fill={color} d="M588 273.17L588 275.44Q587.9 288.16 586.21 297.48Q580.82 327.25 564.24 352.52A0.45 0.44 45.4 0 1 563.5 352.51Q554.48 338.51 544.23 326.42C540.2 321.66 534.39 316.07 530.56 312.95C509.54 295.82 481.46 290.84 455.49 296.79C435.25 301.43 418.36 314.33 406.49 330.96C403.41 335.28 399.19 341.54 396.32 346.73Q389.4 359.21 383.8 372.6A0.25 0.24 11.1 0 0 384.03 372.93C394.25 372.76 407.46 377.68 409.59 389.17C410.8 395.76 407.84 401.96 402.58 405.85C393.98 412.21 385.14 411.4 374.02 411.41A0.68 0.67 2.9 0 0 373.36 412Q371.06 429.99 374.39 446.62C376.39 456.57 382.17 468.82 392.62 472.15Q399.58 474.36 407.83 474.19C426.12 473.82 439.29 457.87 448.63 444.03A0.38 0.37-38.8 0 1 449.29 444.1C459.5 470.1 462.39 507.57 440.48 529C428.9 540.34 409.81 545.42 394.38 543.82C358.77 540.13 341.98 502.99 335.25 472.29Q328.82 442.96 328.74 412.12A0.72 0.72 0 0 0 328.02 411.4L311.28 411.4A0.64 0.64 0 0 0 310.64 412Q309.75 427.87 309.75 431.75C309.76 453.51 315.78 475.06 324.36 494.66C331.5 510.96 335.55 519.23 338.96 529.76C347.64 556.52 313.8 585.09 294.97 598Q294.92 598 294.87 598Q277.33 586.37 264.29 571.47Q258.49 564.84 253.37 555.41C252.16 553.18 251.66 551.11 250.63 548.4C248.32 542.29 248.65 535.22 250.77 529C256.98 510.82 266.63 492.84 270.3 481.6Q274.82 467.77 275.35 465.58C278.81 451.13 280.37 438.27 279.51 424.59Q279.41 422.94 278.9 411.81A0.43 0.42 88.6 0 0 278.48 411.4L259.91 411.4A0.67 0.67 0 0 0 259.24 412.07Q259.19 443.09 252.64 472.69C244.76 508.31 223.88 549.09 180.44 543.61Q166.26 541.82 154.96 534.78C142.01 526.73 134.22 512.39 132.1 497.4Q128.33 470.73 138.69 444.08A0.35 0.35 0 0 1 139.31 444.01C150.53 460.5 164.66 476.76 186.88 473.89C194.29 472.93 199.95 471.35 204.53 466.01C212.97 456.17 215.43 441.68 215.48 428.7Q215.52 416.89 214.59 411.9A0.57 0.56 84.4 0 0 214.04 411.44C203.39 411.34 194.59 412.01 186.23 405.07C177.74 398.04 177.76 386.21 186.27 379.2Q193.69 373.1 203.81 373.03A0.32 0.32 0 0 0 204.11 372.59Q195.35 350.63 181.93 331.55Q172.94 318.78 160.44 309.56C142.27 296.18 119.77 292.35 97.48 295.49Q76.38 298.46 59.56 311.27C56.51 313.59 54.02 316.17 51.44 318.45Q48.54 321 45.71 324.2C37.74 333.21 31.24 342.69 24.42 352.43A0.42 0.41-43.8 0 1 23.73 352.42Q6.65 326.15 1.71 297.02Q0.12 287.67 0 275.51L0 273.32C0.65 268.51 0.94 263.27 1.84 258.93Q9.42 222.04 42.15 202.89Q55.53 195.06 72.66 190.54C97.52 183.99 123.01 191.52 144.37 205.4Q167.12 220.2 185.78 241.49Q224.56 285.71 245.22 341.29Q250.87 356.5 254.6 372.37A0.68 0.68 0 0 0 255.26 372.9L271.57 372.9A0.32 0.32 0 0 0 271.88 372.49C263.42 340.9 251.03 312.63 234.98 281.11C222.48 256.56 214.34 241.55 205.24 220.78Q201.58 212.42 198.65 202.33Q193.67 185.19 197.69 166.95C201.39 150.19 207.97 133.86 215.39 119.38C220.37 109.67 227.5 96.46 234.18 85.66Q261.16 42.01 294.44 0.57A0.42 0.41 44.7 0 1 295.09 0.57Q320.56 32.46 343.07 66.41Q359.76 91.58 373.24 117.74C381.27 133.33 387.97 149.74 391.74 166.75Q395.82 185.18 390.88 202.15Q387.82 212.67 384.39 220.42C380.95 228.18 375.95 239.26 371.36 248.13C350.58 288.35 329.16 328.74 317.65 372.48A0.34 0.34 0 0 0 317.98 372.9L332.64 372.9A0.71 0.71 0 0 0 333.33 372.37C335.81 363.1 337.09 357.62 339.74 349.81Q360.27 289.42 402.42 241.16Q405.84 237.24 415.49 227.75Q426.23 217.2 441.98 206.51C463.52 191.88 489.46 183.98 515.25 190.52C533.77 195.21 552.03 204.17 565.35 218.14Q583.39 237.08 586.78 264.02Q587.36 268.61 588 273.17Z"/>
    </svg>
  );
}

/** 5-pointed star badge for Top 5 tier */
function StarBadge({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      <circle cx={50} cy={50} r={46} fill="none" stroke={color} strokeWidth={2} opacity={0.2} />
      <path
        d="M50 8 L61 38 L93 38 L67 56 L77 86 L50 68 L23 86 L33 56 L7 38 L39 38Z"
        fill={color} opacity={0.8}
      />
      <path
        d="M50 22 L57 40 L77 40 L61 52 L67 72 L50 60 L33 72 L39 52 L23 40 L43 40Z"
        fill="white" opacity={0.12}
      />
      <circle cx={50} cy={50} r={6} fill="white" opacity={0.2} />
    </svg>
  );
}

/** Laurel wreath badge for Top 10 tier */
function LaurelBadge({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 105" width={size} height={size * 1.05} className="block">
      {/* Left branch */}
      <g opacity={0.7}>
        <ellipse cx={28} cy={28} rx={5} ry={12} fill={color} transform="rotate(-30 28 28)" />
        <ellipse cx={22} cy={42} rx={5} ry={11} fill={color} transform="rotate(-15 22 42)" />
        <ellipse cx={20} cy={56} rx={5} ry={11} fill={color} transform="rotate(0 20 56)" />
        <ellipse cx={22} cy={70} rx={5} ry={10} fill={color} transform="rotate(15 22 70)" />
        <ellipse cx={28} cy={82} rx={5} ry={9} fill={color} transform="rotate(30 28 82)" />
      </g>
      {/* Right branch */}
      <g opacity={0.7}>
        <ellipse cx={72} cy={28} rx={5} ry={12} fill={color} transform="rotate(30 72 28)" />
        <ellipse cx={78} cy={42} rx={5} ry={11} fill={color} transform="rotate(15 78 42)" />
        <ellipse cx={80} cy={56} rx={5} ry={11} fill={color} transform="rotate(0 80 56)" />
        <ellipse cx={78} cy={70} rx={5} ry={10} fill={color} transform="rotate(-15 78 70)" />
        <ellipse cx={72} cy={82} rx={5} ry={9} fill={color} transform="rotate(-30 72 82)" />
      </g>
      {/* Stems */}
      <path d="M35 90 Q30 70 28 28 Q27 18 30 12" fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
      <path d="M65 90 Q70 70 72 28 Q73 18 70 12" fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
      {/* Bottom ribbon cross */}
      <path d="M35 90 Q50 97 65 90" fill="none" stroke={color} strokeWidth={2.5} opacity={0.5} />
      <path d="M38 93 L44 103" stroke={color} strokeWidth={2} opacity={0.35} strokeLinecap="round" />
      <path d="M62 93 L56 103" stroke={color} strokeWidth={2} opacity={0.35} strokeLinecap="round" />
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

export interface CertificateProps {
  racer: Racer;
  stats: RacerStats | undefined;
  tier: CertTier;
  event: Event;
  totalRacers: number;
  organization?: string;
  awardWins?: EventAwardWinner[];
}

/** Check if an award name is scout-themed (e.g. "Most Scout-Like") */
function isScoutAward(name: string) {
  return /\bscout[\s-]?like\b/i.test(name);
}

/** Render an award name with fleur-de-lis on both sides for scout awards */
function AwardLabel({ name, color, size = 18, hasDen = false }: { name: string; color: string; size?: number; hasDen?: boolean }) {
  if (isScoutAward(name)) {
    const Fleur = hasDen ? ScoutFleurDeLis : FleurDeLis;
    return <span className="inline-flex items-center gap-3"><Fleur color={color} size={size} />{name}<Fleur color={color} size={size} /></span>;
  }
  return <>{name}</>;
}

export function Certificate({ racer, stats, tier, event, totalRacers, organization, awardWins }: CertificateProps) {
  const colors = getTierColors(tier);
  const denImage = racer.den ? DEN_IMAGES[racer.den] : null;
  const hasDen = !!racer.den;
  const Fleur = hasDen ? ScoutFleurDeLis : FleurDeLis;
  const isPodium = tier.type === 'podium';
  const subtitle = tierSubtitle(tier, totalRacers);
  const medal = isPodium
    ? tier.place === 1 ? '\uD83E\uDD47' : tier.place === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49'
    : null;
  const tierIcon = tier.type === 'top5'
    ? <StarBadge color={colors.border} size={56} />
    : tier.type === 'top10'
    ? <LaurelBadge color={colors.border} size={52} />
    : null;

  // Achievement tier with custom awards → promote award to headline
  const hasAwardHeadline = tier.type === 'achievement' && awardWins && awardWins.length > 0;
  const headline = hasAwardHeadline ? null : tierHeadline(tier);

  return (
    <div
      data-testid="certificate"
      className="certificate-page break-after-page py-6 px-4 print:py-0 print:px-0"
    >
      <div className="cert-scale-wrapper mx-auto">
        <div className="cert-card rounded print:rounded-none bg-[#fffdf7] relative overflow-hidden font-serif w-full h-full">
        <div
          className="absolute inset-2 rounded-sm pointer-events-none"
          style={{ border: `2px solid ${colors.border}55` }}
        />

        <RopeKnotBorder color={colors.border} />

        <div className="cert-inner pt-7 px-14 pb-5 relative flex flex-col" style={{ height: '100%', boxSizing: 'border-box' }}>

          {/* TOP: Fleur-de-lis + Title */}
          <div className="text-center">
            <div className="flex justify-center items-center gap-5 mb-3">
              <div className="-mt-2"><Fleur color={colors.border} size={44} /></div>
              <div>
                <h1
                  className="text-4xl font-bold uppercase tracking-wider m-0"
                  style={{ color: colors.border }}
                >
                  Certificate of Achievement
                </h1>
                <h2 className="text-base font-semibold uppercase tracking-[0.35em] text-stone-500 m-0">
                  {organization || event.organization || 'Cub Scouts of America'}
                </h2>
              </div>
              <div className="-mt-2"><Fleur color={colors.border} size={44} /></div>
            </div>
            <div
              className="w-48 h-px mx-auto"
              style={{ background: `linear-gradient(90deg, transparent, ${colors.border}88, transparent)` }}
            />
          </div>

          {/* MAIN CONTENT: name + ribbon + stats */}
          <div className="flex-1 flex flex-col items-center justify-around py-6">

            <div className="text-center">
              <p className="text-sm text-stone-400 italic">
                This certificate is proudly presented to
              </p>
              <h2
                data-testid="certificate-racer-name"
                className="text-5xl text-yellow-950 leading-tight tracking-widest font-cert-heading"
              >
                {racer.name}
              </h2>
            </div>

            <div className="text-center w-full max-w-2xl mx-auto">
              <div className={cn("rounded inline-flex items-center justify-center relative ", isPodium ? "py-4 px-14" : "py-3.5 px-9")}>
                {medal && (
                  <span className="absolute -left-24 text-[64px] leading-none">{medal}</span>
                )}
                {tierIcon && (
                  <div className="absolute -left-20 top-1/2 -translate-y-1/2">{tierIcon}</div>
                )}
                <div className="text-center leading-none">
                  {hasAwardHeadline ? (
                    <>
                      <div
                        data-testid="certificate-headline"
                        className="text-[42px] tracking-wide text-yellow-950 font-cert-heading leading-none"
                      >
                        {awardWins!.map((a, i) => (
                          <React.Fragment key={a.id}>
                            {i > 0 && <span className="text-[32px] opacity-50"> & </span>}
                            <AwardLabel name={a.award_name} color={colors.border} size={36} hasDen={hasDen} />
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="text-lg font-semibold tracking-wider uppercase opacity-50 font-body leading-none mt-2">
                        {event.name}
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        data-testid="certificate-headline"
                        className={cn(
                          "tracking-wide text-yellow-950 font-cert-heading leading-none",
                          isPodium ? "text-[48px]" : "text-[42px]"
                        )}
                      >
                        {headline}
                      </span>
                      {subtitle && (
                        <div className="text-base font-semibold tracking-wide opacity-70 font-body leading-none">
                          {subtitle}
                        </div>
                      )}
                      {isPodium && (
                        <div className="text-sm font-semibold tracking-widest uppercase opacity-60 leading-none mt-1">
                          {event.name}
                        </div>
                      )}
                      {awardWins && awardWins.length > 0 && isPodium && (
                        <div className="text-base font-semibold tracking-wide italic mt-1.5 font-body" style={{ color: colors.border }}>
                          & voted {awardWins.map((a, i) => (
                            <React.Fragment key={a.id}>
                              {i > 0 && ' & '}
                              <AwardLabel name={a.award_name} color={colors.border} size={16} hasDen={hasDen} />
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {medal && (
                  <span className="absolute -right-24 text-[64px] leading-none">{medal}</span>
                )}
                {tierIcon && (
                  <div className="absolute -right-20 top-1/2 -translate-y-1/2">{tierIcon}</div>
                )}
              </div>
            </div>

            {awardWins && awardWins.length > 0 && !isPodium && !hasAwardHeadline && (
              <div className="flex justify-center gap-3 -mt-2">
                {awardWins.map(a => (
                  <div
                    key={a.id}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-body font-bold text-sm"
                    style={{ background: `${colors.border}15`, color: colors.border, border: `1.5px solid ${colors.border}40` }}
                  >
                    {isScoutAward(a.award_name)
                      ? <Fleur color={colors.border} size={16} />
                      : <span className="text-base">&#127942;</span>}
                    {a.award_name}
                  </div>
                ))}
              </div>
            )}

            {stats && (() => {
              const isAchievement = tier.type === 'achievement';
              const items = buildCertificateStats(stats, racer.car_number, { showRaces: isAchievement });
              const mid = Math.ceil(items.length / 2);
              const left = items.slice(0, mid);
              const right = items.slice(mid);

              if (denImage) {
                return (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-12">
                    <div className="flex justify-end gap-12">
                      {left.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                    </div>
                    <img
                      src={denImage}
                      alt={racer.den ?? ''}
                      className={cn(
                        "object-contain shrink-0",
                        isPodium ? "w-[104px] h-[104px] opacity-80" : "w-[146px] h-[146px]"
                      )}
                    />
                    <div className="flex justify-start gap-12">
                      {right.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex justify-center items-center gap-12">
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
    </div>
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={cn(
        "text-3xl font-extrabold font-cert-numbers h-9 flex items-end justify-center",
        highlight ? "text-stone-900" : "text-stone-700"
      )}>
        {formatStatValue(value)}
      </div>
      <div className="text-sm uppercase tracking-widest text-stone-400 font-bold font-body mt-0.5">
        {formatOrdinalText(label)}
      </div>
    </div>
  );
}

// --- Results helpers ---

type PrintMode = 'cert' | 'cert-results' | 'combined';

function fmtTime(ms: number | null): string {
  if (ms == null) return '\u2014';
  return (ms / 1000).toFixed(3) + 's';
}

function placeDisplay(place: number | null, dnf: boolean): { node: React.ReactNode; cls: string } {
  if (dnf) return { node: 'DNF', cls: 'bg-red-50 text-red-400 font-semibold' };
  if (place === 1) return { node: <>{'\uD83E\uDD47'} 1st</>, cls: 'bg-amber-50/80 text-amber-800 font-bold' };
  if (place === 2) return { node: <>{'\uD83E\uDD48'} 2nd</>, cls: 'bg-slate-100/80 text-slate-600 font-semibold' };
  if (place === 3) return { node: <>{'\uD83E\uDD49'} 3rd</>, cls: 'bg-orange-50/80 text-orange-700 font-semibold' };
  if (place != null) {
    return { node: <>{ordinal(place)}</>, cls: 'text-stone-500' };
  }
  return { node: '\u2014', cls: 'text-stone-400' };
}

// --- Results table (shared between ResultsCard and CombinedCertificate) ---

function ResultsTable({ history, stats, colors }: {
  history: RacerHistoryEntry[];
  stats: RacerStats | undefined;
  colors: { border: string };
}) {
  const count = history.length;
  const hasTimes = history.some(h => h.time_ms != null && h.time_ms > 0);

  // Scale fonts: large when few heats, shrink as list grows, current sizes are the floor
  const cellFs = count <= 6 ? 21 : count <= 10 ? 19 : count <= 14 ? 17 : 15;
  const placeFs = count <= 6 ? 20 : count <= 10 ? 18 : count <= 14 ? 16 : 14;
  const timeFs = count <= 6 ? 20 : count <= 10 ? 18 : count <= 14 ? 16 : 14;
  const cellPy = count <= 6 ? 7 : count <= 10 ? 5 : count <= 14 ? 3 : 1;

  return (
    <>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: `2px solid ${colors.border}40` }}>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 font-body font-semibold pb-1.5 w-12">Rnd</th>
            <th className="text-left text-xs uppercase tracking-wider text-stone-500 font-body font-semibold pb-1.5 w-12">Heat</th>
            <th className="text-center text-xs uppercase tracking-wider text-stone-500 font-body font-semibold pb-1.5 w-12">Lane</th>
            <th className="text-center text-xs uppercase tracking-wider text-stone-500 font-body font-semibold pb-1.5 w-24">Place</th>
            {hasTimes && (
              <th className="text-right text-xs uppercase tracking-wider text-stone-500 font-body font-semibold pb-1.5">Time</th>
            )}
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => {
            const pl = placeDisplay(h.place, h.dnf);
            return (
              <tr
                key={h.id}
                className={i % 2 === 0 ? 'bg-stone-50/50' : ''}
                style={{ borderBottom: '1px solid #e7e5e440' }}
              >
                <td className="font-body font-semibold text-stone-600" style={{ fontSize: cellFs, paddingTop: cellPy, paddingBottom: cellPy }}>{h.round}</td>
                <td className="font-body text-stone-500" style={{ fontSize: cellFs, paddingTop: cellPy, paddingBottom: cellPy }}>{h.heat_number}</td>
                <td className="text-center font-body text-stone-500" style={{ fontSize: cellFs, paddingTop: cellPy, paddingBottom: cellPy }}>{h.lane_number}</td>
                <td className="text-center">
                  <span className={cn("inline-block rounded px-2 py-0.5 font-body", pl.cls)} style={{ fontSize: placeFs }}>{pl.node}</span>
                </td>
                {hasTimes && (
                  <td className="text-right font-cert-numbers text-stone-600" style={{ fontSize: timeFs, paddingTop: cellPy, paddingBottom: cellPy }}>
                    {fmtTime(h.time_ms)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {stats && (
        <div
          className="mt-auto pt-2 flex gap-5 border-t font-body"
          style={{ borderColor: `${colors.border}30` }}
        >
          {stats.best_time_ms != null && (
            <div>
              <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold">Best </span>
              <span className="font-bold text-stone-700 font-cert-numbers text-sm">{fmtTime(stats.best_time_ms)}</span>
            </div>
          )}
          {stats.avg_time_ms != null && (
            <div>
              <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold">Avg </span>
              <span className="font-bold text-stone-700 font-cert-numbers text-sm">{fmtTime(stats.avg_time_ms)}</span>
            </div>
          )}
          <div className="ml-auto text-sm text-stone-600 font-semibold self-end">
            {stats.heats_raced} heat{stats.heats_raced !== 1 ? 's' : ''} raced
          </div>
        </div>
      )}
    </>
  );
}

// --- Results Card (full page, back of certificate) ---

interface CertResultsBaseProps {
  racer: Racer;
  history: RacerHistoryEntry[];
  stats: RacerStats | undefined;
  tier: CertTier;
  event: Event;
  totalRacers: number;
  organization?: string;
  awardWins?: EventAwardWinner[];
}

interface ResultsCardProps extends CertResultsBaseProps {
  standings: Standing[];
}

function ResultsCard({ racer, history, stats, tier, event, totalRacers, standings }: ResultsCardProps) {
  const colors = getTierColors(tier);
  const denImage = racer.den ? DEN_IMAGES[racer.den] : null;
  const racerBestLane = bestLane(history);
  const overallPlace = standings.findIndex(s => s.racer_id === racer.id) + 1;

  return (
    <div data-testid="results-card" className="certificate-page break-after-page py-6 px-4 print:py-0 print:px-0">
      <div className="cert-scale-wrapper mx-auto">
        <div className="cert-card rounded print:rounded-none bg-[#fffdf7] relative overflow-hidden w-full h-full">
          <div className="absolute inset-2 rounded-sm pointer-events-none" style={{ border: `2px solid ${colors.border}55` }} />
          <RopeKnotBorder color={colors.border} />

          <div className="cert-inner pt-6 px-10 pb-5 relative flex h-full gap-8" style={{ boxSizing: 'border-box' }}>
            {/* LEFT: Racer identity — full height, content spread, footer pinned */}
            <div className="w-[32%] flex flex-col items-center border-r pr-6 text-center self-stretch" style={{ borderColor: `${colors.border}30` }}>
              <div className="flex-1 flex flex-col items-center justify-around">
                {denImage && (
                  <img src={denImage} alt={racer.den ?? ''} className="w-24 h-24 object-contain opacity-80" />
                )}

                <div>
                  <h2 className="text-3xl font-cert-heading text-yellow-950 leading-tight tracking-wide">
                    {racer.name}
                  </h2>
                  <p className="text-sm text-stone-500 font-body mt-1">
                    {racer.den && <>{racer.den} &middot; </>}Car #{racer.car_number}
                  </p>
                </div>

                {stats && (() => {
                  const items: { label: string; value: string; highlight?: boolean }[] = [];
                  if (stats.wins > 0) items.push({ label: 'Wins', value: String(stats.wins), highlight: true });
                  if (stats.second_place_count > 0) items.push({ label: '2nd Place', value: String(stats.second_place_count) });
                  if (stats.third_place_count > 0) items.push({ label: '3rd Place', value: String(stats.third_place_count) });
                  if (stats.best_time_ms != null) items.push({ label: 'Best Time', value: fmtTime(stats.best_time_ms) });
                  if (stats.avg_time_ms != null) items.push({ label: 'Avg Time', value: fmtTime(stats.avg_time_ms) });
                  if (racerBestLane != null) items.push({ label: 'Best Lane', value: String(racerBestLane) });
                  return (
                    <div className="flex flex-col items-center gap-2.5">
                      {items.map(s => <StatItem key={s.label} label={s.label} value={s.value} highlight={s.highlight} />)}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-auto pt-3 self-start text-left">
                <div className="text-sm text-stone-700">{event.name}</div>
                <div className="text-xs text-stone-500">
                  {new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT: Results table */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-baseline justify-between mb-3">
                <h3
                  className="text-xl font-bold uppercase tracking-[0.2em] font-body m-0"
                  style={{ color: colors.border }}
                >
                  Race Results
                </h3>
                {overallPlace > 0 && (
                  <div className="text-base font-bold font-body" style={{ color: colors.border }}>
                    {ordinal(overallPlace)} <span className="text-sm font-normal text-stone-400">of {totalRacers}</span>
                  </div>
                )}
              </div>

              {history.length > 0 ? (
                <ResultsTable history={history} stats={stats} colors={colors} />
              ) : (
                <p className="text-stone-400 italic font-body text-sm">No race results recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Combined Certificate (single page: cert + results) ---

function CombinedCertificate({ racer, history, stats, tier, event, totalRacers, organization, awardWins }: CertResultsBaseProps) {
  const colors = getTierColors(tier);
  const denImage = racer.den ? DEN_IMAGES[racer.den] : null;
  const hasDen = !!racer.den;
  const Fleur = hasDen ? ScoutFleurDeLis : FleurDeLis;
  const isPodium = tier.type === 'podium';
  const subtitle = tierSubtitle(tier, totalRacers);
  const racerBestLane = bestLane(history);
  const medal = isPodium
    ? tier.place === 1 ? '\uD83E\uDD47' : tier.place === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49'
    : null;
  const tierIcon = tier.type === 'top5'
    ? <StarBadge color={colors.border} size={36} />
    : tier.type === 'top10'
    ? <LaurelBadge color={colors.border} size={34} />
    : null;
  const hasAwardHeadline = tier.type === 'achievement' && awardWins && awardWins.length > 0;
  const headline = hasAwardHeadline ? null : tierHeadline(tier);

  return (
    <div data-testid="combined-certificate" className="certificate-page break-after-page py-6 px-4 print:py-0 print:px-0">
      <div className="cert-scale-wrapper mx-auto">
        <div className="cert-card rounded print:rounded-none bg-[#fffdf7] relative overflow-hidden font-serif w-full h-full">
          <div className="absolute inset-2 rounded-sm pointer-events-none" style={{ border: `2px solid ${colors.border}55` }} />
          <RopeKnotBorder color={colors.border} />

          <div className="cert-inner pt-5 px-12 pb-4 relative flex flex-col h-full" style={{ boxSizing: 'border-box' }}>

            {/* TOP: Certificate title bar */}
            <div className="text-center mb-3">
              <div className="flex justify-center items-center gap-4 mb-2">
                <div className="-mt-1.5"><Fleur color={colors.border} size={34} /></div>
                <div>
                  <h1 className="text-[26px] font-bold uppercase tracking-wider m-0" style={{ color: colors.border }}>
                    Certificate of Achievement
                  </h1>
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-stone-500 m-0">
                    {organization || event.organization || 'Cub Scouts of America'}
                  </h2>
                </div>
                <div className="-mt-1.5"><Fleur color={colors.border} size={34} /></div>
              </div>
              <div className="w-36 h-px mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${colors.border}88, transparent)` }} />
            </div>

            {/* MAIN: Left (name + den + stats) | Right (results table) */}
            <div className="flex gap-6 flex-1">
              {/* Left: Name, headline, den, stats */}
              <div className="w-[38%] flex flex-col items-center justify-around text-center border-r pr-6" style={{ borderColor: `${colors.border}30` }}>
                <div className="text-center">
                  <p className="text-xs text-stone-400 italic mb-0.5">This certificate is proudly presented to</p>
                  <h2 className="text-4xl text-yellow-950 leading-tight tracking-widest font-cert-heading m-0 whitespace-nowrap">
                    {racer.name}
                  </h2>
                </div>

                <div className="text-center">
                  {hasAwardHeadline ? (
                    <>
                      <div className="text-[30px] tracking-wide text-yellow-950 font-cert-heading leading-tight">
                        {awardWins!.map((a, i) => (
                          <React.Fragment key={a.id}>
                            {i > 0 && <span className="text-[24px] opacity-50"> & </span>}
                            <AwardLabel name={a.award_name} color={colors.border} size={26} hasDen={hasDen} />
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="text-xs font-semibold tracking-wider uppercase opacity-50 font-body leading-none mt-1">
                        {event.name}
                      </div>
                    </>
                  ) : (
                    <>
                      {medal && <span className="text-3xl mr-1.5">{medal}</span>}
                      {tierIcon && <span className="inline-block mr-1.5 align-middle">{tierIcon}</span>}
                      <span className={cn("font-cert-heading text-yellow-950 tracking-wide", isPodium ? "text-[36px]" : "text-[30px]")}>
                        {headline}
                      </span>
                      {medal && <span className="text-2xl ml-1.5">{medal}</span>}
                      {tierIcon && <span className="inline-block ml-1.5 align-middle">{tierIcon}</span>}
                      {subtitle && (
                        <div className="text-sm font-semibold tracking-wide opacity-70 font-body mt-0.5">{subtitle}</div>
                      )}
                      {awardWins && awardWins.length > 0 && (
                        <div className="text-xs font-semibold tracking-wide italic mt-1 font-body" style={{ color: colors.border }}>
                          {isPodium ? '& voted ' : ''}
                          {awardWins.map((a, i) => (
                            <React.Fragment key={a.id}>
                              {i > 0 && ' & '}
                              <AwardLabel name={a.award_name} color={colors.border} size={14} hasDen={hasDen} />
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {denImage && (
                  <img src={denImage} alt={racer.den ?? ''} className="w-20 h-20 object-contain opacity-80" />
                )}

                {stats && (() => {
                  const items: { label: string; value: string; highlight?: boolean }[] = [];
                  if (stats.wins > 0) items.push({ label: 'Wins', value: String(stats.wins), highlight: true });
                  if (stats.best_time_ms != null) items.push({ label: 'Best', value: fmtTime(stats.best_time_ms) });
                  if (stats.avg_time_ms != null) items.push({ label: 'Avg', value: fmtTime(stats.avg_time_ms) });
                  if (racerBestLane != null) items.push({ label: 'Best Lane', value: String(racerBestLane) });
                  items.push({ label: 'Car #', value: racer.car_number });
                  return (
                    <div className={cn("grid gap-x-6 gap-y-0.5", items.length > 3 ? "grid-cols-2" : "grid-cols-1")}>
                      {items.map((s, i) => (
                        <div key={s.label} className={cn("text-center", items.length > 3 && items.length % 2 === 1 && i === items.length - 1 && "col-span-2")}>
                          <div className={cn("text-xl font-extrabold font-cert-numbers leading-tight", s.highlight ? "text-stone-900" : "text-stone-700")}>
                            {formatStatValue(s.value)}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold font-body leading-tight">
                            {formatOrdinalText(s.label)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Right: Results table */}
              <div className="flex-1 flex flex-col">
                <h3
                  className="text-sm font-bold uppercase tracking-[0.15em] mb-2 font-body"
                  style={{ color: colors.border }}
                >
                  Race Results
                </h3>

                {history.length > 0 ? (
                  <ResultsTable history={history} stats={stats} colors={colors} />
                ) : (
                  <p className="text-stone-400 italic font-body text-sm">No race results recorded</p>
                )}
              </div>
            </div>

            {/* BOTTOM: Event + Signature */}
            <div className="flex justify-between items-end mt-auto pt-2">
              <div>
                <div className="text-sm text-stone-700">{event.name}</div>
                <div className="text-xs text-stone-500">
                  {new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </div>
              </div>
              <div className="text-center min-w-[180px]">
                <div className="border-b border-stone-500 h-6 mb-0.5" />
                <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold m-0">Cubmaster</p>
              </div>
            </div>

          </div>
        </div>
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
  const [racerHistories, setRacerHistories] = useState<Map<string, RacerHistoryEntry[]>>(new Map());
  const [awardWinners, setAwardWinners] = useState<EventAwardWinner[]>([]);
  const [printMode, setPrintMode] = useState<PrintMode>('cert');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authDenied, setAuthDenied] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  // Swap favicon to certificate/award icon while on this page
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    const original = link.href;
    link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='15' r='14' fill='white' opacity='.18'/%3E%3Cg transform='translate(4,1.5) scale(0.24)'%3E%3Cpath d='M50 5 C50 5 58 25 58 45 C58 60 55 70 50 80 C45 70 42 60 42 45 C42 25 50 5 50 5Z' fill='%23003F87'/%3E%3Cpath d='M15 50 C15 50 30 35 42 42 C48 46 50 55 50 80 C40 65 25 60 18 55 C12 50 15 50 15 50Z' fill='%23003F87' opacity='.85'/%3E%3Cpath d='M85 50 C85 50 70 35 58 42 C52 46 50 55 50 80 C60 65 75 60 82 55 C88 50 85 50 85 50Z' fill='%23003F87' opacity='.85'/%3E%3Ccircle cx='50' cy='45' r='4' fill='white' opacity='.6'/%3E%3Crect x='38' y='82' width='24' height='5' rx='2' fill='%23003F87' opacity='.7'/%3E%3Cpath d='M42 90 L50 105 L58 90Z' fill='%23003F87' opacity='.5'/%3E%3C/g%3E%3C/svg%3E";
    return () => { link.href = original; };
  }, []);

  useEffect(() => {
    (async () => {
      setAuthDenied(false);
      setNeedsLogin(false);
      setError(null);
      try {
        // Check auth status — in private mode, viewer cookie is required
        try {
          const status = await api.getAuthStatus();
          if (status.privateMode && !status.admin && !status.viewer) {
            setNeedsLogin(true);
            setLoading(false);
            return;
          }
          // Batch certificate printing requires admin access
          if (isBatch && !status.admin && !status.publicMode) {
            setAuthDenied(true);
            setLoading(false);
            return;
          }
        } catch {
          setAuthDenied(true);
          setLoading(false);
          return;
        }

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
          const savedId = localStorage.getItem(CURRENT_EVENT_KEY);
          if (savedId) {
            targetEventId = savedId;
          } else {
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
        }

        const [eventData, racerData, standingData, awardWinnerData] = await Promise.all([
          api.getEvent(targetEventId),
          api.getRacers(targetEventId),
          api.getStandings(targetEventId),
          api.getAwardWinners(targetEventId),
        ]);

        if (!eventData) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        setEvent(eventData);
        setRacers(racerData);
        setStandings(standingData);
        setAwardWinners(awardWinnerData);

        const histories = await Promise.all(racerData.map(r => api.getRacerHistory(r.id)));
        const statsMap = new Map<string, RacerStats>();
        const historyMap = new Map<string, RacerHistoryEntry[]>();
        racerData.forEach((r, i) => {
          statsMap.set(r.id, computeRacerStats(histories[i]!));
          historyMap.set(r.id, histories[i]!);
        });
        setRacerStats(statsMap);
        setRacerHistories(historyMap);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [singleRacerId]);

  if (needsLogin) {
    return <FullPageMessage color="text-slate-500">Authentication required. Please log in from the main page first.</FullPageMessage>;
  }

  if (authDenied) {
    return <FullPageMessage color="text-amber-600">Admin access required to print batch certificates.</FullPageMessage>;
  }

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

  const pageCount = printMode === 'cert-results' ? targetRacers.length * 2 : targetRacers.length;

  return (
    <div className="bg-stone-200 min-h-screen p-4 print:bg-white print:p-0">
      <div className="no-print text-center mb-4">
        {/* Print mode selector */}
        <div className="flex items-center justify-center gap-1 bg-stone-100 rounded-lg p-1 mb-3 max-w-md mx-auto">
          {([
            ['cert', 'Certificate'],
            ['cert-results', 'Cert + Results'],
            ['combined', 'Combined'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setPrintMode(mode)}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm font-body font-semibold rounded-md transition-colors cursor-pointer",
                printMode === mode
                  ? "bg-white text-primary shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          data-testid="btn-print"
          onClick={() => window.print()}
          className="bg-primary text-white py-3 px-8 text-base font-bold rounded-md cursor-pointer font-body"
        >
          Print {printMode === 'cert' ? 'Certificates' : printMode === 'cert-results' ? 'Certificates + Results' : 'Combined'}
        </button>
        <p className="text-stone-500 mt-1.5 text-sm font-body">
          {pageCount} page{pageCount !== 1 ? 's' : ''}
          {printMode === 'cert-results' && ` (${targetRacers.length} racer${targetRacers.length !== 1 ? 's' : ''} \u00d7 2)`}
          {' ready'}
        </p>
      </div>

      {targetRacers.map(racer => {
        const stats = racerStats.get(racer.id);
        const history = racerHistories.get(racer.id) ?? [];
        const tier = classifyRacer(standings, racers, racer.id);
        const racerAwards = awardWinners.filter(w => w.racer_id === racer.id);

        if (printMode === 'combined') {
          return (
            <CombinedCertificate
              key={racer.id}
              racer={racer}
              history={history}
              stats={stats}
              tier={tier}
              event={event}
              totalRacers={standings.length}
              organization={event.organization}
              awardWins={racerAwards}
            />
          );
        }

        return (
          <React.Fragment key={racer.id}>
            <Certificate
              racer={racer}
              stats={stats}
              tier={tier}
              event={event}
              totalRacers={standings.length}
              organization={event.organization}
              awardWins={racerAwards}
            />
            {printMode === 'cert-results' && (
              <ResultsCard
                racer={racer}
                history={history}
                stats={stats}
                tier={tier}
                event={event}
                totalRacers={standings.length}
                standings={standings}
              />
            )}
          </React.Fragment>
        );
      })}

      <style>{`
        .cert-scale-wrapper {
          width: 1045px;
          aspect-ratio: 1045 / 717;
          transform: scale(var(--cert-scale, 0.7));
          transform-origin: top center;
          margin-bottom: calc(717px * (var(--cert-scale, 0.7) - 1));
        }
        @media (min-width: 900px)  { .cert-scale-wrapper { --cert-scale: 0.8; } }
        @media (min-width: 1100px) { .cert-scale-wrapper { --cert-scale: 0.9; } }
        @media (min-width: 1300px) { .cert-scale-wrapper { --cert-scale: 1; } }
        @media print {
          html, body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .cert-scale-wrapper {
            width: 100% !important;
            height: 100% !important;
            aspect-ratio: auto !important;
            transform: none !important;
            margin-bottom: 0 !important;
          }
          .cert-card { background: white !important; border-radius: 0 !important; }
          .certificate-page {
            page-break-after: always;
            padding: 0 !important;
            margin: 0 !important;
            height: 100vh;
          }
          .certificate-page:last-child { page-break-after: auto; }
        }
        @page { size: landscape; margin: 0.4in; }
      `}</style>
    </div>
  );
}

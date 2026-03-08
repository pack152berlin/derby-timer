import { useEffect, useState, useRef } from 'react';

// ─── Car SVGs ─────────────────────────────────────────────────────────────────

function RioCar() {
  return (
    <svg width="96" height="38" viewBox="0 0 96 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="20" width="78" height="8" rx="2" fill="#7a1e00" />
      <rect x="6" y="17" width="74" height="4" rx="1" fill="#3d6b2a" />
      <rect x="34" y="9" width="2.5" height="9" fill="#5a3010" />
      <polygon points="35.25,2 29,17 41.5,17" fill="#2d6e1a" />
      <polygon points="35.25,5 30,16 40.5,16" fill="#3d8a24" />
      <polygon points="35.25,8 31,17 39.5,17" fill="#4fa030" />
      <rect x="58" y="12" width="2" height="6" fill="#5a3010" />
      <ellipse cx="59" cy="9" rx="6" ry="6" fill="#2d6e1a" />
      <ellipse cx="59" cy="8" rx="4" ry="4" fill="#4fa030" />
      <rect x="8" y="10" width="16" height="10" rx="2" fill="white" />
      <rect x="8" y="10" width="16" height="4" rx="1" fill="#cc2200" />
      <rect x="9" y="11" width="5" height="3" rx="0.5" fill="#bbddff" opacity="0.9" />
      <rect x="15" y="11" width="4" height="3" rx="0.5" fill="#bbddff" opacity="0.9" />
      <circle cx="20" cy="17" r="3.5" fill="white" stroke="#333" strokeWidth="0.7" />
      <text x="20" y="19.5" textAnchor="middle" fill="#111" fontSize="4.5" fontWeight="bold" fontFamily="Arial">16</text>
      <circle cx="20" cy="29" r="7" fill="#111" />
      <circle cx="20" cy="29" r="3" fill="#444" />
      <circle cx="68" cy="29" r="7" fill="#111" />
      <circle cx="68" cy="29" r="3" fill="#444" />
      <path d="M82 20 L92 24 L82 28 Z" fill="#7a1e00" />
    </svg>
  );
}

function UnicornCar() {
  return (
    <svg width="90" height="30" viewBox="0 0 90 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 8 24 L 82 24 L 82 22 L 20 11 Q 12 9 8 12 Q 6 16 6 20 Q 6 24 8 24 Z" fill="#7a1a99" />
      <path d="M 8 12 Q 12 9 20 11 L 80 22 L 72 21 L 18 12 Q 12 10 8 13 Z" fill="#ff1a6e" opacity="0.85" />
      <path d="M 10 18 L 72 22 L 60 22 L 14 19 Q 10 19 10 20 Z" fill="#3d1066" opacity="0.7" />
      <path d="M 26 20 Q 27 16 29 16 L 28 18 Q 30 15 32 17 Q 33 15 32 19 Q 31 21 27 20 Z" fill="#1a0033" opacity="0.85" />
      <path d="M 44 21 Q 45 17 47 17 L 46 19 Q 48 16 49 18 Q 51 17 50 20 Q 49 22 45 21 Z" fill="#1a0033" opacity="0.55" />
      <text x="14" y="21" fontSize="6" fill="#f5c518">★</text>
      <text x="36" y="20" fontSize="5" fill="#d4a000">★</text>
      <rect x="6" y="22" width="76" height="3" rx="1" fill="#4a0066" />
      <circle cx="22" cy="26" r="6" fill="#cc0077" />
      <circle cx="22" cy="26" r="3.8" fill="#ff44aa" />
      <circle cx="22" cy="26" r="1.5" fill="#eee" />
      <circle cx="64" cy="26" r="6" fill="#cc0077" />
      <circle cx="64" cy="26" r="3.8" fill="#ff44aa" />
      <circle cx="64" cy="26" r="1.5" fill="#eee" />
    </svg>
  );
}

function CruiseShipCar() {
  return (
    <svg width="96" height="36" viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="22" width="80" height="8" rx="2" fill="#111" />
      {[14, 24, 34, 44, 54, 64, 74].map((x, i) => (
        <circle key={i} cx={x} cy="26" r="1.5" fill="white" opacity="0.7" />
      ))}
      <rect x="8" y="14" width="72" height="10" rx="1" fill="#e8e8e8" />
      <rect x="8" y="14" width="72" height="3" rx="1" fill="#003F87" />
      {[12, 22, 32, 42, 52, 62, 72].map((x, i) => (
        <rect key={i} x={x} y="17" width="6" height="5" rx="0.5" fill="#bbddff" opacity="0.8" />
      ))}
      <rect x="28" y="6" width="8" height="10" rx="1" fill="#cc2200" />
      <rect x="30" y="4" width="4" height="4" rx="0.5" fill="#cc2200" />
      <rect x="29" y="5" width="6" height="2" fill="#111" opacity="0.4" />
      <rect x="50" y="8" width="7" height="8" rx="1" fill="#cc2200" />
      <rect x="52" y="6" width="3" height="4" rx="0.5" fill="#cc2200" />
      <rect x="51" y="7" width="5" height="2" fill="#111" opacity="0.4" />
      <rect x="14" y="10" width="60" height="5" rx="0.5" fill="#d0d0d0" />
      <path d="M80 22 L90 26 L80 30 Z" fill="#111" />
      <circle cx="20" cy="30" r="5" fill="#111" />
      <circle cx="20" cy="30" r="2.5" fill="#555" />
      <circle cx="68" cy="30" r="5" fill="#111" />
      <circle cx="68" cy="30" r="2.5" fill="#555" />
    </svg>
  );
}

function HotRod() {
  return (
    <svg width="92" height="32" viewBox="0 0 92 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 6 22 L 6 18 Q 8 10 16 8 Q 24 6 34 6 Q 42 6 48 8 Q 54 10 56 14 L 74 14 Q 78 14 80 18 L 80 22 Z" fill="#1155cc" />
      <path d="M 10 17 Q 12 10 18 9 Q 26 7 36 7 Q 44 7 50 9 Q 54 11 56 14 L 50 13 Q 46 10 36 9 Q 26 9 18 11 Q 12 13 10 18 Z" fill="#2277ff" opacity="0.5" />
      <path d="M 18 8 Q 24 6 34 6 Q 42 6 48 8 L 46 13 Q 40 11 32 11 Q 24 11 20 13 Z" fill="white" opacity="0.9" />
      <path d="M 20 8 Q 26 7 34 7 Q 40 7 45 9 L 43 12 Q 38 10 32 10 Q 25 10 21 12 Z" fill="#88aadd" opacity="0.7" />
      <ellipse cx="14" cy="13" rx="3.5" ry="3" fill="white" />
      <ellipse cx="14" cy="13" rx="2" ry="2" fill="#88aadd" />
      <ellipse cx="14" cy="12.5" rx="1" ry="1" fill="white" opacity="0.8" />
      <path d="M 38 22 L 46 14 L 52 14 L 42 22 Z" fill="#ffcc00" />
      <path d="M 42 22 L 50 14 L 54 15 L 46 22 Z" fill="#ff8800" opacity="0.7" />
      <text x="58" y="13" fontSize="6" fontWeight="bold" fill="#ffcc00" fontFamily="Arial, sans-serif">95</text>
      <rect x="74" y="8" width="8" height="2" rx="1" fill="#0033aa" />
      <rect x="79" y="8" width="2" height="7" rx="0.5" fill="#0033aa" />
      <rect x="6" y="20" width="74" height="3" rx="1" fill="#003399" />
      <path d="M 80 17 L 88 20 L 80 22 Z" fill="#1155cc" />
      <circle cx="20" cy="24" r="6.5" fill="#111" />
      <circle cx="20" cy="24" r="4" fill="#333" />
      <circle cx="20" cy="24" r="1.8" fill="#cc2200" />
      <circle cx="66" cy="24" r="6.5" fill="#111" />
      <circle cx="66" cy="24" r="4" fill="#333" />
      <circle cx="66" cy="24" r="1.8" fill="#cc2200" />
    </svg>
  );
}

const CAR_COMPONENTS = [RioCar, UnicornCar, CruiseShipCar, HotRod];

function CarSVG({ index }: { index: number }) {
  const Car = CAR_COMPONENTS[index];
  return <Car />;
}

// ─── Full-Page Loader ─────────────────────────────────────────────────────────

type Phase = 'idle' | 'racing' | 'restarting';

const CAR_CONFIG = [
  { delay: 0,   speed: 0.72, lane: 0 },
  { delay: 120, speed: 0.68, lane: 1 },
  { delay: 60,  speed: 0.75, lane: 2 },
  { delay: 200, speed: 0.65, lane: 3 },
];

const TRAIL_COLORS = ['#8B2500', '#6b2d8b', '#cc2200', '#111111'];

export function PinewoodFullLoader({ visible = true }: { visible?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [carOffsets, setCarOffsets] = useState([0, 0, 0, 0]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Fade in on visible, reset on hide
  useEffect(() => {
    if (!visible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPhase('idle');
      setCarOffsets([0, 0, 0, 0]);
      return;
    }
    const t = setTimeout(() => setPhase('racing'), 200);
    return () => clearTimeout(t);
  }, [visible]);

  // Loop: restart after a brief pause when all cars finish
  useEffect(() => {
    if (phase !== 'restarting') return;
    const t = setTimeout(() => {
      setCarOffsets([0, 0, 0, 0]);
      startTimeRef.current = performance.now();
      setPhase('racing');
    }, 300);
    return () => clearTimeout(t);
  }, [phase]);

  // Animation RAF loop
  useEffect(() => {
    if (phase !== 'racing') return;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current!;
      const newOffsets = CAR_CONFIG.map(({ delay, speed }) => {
        const t = Math.max(0, elapsed - delay);
        const progress = Math.min(t * speed * 0.001, 1);
        const eased = progress < 0.3
          ? (progress / 0.3) ** 2 * 0.3
          : 0.3 + (progress - 0.3);
        return Math.min(eased, 1.05);
      });
      setCarOffsets(newOffsets);
      if (newOffsets.every(o => o >= 1.0)) {
        setPhase('restarting');
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase]);

  if (!visible && phase === 'idle') return null;

  const trackWidth = 480;
  const startX = -90;
  const endX = trackWidth + 20;
  const isVisible = visible && phase !== 'idle';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'transparent',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.4s ease',
      fontFamily: 'system-ui, sans-serif',
      pointerEvents: isVisible ? 'all' : 'none',
    }}>

      {/* Glow + cars */}
      <div style={{ position: 'relative', width: `${trackWidth}px`, height: '240px' }}>

        {/* Soft radial glow */}
        <div style={{
          position: 'absolute',
          left: '-160px', right: '-160px',
          top: '-120px', bottom: '-120px',
          background: 'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) 55%, rgba(255,255,255,0.858) 61.2%, rgba(255,255,255,0.69) 67.3%, rgba(255,255,255,0.46) 73.5%, rgba(255,255,255,0.23) 79.7%, rgba(255,255,255,0.062) 85.8%, rgba(255,255,255,0) 92%)',
          pointerEvents: 'none',
        }} />

        {/* Cars — masked so they dissolve into the glow at the edges */}
        <div style={{
          position: 'absolute', inset: 0,
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
        }}>
          {CAR_CONFIG.map(({ lane }, i) => {
            const offset = carOffsets[i];
            const xPos = startX + offset * (endX - startX);
            const yPos = lane * 56 + 22;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${xPos}px`, top: `${yPos}px`,
                transform: 'translateY(-50%)',
                transition: 'none', willChange: 'left',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))',
              }}>
                {offset > 0.12 && offset < 0.9 && (
                  <div style={{
                    position: 'absolute', right: '62px', top: '10px',
                    width: `${Math.min(offset * 48, 36)}px`, height: '2px',
                    background: `linear-gradient(to left, ${TRAIL_COLORS[i]}50, transparent)`,
                    borderRadius: '2px',
                  }} />
                )}
                <CarSVG index={i} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        color: '#6b7280', fontSize: '14px',
        letterSpacing: '0.3em', textTransform: 'uppercase',
        marginTop: '4px',
      }}>
        Loading
      </div>

    </div>
  );
}

// ─── Inline Loader ────────────────────────────────────────────────────────────

export function PinewoodInlineLoader({
  size = 'md',
  label = 'Loading...',
}: {
  size?: 'sm' | 'md';
  label?: string;
}) {
  const trackW = size === 'sm' ? 120 : 200;
  const carScale = size === 'sm' ? 0.5 : 0.7;
  const carH = Math.round(28 * carScale);
  const containerH = carH + 32;
  const animName = `pdCarLoop${size}`;

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column',
      alignItems: 'center', gap: '4px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ position: 'relative', width: `${trackW}px`, height: `${containerH}px` }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          left: '-80px', right: '-80px',
          top: '-50px', bottom: '-50px',
          background: 'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) 55%, rgba(255,255,255,0.858) 61.2%, rgba(255,255,255,0.69) 67.3%, rgba(255,255,255,0.46) 73.5%, rgba(255,255,255,0.23) 79.7%, rgba(255,255,255,0.062) 85.8%, rgba(255,255,255,0) 92%)',
          pointerEvents: 'none',
        }} />

        {/* Cars masked at edges */}
        <div style={{
          position: 'absolute', inset: 0,
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute', top: '50%',
              transform: `translateY(-50%) scale(${carScale})`,
              transformOrigin: 'left center',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
              animation: `${animName} 2.88s linear ${-(i * 0.72)}s infinite`,
            }}>
              <CarSVG index={i} />
            </div>
          ))}
        </div>
      </div>

      {label && (
        <span style={{
          fontSize: '14px',
          color: '#9ca3af', letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
      )}

      <style>{`
        @keyframes ${animName} {
          0%   { left: -100px; }
          100% { left: ${trackW + 100}px; }
        }
      `}</style>
    </div>
  );
}

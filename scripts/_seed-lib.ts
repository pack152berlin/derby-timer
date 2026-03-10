/**
 * Shared helpers for dev seed scripts.
 */
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { CUB_SCOUT_DENS } from '../src/frontend/constants';

// ── Randomness ────────────────────────────────────────────────────────────────

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ── Random event names ────────────────────────────────────────────────────────

const PACK_NUMBERS = [1, 4, 7, 12, 15, 23, 31, 42, 55, 88, 99, 100, 114, 128, 152, 200, 314, 409, 512];
const MODIFIERS = ['Spring', 'Fall', 'Annual', 'Blue & Gold', 'Championship', 'Pinewood', 'Winter Classic', 'District'];

export function randomEventName(): string {
  const pack = pick(PACK_NUMBERS);
  const mod  = pick(MODIFIERS);
  return `Pack ${pack} ${mod} Derby`;
}

/** Random date in the past 12 months, returned as YYYY-MM-DD. */
export function randomPastDate(): string {
  const now = Date.now();
  const ago = now - randInt(7, 365) * 24 * 60 * 60 * 1000;
  return new Date(ago).toISOString().slice(0, 10);
}

// ── Racer name generation ─────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Jack', 'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'Flora', 'Lucas',
  'Mason', 'Logan', 'Ethan', 'Jackson', 'Sebastian', 'Mateo', 'Henry',
  'Alexander', 'Michael', 'Daniel', 'Rio', 'Samuel', 'Wyatt', 'Luke',
  'Gabriel', 'Dylan', 'Isaac', 'Nathan', 'Carter', 'Caleb', 'Joshua',
  'Connor', 'Eli', 'Lincoln', 'Christian', 'Cameron', 'Ryan', 'Evan',
  'Hunter', 'Klara', 'Jaxon', 'Adrian', 'Miles', 'Theo', 'Cole', 'Finn',
  'Leo', 'Axel', 'Bennett', 'Cooper', 'Declan', 'Griffin',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis',
  'Garcia', 'Wilson', 'Martinez', 'Kny-Flores', 'Taylor', 'Thomas', 'Moore',
  'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Bowers', 'Adams', 'Nelson', 'Baker', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Phillips', 'Evans', 'Turner', 'Parker',
];

export function randomRacerName(usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Fallback with suffix
  const base = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const name = `${base} Jr.`;
  usedNames.add(name);
  return name;
}

export function randomDen(): string {
  return pick([...CUB_SCOUT_DENS]);
}

// ── PNG photo generation ──────────────────────────────────────────────────────

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}
const CRC_TABLE = buildCrcTable();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff]!) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcBuf = new Uint8Array(4 + data.length);
  crcBuf.set(typeBytes, 0);
  crcBuf.set(data, 4);
  dv.setUint32(4 + 4 + data.length, crc32(crcBuf));
  return chunk;
}

/** Generate a solid-color 64×64 PNG as a Uint8Array. */
export function solidColorPng(r: number, g: number, b: number): Uint8Array<ArrayBuffer> {
  const size = 64;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = new Uint8Array(13);
  const ihdrDv = new DataView(ihdrData.buffer);
  ihdrDv.setUint32(0, size);
  ihdrDv.setUint32(4, size);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type = RGB
  const ihdr = pngChunk('IHDR', ihdrData);

  // Raw image data: each row = 1 filter byte + 64*3 color bytes
  const rowSize = 1 + size * 3;
  const raw = new Uint8Array(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 2 + x * 3] = g;
      raw[y * rowSize + 3 + x * 3] = b;
    }
  }

  // deflateSync returns Buffer (ArrayBufferLike); convert to plain Uint8Array<ArrayBuffer>
  const compressed = new Uint8Array(deflateSync(raw));
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', new Uint8Array(0));

  const total = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length);
  let off = 0;
  for (const part of [sig, ihdr, idat, iend]) {
    total.set(part, off);
    off += part.length;
  }
  return total;
}

// A palette of distinct, vibrant car colors for overlays
const CAR_COLORS: [number, number, number][] = [
  [0,   102, 204], // Electric blue
  [255, 0,   102], // Hot pink
  [255, 204, 0  ], // Bright gold
  [51,  204, 51 ], // Lime green
  [153, 51,  255], // Purple
  [255, 102, 0  ], // Bright orange
  [0,   204, 204], // Cyan
  [204, 0,   0  ], // Red
  [255, 153, 204], // Light pink
  [102, 255, 178], // Mint
  [255, 255, 102], // Canary yellow
  [178, 102, 255], // Lavender
];

export function carColorPng(index: number): Uint8Array<ArrayBuffer> {
  const [r, g, b] = CAR_COLORS[index % CAR_COLORS.length]!;
  return solidColorPng(r, g, b);
}

/** 
 * Returns a tinted version of one of the real car photos from tests/assets.
 * Falls back to solidColorPng if assets are missing.
 */
export async function realCarPhoto(index: number): Promise<{ data: Uint8Array, mime: string }> {
  const assetDir = join(process.cwd(), 'tests/assets');
  const sourceFile = `car${(index % 3) + 1}.jpg`;
  const sourcePath = join(assetDir, sourceFile);

  if (!existsSync(sourcePath)) {
    return { data: new Uint8Array(carColorPng(index)), mime: 'image/png' };
  }

  // 20% chance of being original (no transformation)
  if (Math.random() < 0.2) {
    return { data: new Uint8Array(readFileSync(sourcePath)), mime: 'image/jpeg' };
  }

  const [r, g, b] = CAR_COLORS[index % CAR_COLORS.length]!;
  const color = `rgb(${r},${g},${b})`;
  const tmpFile = `/tmp/derby-seed-photo-${index}-${crypto.randomUUID()}.jpg`;

  try {
    // -colorize 15% acts like a 15% opacity colored overlay
    const proc = Bun.spawn([
      'magick', sourcePath,
      '-fill', color,
      '-colorize', '35',
      tmpFile
    ]);
    await proc.exited;

    const data = new Uint8Array(readFileSync(tmpFile));
    return { data, mime: 'image/jpeg' };
  } catch (e) {
    console.error('Failed to tint image, using original:', e);
    return { data: new Uint8Array(readFileSync(sourcePath)), mime: 'image/jpeg' };
  } finally {
    if (existsSync(tmpFile)) {
      try { Bun.spawn(['rm', tmpFile]); } catch {}
    }
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export async function fetchJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text.length > 0 ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(data)}`);
  return data as T;
}

export async function waitForServer(baseUrl: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/api/events`);
      if (r.ok) return;
      last = new Error(`status ${r.status}`);
    } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Server not ready: ${String(last)}`);
}

export function startServer(dbPath: string, port: number): Bun.Subprocess {
  return Bun.spawn(['bun', 'run', 'src/index.ts'], {
    cwd: process.cwd(),
    stdout: 'ignore',
    stderr: 'ignore',
    env: { ...Bun.env, PORT: String(port), DERBY_DB_PATH: dbPath },
  });
}

export async function stopServer(server: Bun.Subprocess): Promise<void> {
  server.kill();
  const done = await Promise.race([
    server.exited.then(() => true),
    new Promise(r => setTimeout(r, 3000)).then(() => false),
  ]);
  if (!done) { server.kill('SIGKILL'); await server.exited; }
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags  = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    const trimmed = arg.slice(2);
    const eq = trimmed.indexOf('=');
    if (eq >= 0) {
      values.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { values.set(trimmed, next); i++; continue; }
    flags.add(trimmed);
  }
  return { values, flags };
}

export function getInt(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${label}: ${raw}`);
  return n;
}

// ── Shared Race Logic ─────────────────────────────────────────────────────────

export interface HeatLane    { lane_number: number; racer_id: string }
export interface HeatRecord  { id: string; status: string; round: number; heat_number: number; lanes: HeatLane[] }

export interface RaceContext {
  racerBaseTimes: Map<string, number>; // racer_id -> base_time_ms
  laneHandicaps: number[];             // index = lane_number - 1
}

/** Creates a consistent physical context for the whole race. */
export function generateRaceContext(racerIds: string[], laneCount: number): RaceContext {
  const racerBaseTimes = new Map<string, number>();
  for (const id of racerIds) {
    // 4s +/- 1.5s -> [2500, 5500]
    racerBaseTimes.set(id, randInt(2500, 5500));
  }

  const laneHandicaps = Array.from({ length: laneCount }, () => randInt(0, 100));
  return { racerBaseTimes, laneHandicaps };
}

/** Determines finish times and places based on racer skill and lane handicap. */
export function buildResults(heat: HeatRecord, context: RaceContext) {
  const results = heat.lanes.map(lane => {
    const base = context.racerBaseTimes.get(lane.racer_id) || 4000;
    const handicap = context.laneHandicaps[lane.lane_number - 1] || 0;
    const jitter = randInt(0, 300);
    const time_ms = base + handicap + jitter;
    return {
      lane_number: lane.lane_number,
      racer_id:    lane.racer_id,
      time_ms,
    };
  });

  // Sort by time to determine place
  const sorted = [...results].sort((a, b) => a.time_ms - b.time_ms);
  return results.map(r => ({
    ...r,
    place: sorted.findIndex(s => s.racer_id === r.racer_id) + 1,
  }));
}

/** Starts a heat and records results. */
export async function runHeat(baseUrl: string, heat: HeatRecord, context: RaceContext): Promise<void> {
  if (heat.status === 'pending') {
    await fetchJson(baseUrl, `/api/heats/${heat.id}/start`, { method: 'POST' });
  }
  await fetchJson(baseUrl, `/api/heats/${heat.id}/results`, {
    method: 'POST',
    body: JSON.stringify({ results: buildResults(heat, context) }),
  });
}

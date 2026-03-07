/**
 * seed-mid-race — Populate the database with a mid-race event.
 *
 * Usage:
 *   bun run seed:mid-race [options]
 *
 * Options:
 *   --lanes N       Number of lanes (default: 4)
 *   --rounds N      Total rounds to generate (default: 3)
 *   --times         Include race times in completed heats
 *   --db PATH       Database path (default: derby.db)
 *   --port N        Temp server port (default: 3101)
 *
 * Creates one event with 40 racers (most with car photos, a few without).
 * Completes the first 2 rounds and leaves the rest pending.
 * Event name and date are randomised so the script can be run multiple times.
 */

import {
  randInt, shuffle,
  randomEventName, randomPastDate, randomRacerName, randomDen,
  realCarPhoto,
  fetchJson, waitForServer, startServer, stopServer,
  parseArgs, getInt,
} from './_seed-lib';

interface RacerRecord { id: string; car_number: string }
interface HeatLane    { lane_number: number; racer_id: string }
interface HeatRecord  { id: string; status: string; round: number; heat_number: number; lanes: HeatLane[] }

const RACER_COUNT = 40;
const PHOTO_RATE  = 0.8;
const ROUNDS_TO_COMPLETE = 2;

// ── Time generation ───────────────────────────────────────────────────────────

function buildTimes(count: number): number[] {
  const base = randInt(2800, 4200);
  const times: number[] = [base];
  for (let i = 1; i < count; i++) times.push(times[i - 1]! + randInt(30, 180));
  return shuffle(times); // random per-lane times; place is determined separately
}

// ── Heat runner ───────────────────────────────────────────────────────────────

function buildResults(heat: HeatRecord, withTimes: boolean) {
  const lanes    = [...heat.lanes].sort((a, b) => a.lane_number - b.lane_number);
  const shuffled = shuffle(lanes); // random finish order
  const times    = withTimes ? buildTimes(lanes.length) : [];
  return shuffled.map((lane, idx) => ({
    lane_number: lane.lane_number,
    racer_id:    lane.racer_id,
    place:       idx + 1,
    ...(withTimes ? { time_ms: times[idx] } : {}),
  }));
}

async function runHeat(baseUrl: string, heat: HeatRecord, withTimes: boolean): Promise<void> {
  if (heat.status === 'pending') {
    await fetchJson(baseUrl, `/api/heats/${heat.id}/start`, { method: 'POST' });
  }
  await fetchJson(baseUrl, `/api/heats/${heat.id}/results`, {
    method: 'POST',
    body: JSON.stringify({ results: buildResults(heat, withTimes) }),
  });
}

/**
 * Run all heats in rounds 1..maxRound, fetching fresh state each iteration
 * to work with the server's incremental heat queue.
 */
async function runRounds(
  baseUrl: string,
  eventId: string,
  maxRound: number,
  withTimes: boolean,
): Promise<number> {
  let completed = 0;
  process.stdout.write('Running heats: ');
  for (let guard = 0; guard < 5000; guard++) {
    const heats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/heats`);
    const next = heats.find(
      h => h.round <= maxRound && (h.status === 'running' || h.status === 'pending'),
    );
    if (!next) break;
    await runHeat(baseUrl, next, withTimes);
    completed++;
    if (completed % 10 === 0) process.stdout.write(`${completed}`);
    else process.stdout.write('.');
  }
  process.stdout.write('\n');
  return completed;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values, flags } = parseArgs(Bun.argv.slice(2));
  const lanes     = getInt(values.get('lanes'),  4,    'lanes');
  const rounds    = getInt(values.get('rounds'), 3,    'rounds');
  const port      = getInt(values.get('port'),   3101, 'port');
  const dbPath    = values.get('db') ?? 'derby.db';
  const withTimes = flags.has('times');

  const baseUrl = `http://localhost:${port}`;
  console.log(`seed-mid-race  db=${dbPath}  lanes=${lanes}  rounds=${rounds}  times=${withTimes}`);

  const server = startServer(dbPath, port);
  try {
    await waitForServer(baseUrl);

    // ── Event ─────────────────────────────────────────────────────────────────
    const eventName = randomEventName();
    const eventDate = randomPastDate();
    const event = await fetchJson<{ id: string }>(baseUrl, '/api/events', {
      method: 'POST',
      body: JSON.stringify({ name: eventName, date: eventDate, lane_count: lanes }),
    });
    console.log(`Created event: "${eventName}"  (${eventDate})`);

    // ── Racers ────────────────────────────────────────────────────────────────
    const usedNames = new Set<string>();
    const racers: RacerRecord[] = [];
    for (let i = 0; i < RACER_COUNT; i++) {
      const r = await fetchJson<RacerRecord>(baseUrl, `/api/events/${event.id}/racers`, {
        method: 'POST',
        body: JSON.stringify({ name: randomRacerName(usedNames), den: randomDen() }),
      });
      racers.push(r);
    }
    console.log(`Created ${RACER_COUNT} racers`);

    // ── Inspection ────────────────────────────────────────────────────────────
    for (const r of racers) {
      await fetchJson(baseUrl, `/api/racers/${r.id}/inspect`, {
        method: 'POST',
        body: JSON.stringify({ weight_ok: true }),
      });
    }
    console.log('All racers inspected');

    // ── Photos ────────────────────────────────────────────────────────────────
    let photoCount = 0;
    for (let i = 0; i < racers.length; i++) {
      if (Math.random() > PHOTO_RATE) continue;
      const { data, mime } = await realCarPhoto(i);
      const form = new FormData();
      form.append('photo', new Blob([data], { type: mime }), `car${i}.jpg`);
      await fetch(`${baseUrl}/api/racers/${racers[i]!.id}/photo`, { method: 'POST', body: form });
      photoCount++;
    }
    console.log(`Uploaded photos for ${photoCount}/${RACER_COUNT} racers`);

    // ── Generate heats (sets up the incremental queue) ────────────────────────
    await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      body: JSON.stringify({ rounds, lane_count: lanes }),
    });
    console.log(`Generating ${rounds} rounds of heats (incremental queue)`);

    // ── Complete first 2 rounds ───────────────────────────────────────────────
    const completedCount = await runRounds(baseUrl, event.id, ROUNDS_TO_COMPLETE, withTimes);

    const allHeats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${event.id}/heats`);
    const pending  = allHeats.filter(h => h.status === 'pending').length;
    console.log(`Completed ${completedCount} heats (rounds 1–${ROUNDS_TO_COMPLETE}), ${pending} heats pending`);

    console.log(`\nDone! Open http://localhost:3000 and select "${eventName}"`);
  } finally {
    await stopServer(server);
  }
}

await main();

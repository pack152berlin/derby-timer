/**
 * seed-complete — Populate the database with a fully-completed race event.
 *
 * Usage:
 *   bun run seed:complete [options]
 *
 * Options:
 *   --lanes N       Number of lanes (default: 4)
 *   --rounds N      Total rounds (default: 3)
 *   --cars N        Number of racers (default: 40)
 *   --times         Include race times in results
 *   --db PATH       Database path (default: derby.db)
 *   --port N        Temp server port (default: 3102)
 *
 * Creates one event with specified racers (most with car photos, a few without).
 * All rounds are completed so the event reaches "complete" status.
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
interface EventRecord { id: string; status: string }

const PHOTO_RATE  = 0.8;

// ── Time generation ───────────────────────────────────────────────────────────

function buildTimes(count: number): number[] {
  const base = randInt(2800, 4200);
  const times: number[] = [base];
  for (let i = 1; i < count; i++) times.push(times[i - 1]! + randInt(30, 180));
  return shuffle(times);
}

// ── Heat runner ───────────────────────────────────────────────────────────────

function buildResults(heat: HeatRecord, withTimes: boolean) {
  const lanes    = [...heat.lanes].sort((a, b) => a.lane_number - b.lane_number);
  const shuffled = shuffle(lanes);
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

/** Run all heats until none remain pending/running. */
async function runAllHeats(baseUrl: string, eventId: string, withTimes: boolean): Promise<number> {
  let completed = 0;
  let currentRound = 0;
  for (let guard = 0; guard < 10000; guard++) {
    const heats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/heats`);
    const next = heats.find(h => h.status === 'running' || h.status === 'pending');
    if (!next) break;
    if (next.round !== currentRound) {
      currentRound = next.round;
      process.stdout.write(`\nROUND-${currentRound}: `);
    }
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
  const lanes      = getInt(values.get('lanes'),  4,    'lanes');
  const rounds     = getInt(values.get('rounds'), 3,    'rounds');
  const racerCount = getInt(values.get('cars') || values.get('racers'), 40, 'cars');
  const port       = getInt(values.get('port'),   3102, 'port');
  const dbPath     = values.get('db') ?? 'derby.db';
  const withTimes  = flags.has('times');

  const baseUrl = `http://localhost:${port}`;
  console.log(`seed-complete  db=${dbPath}  lanes=${lanes}  rounds=${rounds}  cars=${racerCount}  times=${withTimes}`);

  const server = startServer(dbPath, port);
  try {
    await waitForServer(baseUrl);

    // ── Event ─────────────────────────────────────────────────────────────────
    const eventName = randomEventName();
    const eventDate = randomPastDate();
    const event = await fetchJson<EventRecord>(baseUrl, '/api/events', {
      method: 'POST',
      body: JSON.stringify({ name: eventName, date: eventDate, lane_count: lanes }),
    });
    console.log(`Created event: "${eventName}"  (${eventDate})`);

    // ── Racers ────────────────────────────────────────────────────────────────
    const usedNames = new Set<string>();
    const racers: RacerRecord[] = [];
    for (let i = 0; i < racerCount; i++) {
      const r = await fetchJson<RacerRecord>(baseUrl, `/api/events/${event.id}/racers`, {
        method: 'POST',
        body: JSON.stringify({ name: randomRacerName(usedNames), den: randomDen() }),
      });
      racers.push(r);
    }
    console.log(`Created ${racerCount} racers`);

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
    console.log(`Uploaded photos for ${photoCount}/${racerCount} racers`);

    // ── Generate heats ────────────────────────────────────────────────────────
    await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      body: JSON.stringify({ rounds, lane_count: lanes }),
    });
    console.log(`Generating ${rounds} rounds of heats (incremental queue)`);

    // ── Run all heats ─────────────────────────────────────────────────────────
    const completedCount = await runAllHeats(baseUrl, event.id, withTimes);

    const finalEvent = await fetchJson<EventRecord>(baseUrl, `/api/events/${event.id}`);
    console.log(`Completed ${completedCount} heats — event status: ${finalEvent.status}`);

    console.log(`\nDone! Open http://localhost:3000 and select "${eventName}"`);
  } finally {
    await stopServer(server);
  }
}

await main();

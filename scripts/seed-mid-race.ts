/**
 * seed-mid-race — Populate the database with a mid-race event.
 *
 * Usage:
 *   bun run seed:mid-race [options]
 *
 * Options:
 *   --lanes N       Number of lanes (default: 4)
 *   --rounds N      Total rounds to generate (default: 3)
 *   --cars N        Number of racers (default: 40)
 *   --times         Include race times in completed heats
 *   --db PATH       Database path (default: derby.db)
 *   --port N        Temp server port (default: 3101)
 *
 * Creates one event with specified racers (most with car photos, a few without).
 * Completes the first 2 rounds and leaves the rest pending.
 * Event name and date are randomised so the script can be run multiple times.
 */

import {
  randInt, shuffle,
  randomEventName, randomPastDate, randomRacerName, randomDen,
  realCarPhoto,
  fetchJson, waitForServer, startServer, stopServer,
  parseArgs, getInt,
  generateRaceContext, runHeat,
} from './_seed-lib';
import type { HeatRecord, RaceContext } from './_seed-lib';

interface RacerRecord { id: string; car_number: string }

const PHOTO_RATE  = 0.8;
const ROUNDS_TO_COMPLETE = 2;

// ── Heat runner loop ──────────────────────────────────────────────────────────

/**
 * Run all heats in rounds 1..maxRound, fetching fresh state each iteration
 * to work with the server's incremental heat queue.
 */
async function runRounds(
  baseUrl: string,
  eventId: string,
  maxRound: number,
  context: RaceContext,
): Promise<number> {
  let completed = 0;
  process.stdout.write('Running heats: ');
  for (let guard = 0; guard < 5000; guard++) {
    const heats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${eventId}/heats`);
    const next = heats.find(
      h => h.round <= maxRound && (h.status === 'running' || h.status === 'pending'),
    );
    if (!next) break;
    await runHeat(baseUrl, next, context);
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
  const port       = getInt(values.get('port'),   3101, 'port');
  const dbPath     = values.get('db') ?? 'derby.db';
  const withTimes  = true; // Realistic timings always include times now

  const baseUrl = `http://localhost:${port}`;
  console.log(`seed-mid-race  db=${dbPath}  lanes=${lanes}  rounds=${rounds}  cars=${racerCount} (realistic timing)`);

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
    for (let i = 0; i < racerCount; i++) {
      const r = await fetchJson<RacerRecord>(baseUrl, `/api/events/${event.id}/racers`, {
        method: 'POST',
        body: JSON.stringify({ name: randomRacerName(usedNames), den: randomDen() }),
      });
      racers.push(r);
    }
    console.log(`Created ${racerCount} racers`);

    const context = generateRaceContext(racers.map(r => r.id), lanes);

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
      form.append('photo', new Blob([data as BlobPart], { type: mime }), `car${i}.jpg`);
      await fetch(`${baseUrl}/api/racers/${racers[i]!.id}/photo`, { method: 'POST', body: form });
      photoCount++;
    }
    console.log(`Uploaded photos for ${photoCount}/${racerCount} racers`);

    // ── Generate heats (sets up the incremental queue) ────────────────────────
    await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      body: JSON.stringify({ rounds, lane_count: lanes }),
    });
    console.log(`Generating ${rounds} rounds of heats (incremental queue)`);

    // ── Complete first 2 rounds ───────────────────────────────────────────────
    const completedCount = await runRounds(baseUrl, event.id, ROUNDS_TO_COMPLETE, context);

    const allHeats = await fetchJson<HeatRecord[]>(baseUrl, `/api/events/${event.id}/heats`);
    const pending  = allHeats.filter(h => h.status === 'pending').length;
    console.log(`Completed ${completedCount} heats (rounds 1–${ROUNDS_TO_COMPLETE}), ${pending} heats pending`);

    console.log(`\nDone! Open http://localhost:3000 and select "${eventName}"`);
  } finally {
    await stopServer(server);
  }
}

await main();

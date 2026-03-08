import { describe, expect, it } from "bun:test";
import { fetchJson, waitForServer, startServer, stopServer } from "../scripts/_seed-lib";

interface RacerRecord { id: string }
interface HeatRecord  { id: string; status: string; lanes: { lane_number: number; racer_id: string }[] }
interface EventRecord { id: string; status: string }
interface ActiveHeatResponse { heatId: string | null; running: boolean; elapsedMs: number }

const PORT = 3097;
const DB_PATH = `/tmp/server-restart-test-${Date.now()}.db`;
const BASE_URL = `http://localhost:${PORT}`;

async function setupRaceWithRunningHeat() {
  const event = await fetchJson<EventRecord>(BASE_URL, "/api/events", {
    method: "POST",
    body: JSON.stringify({ name: "Restart Test Event", date: "2026-03-01", lane_count: 2 }),
  });

  const racers: RacerRecord[] = [];
  for (let i = 1; i <= 4; i++) {
    const r = await fetchJson<RacerRecord>(BASE_URL, `/api/events/${event.id}/racers`, {
      method: "POST",
      body: JSON.stringify({ name: `Racer ${i}`, den: null }),
    });
    racers.push(r);
  }

  for (const r of racers) {
    await fetchJson(BASE_URL, `/api/racers/${r.id}/inspect`, {
      method: "POST",
      body: JSON.stringify({ weight_ok: true }),
    });
  }

  await fetchJson(BASE_URL, `/api/events/${event.id}/generate-heats`, {
    method: "POST",
    body: JSON.stringify({ rounds: 1, lane_count: 2 }),
  });

  // Start the first heat but do NOT submit results — leave it running
  const heats = await fetchJson<HeatRecord[]>(BASE_URL, `/api/events/${event.id}/heats`);
  const firstHeat = heats.find(h => h.status === "pending" || h.status === "running")!;
  if (firstHeat.status === "pending") {
    await fetchJson(BASE_URL, `/api/heats/${firstHeat.id}/start`, { method: "POST" });
  }

  return { event, heatId: firstHeat.id };
}

describe("Server restart recovery", () => {
  it("running heat survives server restart", async () => {
    let server = startServer(DB_PATH, PORT);
    try {
      await waitForServer(BASE_URL);

      const { heatId } = await setupRaceWithRunningHeat();

      // Confirm heat is running before restart
      const activeBefore = await fetchJson<ActiveHeatResponse>(BASE_URL, "/api/race/active");
      expect(activeBefore.running).toBe(true);
      expect(activeBefore.heatId).toBe(heatId);

      // Restart the server
      await stopServer(server);
      server = startServer(DB_PATH, PORT);
      await waitForServer(BASE_URL);

      // Running heat should still be active after restart
      const activeAfter = await fetchJson<ActiveHeatResponse>(BASE_URL, "/api/race/active");
      expect(activeAfter.running).toBe(true);
      expect(activeAfter.heatId).toBe(heatId);
    } finally {
      await stopServer(server);
      await Bun.$`rm -f ${DB_PATH}`;
    }
  }, 30000);

  it("completed heats remain complete after restart", async () => {
    const dbPath = `/tmp/server-restart-test-complete-${Date.now()}.db`;
    let server = startServer(dbPath, PORT + 1);
    const url = `http://localhost:${PORT + 1}`;
    try {
      await waitForServer(url);

      // Create event and run one heat to completion
      const event = await fetchJson<EventRecord>(url, "/api/events", {
        method: "POST",
        body: JSON.stringify({ name: "Restart Complete Test", date: "2026-03-01", lane_count: 2 }),
      });
      const racers: RacerRecord[] = [];
      for (let i = 1; i <= 2; i++) {
        const r = await fetchJson<RacerRecord>(url, `/api/events/${event.id}/racers`, {
          method: "POST",
          body: JSON.stringify({ name: `Racer ${i}` }),
        });
        racers.push(r);
        await fetchJson(url, `/api/racers/${r.id}/inspect`, {
          method: "POST",
          body: JSON.stringify({ weight_ok: true }),
        });
      }
      await fetchJson(url, `/api/events/${event.id}/generate-heats`, {
        method: "POST",
        body: JSON.stringify({ rounds: 1, lane_count: 2 }),
      });
      const heats = await fetchJson<HeatRecord[]>(url, `/api/events/${event.id}/heats`);
      const heat = heats[0]!;
      await fetchJson(url, `/api/heats/${heat.id}/start`, { method: "POST" });
      await fetchJson(url, `/api/heats/${heat.id}/results`, {
        method: "POST",
        body: JSON.stringify({
          results: heat.lanes.map((l, i) => ({ lane_number: l.lane_number, racer_id: l.racer_id, place: i + 1 })),
        }),
      });

      // Restart
      await stopServer(server);
      server = startServer(dbPath, PORT + 1);
      await waitForServer(url);

      const heatsAfter = await fetchJson<HeatRecord[]>(url, `/api/events/${event.id}/heats`);
      const completedHeat = heatsAfter.find(h => h.id === heat.id);
      expect(completedHeat?.status).toBe("complete");
    } finally {
      await stopServer(server);
      await Bun.$`rm -f ${dbPath}`;
    }
  }, 30000);
});

import { describe, expect, it } from "bun:test";
import { CUB_SCOUT_DENS } from "../src/frontend/constants";

/**
 * Integration tests for the standings den filter.
 *
 * The den filter in StandingsView joins the `standings` API response with the
 * `racers` API response via racer_id, then compares `racer.den` against the
 * selected CUB_SCOUT_DENS value.
 *
 * For the filter to work, racers stored in the DB must use the SAME string
 * values as CUB_SCOUT_DENS. If dens are stored differently (e.g. "Wolf" vs
 * "Wolves"), the filter silently returns zero results.
 */

describe("Standings den filter — end-to-end", () => {
  const port = Bun.env.PORT ?? "3099";
  const baseUrl = `http://localhost:${port}`;

  it("den filter returns results when racers have a matching den", async () => {
    // 1. Create a fresh event
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Den Filter Test", date: "2026-03-07", lane_count: 2 }),
    });
    expect(eventRes.status).toBe(201);
    const event = await eventRes.json();
    const eventId = event.id;

    // 2. Create two racers — one Lions, one Tigers
    const r1Res = await fetch(`${baseUrl}/api/events/${eventId}/racers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice Lion", den: "Lions" }),
    });
    const r1 = await r1Res.json();

    const r2Res = await fetch(`${baseUrl}/api/events/${eventId}/racers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob Tiger", den: "Tigers" }),
    });
    const r2 = await r2Res.json();

    // 3. Inspect both racers (required for heat generation)
    await fetch(`${baseUrl}/api/racers/${r1.id}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_ok: true }),
    });
    await fetch(`${baseUrl}/api/racers/${r2.id}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_ok: true }),
    });

    // 4. Generate heats
    const genRes = await fetch(`${baseUrl}/api/events/${eventId}/generate-heats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds: 1, lookahead: 2 }),
    });
    const heats = await genRes.json();
    expect(heats.length).toBeGreaterThan(0);
    const heat = heats[0];

    // 5. Start and record results so standings get populated
    await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: "POST" });

    // Find which lane each racer is in
    const heatRes = await fetch(`${baseUrl}/api/events/${eventId}/heats`);
    const allHeats = await heatRes.json();
    const firstHeat = allHeats.find((h: any) => h.id === heat.id);
    const r1Lane = firstHeat.lanes?.find((l: any) => l.racer_id === r1.id)?.lane_number ?? 1;
    const r2Lane = firstHeat.lanes?.find((l: any) => l.racer_id === r2.id)?.lane_number ?? 2;

    await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: [
          { racer_id: r1.id, lane_number: r1Lane, place: 1, time_ms: 3200 },
          { racer_id: r2.id, lane_number: r2Lane, place: 2, time_ms: 3500 },
        ],
      }),
    });

    // 6. Fetch standings and racers (same as the StandingsView component does)
    const standingsRes = await fetch(`${baseUrl}/api/events/${eventId}/standings`);
    const standings = await standingsRes.json();

    const racersRes = await fetch(`${baseUrl}/api/events/${eventId}/racers`);
    const racers = await racersRes.json();

    expect(standings.length).toBe(2);
    expect(racers.length).toBe(2);

    // 7. Apply the same join + filter logic as StandingsView.tsx
    const withDens = standings.map((s: any, i: number) => ({
      ...s,
      rank: i + 1,
      den: racers.find((r: any) => r.id === s.racer_id)?.den ?? null,
    }));

    // 8. Filter by "Lions" — should return only Alice
    const lionsOnly = withDens.filter((s: any) => s.den === "Lions");
    expect(lionsOnly.length).toBe(1);
    expect(lionsOnly[0].racer_id).toBe(r1.id);

    // 9. Filter by "Tigers" — should return only Bob
    const tigersOnly = withDens.filter((s: any) => s.den === "Tigers");
    expect(tigersOnly.length).toBe(1);
    expect(tigersOnly[0].racer_id).toBe(r2.id);

    // 10. Racers must carry the correct den value for the filter to work
    const aliceFromRacers = racers.find((r: any) => r.id === r1.id);
    expect(aliceFromRacers.den).toBe("Lions");

    const bobFromRacers = racers.find((r: any) => r.id === r2.id);
    expect(bobFromRacers.den).toBe("Tigers");
  });

  /**
   * Den values stored via the API must round-trip as exact strings that match
   * CUB_SCOUT_DENS, so the static dropdown in StandingsView can match them.
   */
  it("den values stored via the API match CUB_SCOUT_DENS exactly", async () => {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Den Round-trip Test", date: "2026-03-07", lane_count: 2 }),
    });
    const event = await eventRes.json();

    // Create one racer per den value
    for (const den of CUB_SCOUT_DENS) {
      const res = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Scout ${den}`, den }),
      });
      const racer = await res.json();
      // The API must echo back exactly the same den string
      expect(racer.den).toBe(den);
    }

    // All dens round-trip correctly through the GET endpoint too
    const racersRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`);
    const racers = await racersRes.json();
    const storedDens = racers.map((r: any) => r.den).sort();
    expect(storedDens).toEqual([...CUB_SCOUT_DENS].sort());
  });
});

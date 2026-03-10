import { test, expect } from '@playwright/test';

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

interface RacerRecord { id: string; car_number: string }
interface HeatRecord  { id: string; status: string; lanes: { lane_number: number; racer_id: string }[] }

async function seedCompletedEvent() {
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Standings UI Test', date: '2026-03-01', lane_count: 2 }),
  });
  const event = await eventRes.json();

  const racerDefs = [
    { name: 'Alpha Wolf',  den: 'Wolves' },
    { name: 'Beta Bear',   den: 'Bears' },
    { name: 'Gamma Wolf',  den: 'Wolves' },
    { name: 'Delta Bears', den: 'Bears' },
  ];

  const racers: RacerRecord[] = [];
  for (const def of racerDefs) {
    const r = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(def),
    });
    racers.push(await r.json());
  }

  for (const r of racers) {
    await fetch(`${baseUrl}/api/racers/${r.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });
  }

  await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rounds: 2, lane_count: 2 }),
  });

  // Run all heats to completion
  for (let guard = 0; guard < 500; guard++) {
    const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
    const heats: HeatRecord[] = await heatsRes.json();
    const next = heats.find(h => h.status === 'running' || h.status === 'pending');
    if (!next) break;
    if (next.status === 'pending') {
      await fetch(`${baseUrl}/api/heats/${next.id}/start`, { method: 'POST' });
    }
    const lanes = [...next.lanes].sort((a, b) => a.lane_number - b.lane_number);
    await fetch(`${baseUrl}/api/heats/${next.id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: lanes.map((lane, idx) => ({
          lane_number: lane.lane_number,
          racer_id: lane.racer_id,
          place: idx + 1,
          time_ms: 3000 + idx * 10,
        })),
      }),
    });
  }

  return { event, racers };
}

test.describe('Standings UI', () => {
  test('search by name filters the list', async ({ page }) => {
    const { event } = await seedCompletedEvent();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForSelector('[data-testid^="standing-card-"]');

    const allCards = page.locator('[data-testid^="standing-card-"]');
    const initialCount = await allCards.count();
    expect(initialCount).toBe(4);

    await page.fill('input[placeholder="Name or car #"]', 'Wolf');

    const filtered = page.locator('[data-testid^="standing-card-"]');
    await expect(filtered).toHaveCount(2);
    await expect(page.locator('[data-testid^="standing-card-"]')).toContainText(['Alpha Wolf', 'Gamma Wolf']);
  });

  test('den filter shows only racers from that den', async ({ page }) => {
    const { event } = await seedCompletedEvent();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForSelector('[data-testid^="standing-card-"]');

    // Open the den filter Select
    await page.click('button:has-text("All Dens")');
    await page.click('[role="option"]:has-text("Bears")');

    const filtered = page.locator('[data-testid^="standing-card-"]');
    await expect(filtered).toHaveCount(2);
    // Verify the two Bears den racers are shown by name
    const names = await filtered.allInnerTexts();
    expect(names.join(' ')).toContain('Beta Bear');
    expect(names.join(' ')).toContain('Delta Bears');
    expect(names.join(' ')).not.toContain('Wolf');
  });

  test('clicking Wins column header sorts by wins descending then ascending', async ({ page }) => {
    const { event, racers } = await seedCompletedEvent();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForSelector('[data-testid^="standing-card-"]');

    // Default sort is rank asc — first card should be car #1 (the race winner)
    const firstCard = page.locator('[data-testid^="standing-card-"]').first();
    const firstCarNumber = racers[0]!.car_number;
    await expect(firstCard).toHaveAttribute('data-testid', `standing-card-${firstCarNumber}`);

    // Click Wins to sort by wins desc
    await page.click('button:has-text("Wins")');
    const cardsAfterFirst = page.locator('[data-testid^="standing-card-"]');
    const firstAttrDesc = await cardsAfterFirst.first().getAttribute('data-testid');
    expect(firstAttrDesc).toBeDefined();

    // Click Wins again to sort asc — order should reverse
    await page.click('button:has-text("Wins")');
    const cardsAfterSecond = page.locator('[data-testid^="standing-card-"]');
    const firstAttrAsc = await cardsAfterSecond.first().getAttribute('data-testid');
    expect(firstAttrAsc).not.toBe(firstAttrDesc);
  });
});

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Racer Profile', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  async function seedTwoRacers() {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Profile Test Event', date: '2026-03-15', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const photoPath = path.join(import.meta.dirname, '../tests/assets/car1.jpg');

    // Racer 1: has photo
    const r1Res = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dean Kim', den: 'Wolves' }),
    });
    const racer1 = await r1Res.json();
    await fetch(`${baseUrl}/api/racers/${racer1.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });
    if (fs.existsSync(photoPath)) {
      const buf = fs.readFileSync(photoPath);
      const form = new FormData();
      form.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'car1.jpg');
      await fetch(`${baseUrl}/api/racers/${racer1.id}/photo`, { method: 'POST', body: form });
    }

    // Racer 2: no photo
    const r2Res = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lyile Bowers', den: 'Bears' }),
    });
    const racer2 = await r2Res.json();
    await fetch(`${baseUrl}/api/racers/${racer2.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    // Generate heats and complete one
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
    const heats = await heatsRes.json();
    const heat = heats[0];
    await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: heat.lanes.map((lane: any, idx: number) => ({
          lane_number: lane.lane_number,
          racer_id: lane.racer_id,
          place: idx + 1,
          time_ms: 3000 + idx * 200,
        })),
      }),
    });

    return { event, racer1, racer2 };
  }

  test('shows racer name, car number, and den when profile opens', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    await page.click('[data-testid="standing-card-1"]');
    await page.waitForTimeout(5000);

    await expect(page.locator('text=Dean Kim')).toBeVisible();
    await expect(page.locator('text=Wolves')).toBeVisible();
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText('#1');
  });

  test('shows car photo when racer has one', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    await page.click('[data-testid="standing-card-1"]');
    await page.waitForTimeout(5000);

    await expect(page.locator('img[alt="Dean Kim"]')).toBeVisible();
  });

  test('does not show car photo when racer has none', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    await page.click('[data-testid="standing-card-2"]');
    await page.waitForTimeout(5000);

    await expect(page.locator('text=Lyile Bowers')).toBeVisible();
    await expect(page.locator('img[alt="Lyile Bowers"]')).not.toBeVisible();
  });

  test('shows race history after heats are completed', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    await page.click('[data-testid="standing-card-1"]');
    await page.waitForTimeout(5000);

    await expect(page.locator('text=Race History')).toBeVisible();
    await expect(page.locator('text=No races completed yet')).not.toBeVisible();
  });

  test('shows correct win count after completed heats', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    // Dean Kim got place 1 → 1 win
    await page.click('[data-testid="standing-card-1"]');
    await page.waitForTimeout(5000);

    // StatsCard renders: <span>{label}</span> inside a flex row, with the value div as sibling.
    // Going up two levels from the "Wins" span reaches CardContent, which contains the value "1".
    const winsCardContent = page.locator('span', { hasText: 'Wins' }).first().locator('../..');
    await expect(winsCardContent).toContainText('1');
  });

  test('back button returns to standings', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-standings"]');
    await page.waitForTimeout(5000);

    await page.click('[data-testid="standing-card-1"]');
    await page.waitForTimeout(5000);

    await page.click('text=Back');
    await page.waitForTimeout(1000);

    // Profile is gone; standings cards are visible again
    await expect(page.locator('text=Race History')).not.toBeVisible();
    await expect(page.locator('[data-testid="standing-card-1"]')).toBeVisible();
  });
});

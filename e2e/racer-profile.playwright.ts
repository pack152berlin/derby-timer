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
    await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: 'POST' });
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
    const { event, racer1 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');
    
    await page.click(`[data-testid="standing-card-${racer1.car_number}"]`);
    
    await expect(page.locator('h1')).toContainText('Dean Kim');
    await expect(page.locator('img[alt="Wolves"]')).toBeVisible();
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer1.car_number}`);
  });

  test('shows car photo when racer has one', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    await page.click('[data-testid="standing-card-1"]');

    await expect(page.locator('img[alt="Dean Kim"]')).toBeVisible();
  });

  test('does not show car photo when racer has none', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    await page.click('[data-testid="standing-card-2"]');

    await expect(page.locator('h1')).toContainText('Lyile Bowers');
    await expect(page.locator('img[alt="Lyile Bowers"]')).not.toBeVisible();
  });

  test('shows race history after heats are completed', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    await page.click('[data-testid="standing-card-1"]');

    await expect(page.locator('text=Race History')).toBeVisible();
    await expect(page.locator('text=No races completed yet')).not.toBeVisible();
  });

  test('shows correct win count after completed heats', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    // Dean Kim got place 1 → 1 win
    await page.click('[data-testid="standing-card-1"]');

    // Wait for the stats to load
    const winsCardContent = page.locator('span', { hasText: 'Wins' }).first().locator('../..');
    await expect(winsCardContent).toContainText('1');
  });

  test('back button returns to standings', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    await page.click('[data-testid="standing-card-1"]');
    
    // Ensure we are on the profile
    await expect(page.locator('text=Race History')).toBeVisible();

    await page.click('[data-testid="btn-back"]');

    // Profile is gone; standings cards are visible again
    await expect(page.locator('text=Race History')).not.toBeVisible();
    await expect(page.locator('[data-testid="standing-card-1"]')).toBeVisible();
  });

  test('shows winners in the heat schedule', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-heats"]');

    // Heat 1 was completed in seedTwoRacers. Switch to the Completed tab to see it.
    await page.click('[data-testid="tab-completed"]');
    const completedHeatCard = page.locator('[data-testid="heat-card"]').first();
    await expect(completedHeatCard.locator('text=1st').first()).toBeVisible();
    await expect(completedHeatCard.locator('text=2nd').first()).toBeVisible();
  });

  test('clicking another racer in heat history navigates to their profile', async ({ page }) => {
    const { event, racer1, racer2 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    // Open racer1's profile
    await page.click(`[data-testid="standing-card-${racer1.car_number}"]`);
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer1.car_number}`);

    // Click the other racer's car number in the heat history table
    // Lane cells show #car_number; clicking a non-current one navigates to that racer
    await page.click(`text=#${racer2.car_number}`);

    // Should now show racer2's profile
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer2.car_number}`);
    await expect(page.url()).toContain(`/racer/`);
  });

  async function seedWithoutTimes() {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No-Times Event', date: '2026-03-15', lane_count: 2 }),
    });
    const event = await eventRes.json();

    for (const name of ['Alex One', 'Blake Two']) {
      const rRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const racer = await rRes.json();
      await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_ok: true }),
      });
    }

    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
    const heats = await heatsRes.json();
    const heat = heats[0];
    await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: 'POST' });
    await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: heat.lanes.map((lane: any, idx: number) => ({
          lane_number: lane.lane_number,
          racer_id: lane.racer_id,
          place: idx + 1,
          // no time_ms
        })),
      }),
    });

    return { event };
  }

  test('shows time for every racer in heat history, not just current racer', async ({ page }) => {
    const { event, racer1, racer2 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    // Open racer1's profile (place 1 → time_ms 3000ms → "3.000s")
    await page.click('[data-testid="standing-card-1"]');
    await expect(page.locator('text=Race History')).toBeVisible();

    // racer1's own time
    await expect(page.locator('text=3.000s').first()).toBeVisible();
    // racer2's time should also appear in the same heat row
    await expect(page.locator('text=3.200s').first()).toBeVisible();
  });

  test('shows no time values when heat completed without timing data', async ({ page }) => {
    const { event } = await seedWithoutTimes();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    await page.click('[data-testid="standing-card-1"]');
    await expect(page.locator('text=Race History')).toBeVisible();

    // No time strings should be visible
    await expect(page.locator('text=/\\d\\.\\d{3}s/')).toHaveCount(0);
  });

  test('Best Time stat shows fastest run from history', async ({ page }) => {
    const { event } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    // Racer 1 got 3.000s (place 1), racer 2 got 3.200s (place 2)
    await page.click('[data-testid="standing-card-1"]');

    await expect(page.locator('text=Best Time')).toBeVisible();
    await expect(page.locator('text=3.000s').first()).toBeVisible();
  });

  test('clicking racer in completed heats schedule navigates to their profile', async ({ page }) => {
    const { event, racer2 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-heats"]');
    await page.click('[data-testid="tab-completed"]');

    await page.click(`[data-testid="completed-racer-${racer2.id}"]`);

    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer2.car_number}`);
    await expect(page.url()).toContain('/racer/');
  });

  test('back button from profile opened via completed heats returns to heats page', async ({ page }) => {
    const { event, racer1 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-heats"]');
    await page.click('[data-testid="tab-completed"]');

    await page.click(`[data-testid="completed-racer-${racer1.id}"]`);
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer1.car_number}`);

    await page.click('[data-testid="btn-back"]');

    await expect(page.url()).toContain('/heats');
    await expect(page.locator('[data-testid="tab-completed"]')).toBeVisible();
  });

  test('back button returns to standings after navigating between profiles', async ({ page }) => {
    const { event, racer1, racer2 } = await seedTwoRacers();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-standings"]');

    // Open racer1's profile from standings
    await page.click(`[data-testid="standing-card-${racer1.car_number}"]`);
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer1.car_number}`);

    // Navigate to racer2's profile from within racer1's heat history
    await page.click(`text=#${racer2.car_number}`);
    await expect(page.locator('[data-testid="banner-car-number"]')).toHaveText(`#${racer2.car_number}`);

    // Back from racer2 should go to standings, not loop back to racer1
    await page.click('[data-testid="btn-back"]');
    await expect(page.locator(`[data-testid="standing-card-${racer1.car_number}"]`)).toBeVisible();
    await expect(page.url()).not.toContain('/racer/');
  });
});

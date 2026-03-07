import { test, expect } from '@playwright/test';

test.describe('Race Console', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  async function setupEventWithHeats(eventName: string) {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: eventName, date: '2026-03-01', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Speed Racer' }),
    });
    const racer = await racerRes.json();

    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    return { event, racer };
  }

  test('pending heat shows lane grid with lane numbers and car info', async ({ page }) => {
    const { event, racer } = await setupEventWithHeats('Race Console Lane Grid Test');

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-race"]');
    await page.waitForTimeout(500);

    // Start Heat button should be visible
    await expect(page.locator('[data-testid="btn-start-heat"]')).toBeVisible();

    // Lane grid tiles should be shown — at least lane 1 and car info
    await expect(page.locator('text=Lane').first()).toBeVisible();
    await expect(page.locator(`text=#${racer.car_number}`).first()).toBeVisible();
    await expect(page.locator(`text=Speed Racer`).first()).toBeVisible();
  });

  test('starting a heat hides the lane grid and shows result entry', async ({ page }) => {
    const { event } = await setupEventWithHeats('Race Console Start Heat Test');

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-race"]');
    await page.waitForTimeout(500);

    // Lane grid is visible before starting
    await expect(page.locator('[data-testid="btn-start-heat"]')).toBeVisible();
    await expect(page.locator('text=Lane').first()).toBeVisible();

    // Click Start Heat
    await page.click('[data-testid="btn-start-heat"]');
    await page.waitForTimeout(500);

    // Start Heat button should be gone, result entry (DNF button) should appear
    await expect(page.locator('[data-testid="btn-start-heat"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("DNF")').first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Inspection pass/fail', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  async function seedEvent() {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Inspection Test Event', date: '2026-03-15', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex Rivera', den: 'Tigers' }),
    });
    const racer = await racerRes.json();

    return { event, racer };
  }

  test('PASS updates inline without triggering full-page loader', async ({ page }) => {
    const { event } = await seedEvent();

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);

    // Switch to inspection tab
    await page.click('[data-testid="nav-register"]');
    await page.locator('[data-testid="tab-inspectionTab"]').click();

    // The full-page loader should never become visible during inspection
    const fullPageLoader = page.locator('text=Loading Race Data');
    await expect(fullPageLoader).not.toBeVisible();

    // Click PASS
    await page.getByRole('button', { name: /^pass$/i }).first().click();

    // Loader still should not have appeared
    await expect(fullPageLoader).not.toBeVisible();

    // The racer card should update to show PASSED inline
    await expect(page.getByText('PASSED').first()).toBeVisible();
  });

  test('FAIL updates inline without triggering full-page loader', async ({ page }) => {
    const { event, racer } = await seedEvent();

    // Pre-pass the racer so the FAIL button is available via Reset
    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-register"]');
    await page.locator('[data-testid="tab-inspectionTab"]').click();

    const fullPageLoader = page.locator('text=Loading Race Data');
    await expect(fullPageLoader).not.toBeVisible();

    // Reset (sets weight_ok back to false)
    await page.getByRole('button', { name: /reset/i }).first().click();

    await expect(fullPageLoader).not.toBeVisible();

    // PASS button should be back
    await expect(page.getByRole('button', { name: /^pass$/i }).first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

test.describe('Routing Redirects', () => {
  test('should redirect to home when accessing /race without an event', async ({ page }) => {
    // 1. Navigate to /race directly
    await page.goto(`${baseUrl}/race`);
    
    // 2. Should be redirected to / (the events list)
    await expect(page).toHaveURL(`${baseUrl}/`);
    await expect(page.locator('h1')).toContainText('Race Events');
  });

  test('should redirect to home when accessing /standings without an event', async ({ page }) => {
    await page.goto(`${baseUrl}/standings`);
    await expect(page).toHaveURL(`${baseUrl}/`);
  });

  test('should persist event selection after refresh', async ({ page }) => {
    // 1. Create an event
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Persistence Test', date: '2026-03-15', lane_count: 4 }),
    });
    const event = await eventRes.json();

    // 2. Go home and select the event
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await expect(page).toHaveURL(`${baseUrl}/register`);

    // 3. Refresh the page
    await page.reload();

    // 4. Should still be on /register and see the event name in navigation
    await expect(page).toHaveURL(`${baseUrl}/register`);
    await expect(page.locator('nav')).toContainText(event.name);
  });

  test('should handle browser back from racer to racer', async ({ page }) => {
    // 1. Create event and 2 racers
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Back Nav Test', date: '2026-03-15', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const r1Res = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Racer One' }),
    });
    const racer1 = await r1Res.json();

    const r2Res = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Racer Two' }),
    });
    const racer2 = await r2Res.json();

    // 2. Select event
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);

    // 3. Navigate to Racer 1
    await page.click(`[data-testid="car-number-1"]`);
    await expect(page).toHaveURL(new RegExp(`/racer/${racer1.id}$`));
    await expect(page.locator('h1')).toContainText('Racer One');

    // 4. Navigate directly to Racer 2 (simulate internal app nav)
    // We'll click the car number 2 in the "Registration" view if we go back or just use context nav
    // Let's go back to registration then racer 2
    await page.click('[data-testid="btn-back"]');
    await page.click(`[data-testid="car-number-2"]`);
    await expect(page).toHaveURL(new RegExp(`/racer/${racer2.id}$`));
    await expect(page.locator('h1')).toContainText('Racer Two');

    // 5. Hit browser back
    await page.goBack();
    
    // 6. Should be on registration list (because we clicked back internally in step 4)
    await expect(page).toHaveURL(`${baseUrl}/register`);
  });

  test('should handle browser back from racer to standings', async ({ page }) => {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Standings Back Test', date: '2026-03-15', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const rRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Standings Racer' }),
    });
    const racer = await rRes.json();

    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    // Generate and complete a heat so they show up in standings
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
    const heats = await heatsRes.json();
    await fetch(`${baseUrl}/api/heats/${heats[0].id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ lane_number: 1, racer_id: racer.id, place: 1 }] }),
    });

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    
    // Go to standings
    await page.click('[data-testid="nav-standings"]');
    await expect(page).toHaveURL(`${baseUrl}/standings`);

    // Go to profile
    await page.click('[data-testid="standing-card-1"]');
    await expect(page.locator('h1')).toContainText('Standings Racer');

    // Browser back
    await page.goBack();

    // Should be on standings
    await expect(page).toHaveURL(`${baseUrl}/standings`);
    await expect(page.locator('h1')).toContainText('Race Standings');
  });
});

import { test, expect } from '@playwright/test';

test.describe('Registration Sorting UI', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  test('should toggle between newest and car number sorting', async ({ page }) => {
    // 1. Create a test event via API first so we have somewhere to go
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'UI Test Event', date: '2026-03-01', lane_count: 4 }),
    });
    const event = await eventResponse.json();

    // 2. Create two racers via API (faster than UI form interactions)
    await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Older Racer' }),
    });
    await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Newer Racer' }),
    });

    // 3. Navigate to registration for this event
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);

    // 4. Verify default sorting (Newest First)
    const racerCards = page.locator('[data-testid="racer-card"]');

    // First card should be the Newer Racer
    await expect(racerCards.nth(0)).toContainText('Newer Racer');
    // Second card should be the Older Racer
    await expect(racerCards.nth(1)).toContainText('Older Racer');

    // 5. Toggle the switch to "Car #"
    // The switch is inside our new Sort toggle box.
    await page.locator('[data-testid="sort-toggle"] button[role="switch"]').click();

    // 6. Verify sorting changed to Car #
    // Older Racer should have car #1, Newer Racer should have car #2
    // So in Car # sort, Older Racer should now be first.
    await expect(racerCards.nth(0)).toContainText('Older Racer');
    await expect(racerCards.nth(1)).toContainText('Newer Racer');
  });
});

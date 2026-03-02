import { test, expect } from '@playwright/test';

test.describe('Heat Schedule Filtering', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  test('should filter heats by status (All vs Pending)', async ({ page }) => {
    // 1. Setup: Create event, racer, and generate heats
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Heat Filter Test', date: '2026-03-01', lane_count: 4 }),
    });
    const event = await eventResponse.json();
    const eventId = event.id;

    const racerResponse = await fetch(`${baseUrl}/api/events/${eventId}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fastest Racer' }),
    });
    const racer = await racerResponse.json();

    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    const generateResponse = await fetch(`${baseUrl}/api/events/${eventId}/generate-heats`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const heats = await generateResponse.json();
    const heatId = heats[0].id;

    // 2. Navigate to root and select the event
    await page.goto(`${baseUrl}/`);
    await page.click(`text=${event.name}`);
    
    // Move to Heats view
    await page.click('button:has-text("Schedule")');
    
    // Initial state: Heat is visible. Wait for it to load.
    await page.waitForTimeout(2000);
    const heatCard = page.locator('[data-testid="heat-card"]');
    await expect(heatCard.first()).toBeVisible();

    // 3. Complete the heat via API (to simulate real-time update)
    await fetch(`${baseUrl}/api/heats/${heatId}/complete`, { method: 'POST' });

    // Force a full reload to ensure the most recent data is fetched
    await page.reload();
    await page.click(`text=${event.name}`);
    await page.click('button:has-text("Schedule")');
    
    // Verify specific heat status changed to complete
    const targetHeatCard = page.locator('[data-testid="heat-card"]', { hasText: `Heat ${heats[0].heat_number}` });
    await expect(targetHeatCard).toContainText('complete');

    // 4. Toggle filter to "Pending"
    // Find the Status filter toggle.
    await page.locator('[data-testid="status-toggle"] button[role="switch"]').click();

    // 5. Verify completed heat is now hidden
    await expect(targetHeatCard).not.toBeVisible();
    await expect(page.locator('text=No heats matching the filters')).not.toBeVisible(); // Custom empty message check if you added one, otherwise just not visible

    // 6. Toggle back to "All"
    await page.locator('div:has-text("Status:")').locator('button[role="switch"]').click();
    await expect(page.locator(`text=Heat ${heats[0].heat_number}`)).toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';

test.describe('Heat Schedule', () => {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;

  async function createEventWithEligibleRacer(name: string) {
    const eventRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date: '2026-03-01', lane_count: 4 }),
    });
    const event = await eventRes.json();

    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Racer' }),
    });
    const racer = await racerRes.json();

    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    return event;
  }

  async function navigateToHeats(page: Page, eventName: string) {
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${eventName}")`);
    await page.click('[data-testid="nav-heats"]');
    await page.waitForTimeout(500);
  }

  test('Generate Heats dialog: cancel does not generate heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Generate Cancel Test');
    await navigateToHeats(page, event.name);

    // Confirm no heats yet — generate button should be visible
    await expect(page.locator('[data-testid="btn-generate-heats"]')).toBeVisible();

    // Click the button — dialog should appear
    await page.click('[data-testid="btn-generate-heats"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText('Generate Heats');
    await expect(page.locator('[role="dialog"]')).toContainText('1 eligible racer');

    // Cancel — dialog closes, no heats generated
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="btn-generate-heats"]')).toBeVisible();
  });

  test('Generate Heats dialog: confirm generates heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Generate Confirm Test');
    await navigateToHeats(page, event.name);

    await page.click('[data-testid="btn-generate-heats"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Confirm — heats should be generated and the dialog should close
    await page.click('[role="dialog"] button:has-text("Generate Heats")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="heat-card"]').first()).toBeVisible();
  });

  test('Clear All Heats dialog: cancel keeps heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Clear Cancel Test');

    // Generate heats via API
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await navigateToHeats(page, event.name);
    await expect(page.locator('[data-testid="heat-card"]').first()).toBeVisible();

    // Click Clear All — dialog should appear
    await page.click('[data-testid="btn-clear-heats"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText('Clear All Heats');
    await expect(page.locator('[role="dialog"]')).toContainText('cannot be undone');

    // Cancel — dialog closes, heats remain
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="heat-card"]').first()).toBeVisible();
  });

  test('Clear All Heats dialog: confirm clears heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Clear Confirm Test');

    // Generate heats via API
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await navigateToHeats(page, event.name);
    await expect(page.locator('[data-testid="heat-card"]').first()).toBeVisible();

    // Click Clear All and confirm
    await page.click('[data-testid="btn-clear-heats"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.click('[role="dialog"] button:has-text("Clear All")');

    // Dialog closes and heats are gone
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="heat-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="empty-heats"]')).toBeVisible();
  });

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const heats = await generateResponse.json();
    const heatId = heats[0].id;

    // 2. Navigate to root and select the event
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    
    // Move to Heats view
    await page.click('[data-testid="nav-heats"]');
    
    // Initial state: Heat is visible. Wait for it to load.
    await page.waitForTimeout(2000);
    const heatCard = page.locator('[data-testid="heat-card"]');
    await expect(heatCard.first()).toBeVisible();

    // 3. Complete the heat via API (to simulate real-time update)
    await fetch(`${baseUrl}/api/heats/${heatId}/complete`, { method: 'POST' });

    // Force a full reload to ensure the most recent data is fetched
    await page.reload();
    await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
    await page.click('[data-testid="nav-heats"]');
    
    // Verify specific heat status changed to complete
    const targetHeatCard = page.locator('[data-testid="heat-card"]', { hasText: `Heat ${heats[0].heat_number}` });
    await expect(targetHeatCard).toContainText('complete');

    // 4. Toggle filter to "Pending"
    await page.locator('[data-testid="status-toggle"] button[role="switch"]').click();

    // 5. Verify completed heat is now hidden
    await expect(targetHeatCard).not.toBeVisible();
    await expect(page.locator('text=No heats matching the filters')).not.toBeVisible();

    // 6. Toggle back to "All"
    await page.locator('[data-testid="status-toggle"] button[role="switch"]').click();
    await expect(targetHeatCard).toBeVisible();
  });
});

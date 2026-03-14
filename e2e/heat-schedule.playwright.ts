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

  async function navigateToHeats(page: Page, eventId: string) {
    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${eventId}"]`);
    await page.click('[data-testid="nav-heats"]');
    await page.locator('[data-testid="btn-generate-heats"]').or(page.locator('[data-testid="btn-clear-heats"]')).first().waitFor();
  }

  test('Generate Heats dialog: cancel does not generate heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Generate Cancel Test');
    await navigateToHeats(page, event.id);

    // Confirm no heats yet — generate button should be visible
    await expect(page.locator('[data-testid="btn-generate-heats"]')).toBeVisible();

    // Click the button — dialog should appear
    await page.click('[data-testid="btn-generate-heats"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText('Start Racing');
    await expect(page.locator('[role="dialog"]')).toContainText('1 eligible racer');

    // Cancel — dialog closes, no heats generated
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="btn-generate-heats"]')).toBeVisible();
  });

  test('Clear All Heats dialog: cancel keeps heats', async ({ page }) => {
    const event = await createEventWithEligibleRacer('Clear Cancel Test');

    // Generate heats via API
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await navigateToHeats(page, event.id);
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

  test('End Race: double confirmation flow ends the race', async ({ page }) => {
    const event = await createEventWithEligibleRacer('End Race Flow Test');

    // Generate heats so the End Race button appears
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await navigateToHeats(page, event.id);
    await expect(page.locator('[data-testid="heat-card"]').first()).toBeVisible();

    // End Race button should be visible
    await expect(page.locator('[data-testid="btn-end-race"]')).toBeVisible();

    // Click End Race — first confirmation dialog
    await page.click('[data-testid="btn-end-race"]');
    const dialog1 = page.locator('[role="dialog"]');
    await expect(dialog1).toBeVisible();
    await expect(dialog1).toContainText('End Race?');
    await expect(dialog1).toContainText('finalize all results');

    // Click Continue — second confirmation dialog appears
    await page.click('[role="dialog"] button:has-text("Continue")');
    const dialog2 = page.locator('[role="dialog"]:has-text("Are you sure?")');
    await expect(dialog2).toBeVisible();
    await expect(dialog2).toContainText('cannot be undone');

    // Click End Race (destructive) — race ends
    await dialog2.locator('button:has-text("End Race")').click();
    await expect(dialog2).not.toBeVisible();

    // Verify event is now complete via API
    const eventRes = await fetch(`${baseUrl}/api/events/${event.id}`);
    const updatedEvent = await eventRes.json();
    expect(updatedEvent.status).toBe('complete');
  });

  test('End Race: cancel on first dialog does not end race', async ({ page }) => {
    const event = await createEventWithEligibleRacer('End Race Cancel Test');

    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await navigateToHeats(page, event.id);
    await page.click('[data-testid="btn-end-race"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Cancel — dialog closes, event still racing
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    const eventRes = await fetch(`${baseUrl}/api/events/${event.id}`);
    const updatedEvent = await eventRes.json();
    expect(updatedEvent.status).toBe('racing');
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
    await page.click(`[data-testid="event-card-${event.id}"]`);
    
    // Move to Heats view
    await page.click('[data-testid="nav-heats"]');
    
    // Initial state: Heat is visible. Wait for it to load.
    const heatCard = page.locator('[data-testid="heat-card"]');
    await expect(heatCard.first()).toBeVisible();

    // 3. Complete the heat via API (to simulate real-time update)
    await fetch(`${baseUrl}/api/heats/${heatId}/complete`, { method: 'POST' });

    // Force a full reload to ensure the most recent data is fetched
    // Because event is persisted in localStorage, we should land back on /heats
    await page.reload();
    
    // 3b. Switch to Completed tab and verify the heat appears as a compact row.
    await page.click('[data-testid="tab-completed"]');
    const targetHeatCard = page.locator('[data-testid="heat-card"]', { hasText: `H${heats[0].heat_number}` });
    await expect(targetHeatCard).toBeVisible();
    await expect(targetHeatCard).toContainText(`R${heats[0].round}`);

    // 4. Switch to Pending tab — completed heat should not be visible there.
    await page.click('[data-testid="tab-pending"]');
    await expect(targetHeatCard).not.toBeVisible();
  });
});

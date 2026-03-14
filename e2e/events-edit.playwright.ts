import { test, expect } from '@playwright/test';

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

/** Create a bare event via the API and return it. */
async function createEvent(opts: { name: string; date?: string; lane_count?: number; organization?: string }) {
  const res = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: opts.name,
      date: opts.date ?? '2026-03-15',
      lane_count: opts.lane_count ?? 4,
      organization: opts.organization ?? 'Cub Scouts of America',
    }),
  });
  return res.json();
}

/** Set awards on an event via API. */
async function setAwards(eventId: string, awards: { name: string; allow_second?: boolean; allow_third?: boolean }[]) {
  await fetch(`${baseUrl}/api/events/${eventId}/awards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ awards }),
  });
}

// ─── EventsView Redesign ────────────────────────────────────────────────────

test.describe('EventsView Redesign', () => {
  test('event cards show status pill and stat chips', async ({ page }) => {
    const event = await createEvent({ name: 'Card Status Test' });

    await page.goto(`${baseUrl}/`);
    const card = page.locator(`[data-testid="event-card-${event.id}"]`);
    await expect(card).toBeVisible();

    // Status pill shows "Draft"
    await expect(card.locator('text=Draft')).toBeVisible();

    // Stat chips show racer/lane counts
    await expect(card.locator('text=0 Racers')).toBeVisible();
    await expect(card.locator('text=4 Lanes')).toBeVisible();
  });

  test('edit button navigates to edit page', async ({ page }) => {
    const event = await createEvent({ name: 'Edit Nav Test' });

    await page.goto(`${baseUrl}/`);
    const card = page.locator(`[data-testid="event-card-${event.id}"]`);

    // Edit button (pencil icon)
    const editBtn = card.locator('button[title="Edit Event"]');
    await editBtn.click();

    await expect(page).toHaveURL(`${baseUrl}/event/${event.id}/edit`);
  });

  test('delete button only visible for empty events', async ({ page }) => {
    const emptyEvent = await createEvent({ name: 'Empty Event' });
    const populatedEvent = await createEvent({ name: 'Populated Event' });

    // Add a racer to the populated event
    await fetch(`${baseUrl}/api/events/${populatedEvent.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Racer' }),
    });

    await page.goto(`${baseUrl}/`);

    // Empty event should have delete button
    const emptyCard = page.locator(`[data-testid="event-card-${emptyEvent.id}"]`);
    await expect(emptyCard.locator('button[title="Delete Event"]')).toBeAttached();

    // Populated event should NOT have delete button
    const popCard = page.locator(`[data-testid="event-card-${populatedEvent.id}"]`);
    await expect(popCard.locator('button[title="Delete Event"]')).not.toBeAttached();
  });

  test('delete confirmation dialog works', async ({ page }) => {
    const event = await createEvent({ name: 'Delete Dialog Test' });

    await page.goto(`${baseUrl}/`);
    const card = page.locator(`[data-testid="event-card-${event.id}"]`);
    await card.locator('button[title="Delete Event"]').click();

    // Dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText('Delete Event');
    await expect(dialog).toContainText('Delete Dialog Test');

    // Cancel closes dialog
    await dialog.locator('button', { hasText: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Card still exists
    await expect(card).toBeVisible();
  });
});

// ─── SetupView Edit Mode ────────────────────────────────────────────────────

test.describe('SetupView Edit Mode', () => {
  test('loads existing event data into form', async ({ page }) => {
    const event = await createEvent({
      name: 'Editable Event',
      date: '2026-06-20',
      lane_count: 3,
      organization: 'My Pack',
    });

    await page.goto(`${baseUrl}/event/${event.id}/edit`);

    // Wait for form to load
    await expect(page.locator('input[placeholder="Pack 152 Pinewood Derby 2026"]')).toHaveValue('Editable Event');
    await expect(page.locator('input[type="date"]')).toHaveValue('2026-06-20');

    // Sidebar heading says "Edit Event"
    await expect(page.locator('nav h2')).toContainText('Edit Event');
  });

  test('loads existing awards into form', async ({ page }) => {
    const event = await createEvent({ name: 'Awards Edit Test' });
    await setAwards(event.id, [
      { name: 'Most Creative', allow_second: true, allow_third: false },
      { name: 'Custom Trophy', allow_second: false, allow_third: false },
    ]);

    await page.goto(`${baseUrl}/event/${event.id}/edit`);

    // Wait for form to load, then check that "Most Creative" checkbox is checked
    await expect(page.locator('input[placeholder="Pack 152 Pinewood Derby 2026"]')).toHaveValue('Awards Edit Test');

    // The "Most Creative" default award should be checked
    const mcLabel = page.locator('label', { hasText: 'Most Creative' });
    await expect(mcLabel.locator('input[type="checkbox"]')).toBeChecked();

    // "Custom Trophy" should appear as a custom award
    await expect(page.locator('text=Custom Trophy')).toBeVisible();
  });

  test('save changes updates event and navigates home', async ({ page }) => {
    const event = await createEvent({ name: 'Before Edit' });

    await page.goto(`${baseUrl}/event/${event.id}/edit`);

    // Wait for load
    const nameInput = page.locator('input[placeholder="Pack 152 Pinewood Derby 2026"]');
    await expect(nameInput).toHaveValue('Before Edit');

    // Change name
    await nameInput.fill('After Edit');

    // Submit button says "Save Changes"
    const saveBtn = page.locator('button', { hasText: 'Save Changes' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Should navigate to events page
    await expect(page).toHaveURL(`${baseUrl}/`);

    // Verify the event was updated
    await expect(page.locator(`[data-testid="event-card-${event.id}"]`)).toContainText('After Edit');
  });

  test('back link navigates to events page', async ({ page }) => {
    const event = await createEvent({ name: 'Back Link Test' });

    await page.goto(`${baseUrl}/event/${event.id}/edit`);
    await expect(page.locator('text=Back to Events')).toBeVisible();

    await page.click('text=Back to Events');
    await expect(page).toHaveURL(`${baseUrl}/`);
  });

  test('nonexistent event redirects to home', async ({ page }) => {
    await page.goto(`${baseUrl}/event/nonexistent-id/edit`);
    await expect(page).toHaveURL(`${baseUrl}/`);
  });
});

// ─── Event Selection ─────────────────────────────────────────────────────────

test.describe('Event Selection', () => {
  test('clicking event card selects it and navigates', async ({ page }) => {
    const event = await createEvent({ name: 'Select Me' });

    await page.goto(`${baseUrl}/`);
    await page.click(`[data-testid="event-card-${event.id}"]`);

    // Should navigate away from events page
    await expect(page).not.toHaveURL(`${baseUrl}/`);
    // Nav should show event name
    await expect(page.locator('nav')).toContainText('Select Me');
  });
});

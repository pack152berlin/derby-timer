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

    // 2. Navigate to registration for this event
    await page.goto(`${baseUrl}/register`);
    
    // Select the event if needed (assuming the UI shows event selection first)
    // Based on RegistrationView.tsx, if no event is selected it shows a message.
    // We'll click the event card in the EventsView
    await page.click(`text=${event.name}`);

    // 3. Add two racers
    // Racer 1 (will be older)
    await page.click('text=Add Racer');
    await page.fill('input[placeholder="Johnny Smith"]', 'Older Racer');
    await page.click('button:has-text("Add Racer")');
    
    // Wait for confirmation modal and close it
    await expect(page.locator('text=Racer Registered!')).toBeVisible();
    await page.click('text=Close');

    // Racer 2 (will be newer)
    await page.click('text=Add Racer');
    await page.fill('input[placeholder="Johnny Smith"]', 'Newer Racer');
    await page.click('button:has-text("Add Racer")');

    // Wait for confirmation modal and close it
    await expect(page.locator('text=Racer Registered!')).toBeVisible();
    await page.click('text=Close');

    // 4. Verify default sorting (Newest First)
    const racerCards = page.locator('[data-testid="racer-card"]');

    // First card should be the Newer Racer
    await expect(racerCards.nth(0)).toContainText('Newer Racer');
    // Second card should be the Older Racer
    await expect(racerCards.nth(1)).toContainText('Older Racer');

    // 5. Toggle the switch to "Car #"
    // The switch is inside our new Sort toggle box
    await page.click('button[role="switch"]');

    // 6. Verify sorting changed to Car #
    // Older Racer should have car #1, Newer Racer should have car #2
    // So in Car # sort, Older Racer should now be first.
    await expect(racerCards.nth(0)).toContainText('Older Racer');
    await expect(racerCards.nth(1)).toContainText('Newer Racer');
  });
});

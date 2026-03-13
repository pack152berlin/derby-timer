import { test, expect } from '@playwright/test';

const PORT = 3003;
const baseUrl = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-admin';
const VIEWER_PASSWORD = 'test-viewer';

test.describe('Private mode – login gate', () => {
  test('shows login gate on first visit', async ({ page }) => {
    await page.goto(baseUrl);
    await expect(page.locator('text=Event Password')).toBeVisible();
    await expect(page.locator('button:has-text("Log In")')).toBeVisible();
    // No nav items visible behind the gate
    await expect(page.locator('[data-testid="nav-heats"]')).toHaveCount(0);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto(baseUrl);
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button:has-text("Log In")');
    await expect(page.locator('text=Invalid password')).toBeVisible();
  });

  test('viewer password dismisses gate and shows events', async ({ page }) => {
    await page.goto(baseUrl);
    await page.fill('input[type="password"]', VIEWER_PASSWORD);
    await page.click('button:has-text("Log In")');
    // Gate should dismiss, events page should load
    await expect(page.locator('text=Event Password')).not.toBeVisible({ timeout: 3000 });
    // Should see the events page (empty, but no gate)
    await expect(page.locator('text=No events yet')).toBeVisible();
    // Should NOT see admin controls (New Event button)
    await expect(page.locator('button:has-text("New Event")')).toHaveCount(0);
  });

  test('admin password dismisses gate and gives full access', async ({ page }) => {
    await page.goto(baseUrl);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button:has-text("Log In")');
    // Gate should dismiss
    await expect(page.locator('text=Event Password')).not.toBeVisible({ timeout: 3000 });
    // Should see admin controls
    await expect(page.locator('button:has-text("New Event")')).toBeVisible();
  });
});

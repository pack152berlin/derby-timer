import { test, expect } from '@playwright/test';

const PORT = 3002;
const baseUrl = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-secret';

/** Login and return the cookie string for admin API calls. */
async function getAdminCookie(): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0]; // "derby_admin=<hmac>"
}

async function adminFetch(path: string, cookie: string, opts: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...opts.headers },
  });
}

test.describe('UI gating – viewer mode', () => {
  let adminCookie: string;
  let event: { id: string; name: string };

  test.beforeAll(async () => {
    adminCookie = await getAdminCookie();
    const res = await adminFetch('/api/events', adminCookie, {
      method: 'POST',
      body: JSON.stringify({ name: 'Auth Gate Test', date: '2026-03-01', lane_count: 4 }),
    });
    event = await res.json();
  });

  test('events page shows banner and hides create button', async ({ page }) => {
    await page.goto(baseUrl);
    await expect(page.locator('text=Admin access required to make changes')).toBeVisible();
    await expect(page.locator('button:has-text("New Event")')).toHaveCount(0);
  });

  test('viewer nav hides admin-only items', async ({ page }) => {
    await page.goto(baseUrl);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    // Viewer should see Races + Standings but NOT Registration or Race Control
    await expect(page.locator('[data-testid="nav-heats"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-standings"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-register"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-race"]')).toHaveCount(0);
  });

  test('selecting event navigates viewer to heats, not register', async ({ page }) => {
    await page.goto(baseUrl);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await expect(page).toHaveURL(new RegExp('/heats$'));
  });

  test('registration page shows admin wall', async ({ page }) => {
    await page.goto(baseUrl);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.goto(`${baseUrl}/register`);
    await expect(page.locator('text=Admin access required')).toBeVisible();
    await expect(page.locator('text=Registration is only available to administrators')).toBeVisible();
  });

  test('race control page shows admin wall', async ({ page }) => {
    // Select event, then navigate directly to /race
    await page.goto(baseUrl);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.goto(`${baseUrl}/race`);
    await expect(page.locator('text=Admin access required')).toBeVisible();
  });

  test('heats page shows viewer-friendly empty state', async ({ page }) => {
    await page.goto(baseUrl);
    await page.click(`[data-testid="event-card-${event.id}"]`);
    await page.click('[data-testid="nav-heats"]');
    await expect(page.locator('text=Heats will appear here once an admin starts the race')).toBeVisible();
  });

  test('batch certificates page shows admin required', async ({ page }) => {
    await page.goto(`${baseUrl}/certificates`);
    await expect(page.locator('text=Admin access required to print batch certificates')).toBeVisible();
  });

  test('login button visible and login flow works', async ({ page }) => {
    await page.goto(baseUrl);
    // Login button should be visible
    await expect(page.locator('text=Admin Login')).toBeVisible();
    // Click login
    await page.click('text=Admin Login');
    // Dialog should appear
    await expect(page.locator('text=Password')).toBeVisible();
    // Submit correct password
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.locator('[data-slot="dialog-content"] button:has-text("Login")').click();
    // After login, should see New Event button (now admin)
    await expect(page.locator('button:has-text("New Event")')).toBeVisible();
    // Login button should be replaced with Logout
    await expect(page.locator('text=Logout')).toBeVisible();
  });
});

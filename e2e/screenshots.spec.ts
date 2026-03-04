import { test } from '@playwright/test';

/**
 * Screenshot capture spec. Run with:
 *   bun run screenshots
 * Outputs to screenshots/ in the project root.
 */

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

const racers = [
  { name: 'Liam Chen',      den: 'Wolves'  },
  { name: 'Olivia Park',    den: 'Bears'   },
  { name: 'Noah Martinez',  den: 'Webelos' },
  { name: 'Emma Johnson',   den: 'Lions'   },
  { name: 'Aiden Williams', den: 'Tigers'  },
  { name: 'Sophia Brown',   den: 'Wolves'  },
];

async function seedEvent() {
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pack 152 Pinewood Derby 2026', date: '2026-03-15', lane_count: 4 }),
  });
  const event = await eventRes.json();

  for (const data of racers) {
    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const racer = await racerRes.json();
    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });
  }

  await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  return event;
}

test('04-heat-schedule', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-heats"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/04-heat-schedule.png', fullPage: true });
});

test('05-race-control-pending', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/05-race-control-pending.png', fullPage: true });
});

test('06-race-control-running', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-start-heat"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/06-race-control-running.png', fullPage: true });
});

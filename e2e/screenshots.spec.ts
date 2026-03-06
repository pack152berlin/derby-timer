import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Screenshot capture spec. Run with:
 *   bun run screenshots
 * Outputs to screenshots/ in the project root.
 */

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

// 10 racers for a more populated standings
const racers = [
  { name: 'Dean Kim',         den: 'Wolves',   hasPhoto: true  },
  { name: 'Lyile Bowers',     den: 'Bears',    hasPhoto: false },
  { name: 'Klara Kny-Flores', den: 'Webelos',  hasPhoto: true  },
  { name: 'Rio Kny-Flores',   den: 'Lions',    hasPhoto: false },
  { name: 'Flora Kny-Flores', den: 'Tigers',   hasPhoto: true  },
  { name: 'Nate McShreedy',   den: 'Wolves',   hasPhoto: false },
  { name: 'Liam Chen',        den: 'Bears',    hasPhoto: true  },
  { name: 'Olivia Park',      den: 'Webelos',  hasPhoto: false },
  { name: 'Noah Martinez',    den: 'Lions',    hasPhoto: true  },
  { name: 'Emma Johnson',     den: 'Tigers',   hasPhoto: false },
];

async function seedEvent(options: { 
  name?: string, 
  racers?: typeof racers,
  inspectCount?: number // Number of racers to mark as inspected (default all)
} = {}) {
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name: options.name || 'Pack 152 Pinewood Derby 2026', 
      date: '2026-03-15', 
      lane_count: 4 
    }),
  });
  const event = await eventRes.json();

  const photoPaths = [
    path.join(import.meta.dirname, '../tests/assets/car1.jpg'),
    path.join(import.meta.dirname, '../tests/assets/car2.jpg'),
    path.join(import.meta.dirname, '../tests/assets/car3.jpg'),
  ];

  const currentRacers = options.racers || racers;
  let photoIndex = 0;
  const targetInspectCount = options.inspectCount !== undefined ? options.inspectCount : currentRacers.length;

  for (let i = 0; i < currentRacers.length; i++) {
    const data = currentRacers[i];
    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, den: data.den }),
    });
    const racer = await racerRes.json();
    
    // Inspect racer if within target count
    if (i < targetInspectCount) {
      await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_ok: true }),
      });
    }

    // Upload photo if specified
    if (data.hasPhoto) {
      const photoPath = photoPaths[photoIndex % photoPaths.length];
      if (fs.existsSync(photoPath)) {
        const photoBuffer = fs.readFileSync(photoPath);
        const formData = new FormData();
        formData.append("photo", new Blob([photoBuffer], { type: "image/jpeg" }), path.basename(photoPath));
        await fetch(`${baseUrl}/api/racers/${racer.id}/photo`, {
          method: "POST",
          body: formData,
        });
        photoIndex++;
      }
    }
  }

  // Generate heats ONLY if some racers were inspected
  if (targetInspectCount > 0) {
    await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  return event;
}

test('01-registration-list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 10 racers, 7 inspected (3 pending)
  const event = await seedEvent({ inspectCount: 7 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/01-registration-list.png', fullPage: true });
});

test('02-registration-form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ inspectCount: 7 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-add-racer"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/02-registration-form.png' });
});

test('03-registration-list-help', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ inspectCount: 7 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-help"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/03-registration-list-help.png' });
});

test('04-registration-inspection-list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 10 racers, only 6 inspected (4 pending)
  const event = await seedEvent({ inspectCount: 6 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.locator('[data-testid="switch-inspection"]').click();
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/04-registration-inspection-list.png', fullPage: true });
});

test('05-heat-schedule', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Heat Schedule Overview' });

  // Complete one heat
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();
  const heatId = heats[0].id;
  
  const results = heats[0].lanes.map((lane: any, idx: number) => ({
    lane_number: lane.lane_number,
    racer_id: lane.racer_id,
    place: idx + 1
  }));

  await fetch(`${baseUrl}/api/heats/${heatId}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-heats"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/05-heat-schedule.png', fullPage: true });
});

test('06-race-control-pending', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ 
    name: 'Race Control Pending Heat',
    racers: [
      { name: 'Dean Kim',         den: 'Wolves',  hasPhoto: true },
      { name: 'Klara Kny-Flores', den: 'Webelos', hasPhoto: true },
      { name: 'Flora Kny-Flores', den: 'Tigers',  hasPhoto: true },
      { name: 'Liam Chen',        den: 'Bears',   hasPhoto: true },
    ]
  });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/06-race-control-pending.png', fullPage: true });
});

test('07-race-control-no-photos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Ensure we have a heat with NO photos
  const event = await seedEvent({ 
    name: 'Race Control No Photos',
    racers: [
      { name: 'Lyile Bowers',   den: 'Bears',   hasPhoto: false },
      { name: 'Rio Kny-Flores', den: 'Lions',   hasPhoto: false },
      { name: 'Nate McShreedy', den: 'Wolves',  hasPhoto: false },
      { name: 'Olivia Park',    den: 'Webelos', hasPhoto: false },
    ]
  });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/07-race-control-no-photos.png', fullPage: true });
});

test('08-race-control-running', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-start-heat"]');
  await page.waitForTimeout(600);
  
  // Select 1st and 2nd place
  await page.click('[data-testid="lane-row-1"] [data-testid="place-btn-1"]');
  await page.click('[data-testid="lane-row-2"] [data-testid="place-btn-2"]');
  await page.waitForTimeout(400);

  await page.screenshot({ path: 'screenshots/08-race-control-running.png', fullPage: true });
});

test('09-standings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Final Standings' });

  // Complete 5 heats
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();
  
  for (let h = 0; h < 5 && h < heats.length; h++) {
    const heatId = heats[h].id;
    // Vary the winners slightly for interesting standings
    const results = heats[h].lanes.map((lane: any, idx: number) => ({
      lane_number: lane.lane_number,
      racer_id: lane.racer_id,
      place: ((idx + h) % 4) + 1
    }));
    
    await fetch(`${baseUrl}/api/heats/${heatId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
  }

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-standings"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screenshots/09-standings.png', fullPage: true });
});

test('10-external-display', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const event = await seedEvent({ name: 'External Projector Display' });

  // Set event to 'racing' so the display page reliably picks it up
  await fetch(`${baseUrl}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'racing' }),
  });

  // Start a heat to have something interesting on the display
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);
  await page.click('[data-testid="btn-start-heat"]');
  await page.waitForTimeout(600);

  // Navigate to display
  await page.goto(`${baseUrl}/display`);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'screenshots/10-external-display.png' });
});

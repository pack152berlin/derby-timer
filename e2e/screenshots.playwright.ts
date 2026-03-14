import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Screenshot capture spec. Run with:
 *   bun run screenshots
 * Outputs to screenshots/ in the project root.
 * Only writes a file if the pixels changed from the existing screenshot.
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

function saveIfChanged(screenshotPath: string, buffer: Buffer) {
  const name = path.basename(screenshotPath);
  const existing = fs.existsSync(screenshotPath) ? fs.readFileSync(screenshotPath) : null;
  if (!existing) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, buffer);
    console.log(`  \x1b[32m✚ new:\x1b[0m ${name}`);
  } else if (!existing.equals(buffer)) {
    fs.writeFileSync(screenshotPath, buffer);
    console.log(`  \x1b[33m✎ updated:\x1b[0m ${name}`);
  } else {
    console.log(`  \x1b[2m· unchanged:\x1b[0m ${name}`);
  }
}

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
    if (!data) continue;
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
      if (photoPath && fs.existsSync(photoPath)) {
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/01-registration-list.png', await page.screenshot({ fullPage: true }));
});

test('02-registration-form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ inspectCount: 7 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-add-racer"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/02-registration-form.png', await page.screenshot());
});

test('03-registration-list-help', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ inspectCount: 7 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-help"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/03-registration-list-help.png', await page.screenshot());
});

test('04-registration-inspection-list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 10 racers, only 6 inspected (4 pending)
  const event = await seedEvent({ inspectCount: 6 });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-register"]');
  await page.waitForTimeout(600);

  await page.locator('[data-testid="tab-inspectionTab"]').click();
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/04-registration-inspection-list.png', await page.screenshot({ fullPage: true }));
});

test('05-heat-schedule', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Heat Schedule Overview' });

  // Complete 8 heats for a more data-rich schedule
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 8 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-heats"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/05-heat-schedule.png', await page.screenshot({ fullPage: true }));
});

test('06-heat-schedule-completed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Heat Schedule Completed Tab' });

  // Complete 8 heats so the Completed tab has data
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 8 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-heats"]');
  await page.click('[data-testid="tab-completed"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/06-heat-schedule-completed.png', await page.screenshot({ fullPage: true }));
});

test('07-race-control-pending', async ({ page }) => {
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/07-race-control-pending.png', await page.screenshot({ fullPage: true }));
});

test('08-race-control-no-photos', async ({ page }) => {
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/08-race-control-no-photos.png', await page.screenshot({ fullPage: true }));
});

test('09-race-control-running', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);

  await page.click('[data-testid="btn-start-heat"]');
  await page.waitForTimeout(600);

  // Select 1st and 2nd place
  await page.click('[data-testid="lane-row-1"] [data-testid="place-btn-1"]');
  await page.click('[data-testid="lane-row-2"] [data-testid="place-btn-2"]');
  await page.waitForTimeout(400);

  saveIfChanged('screenshots/09-race-control-running.png', await page.screenshot({ fullPage: true }));
});

test('10-standings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Final Standings' });

  // Complete 12 heats for a robust leaderboard
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 12 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-standings"]');
  await page.waitForTimeout(600);

  saveIfChanged('screenshots/10-standings.png', await page.screenshot({ fullPage: true }));
});

test('00-loader', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Loader Screenshot Event' });

  // Intercept the data fetch calls and hold them so the loader stays visible
  await page.route('**/api/events/*/racers', async route => {
    await new Promise(r => setTimeout(r, 3000));
    await route.continue();
  });

  await page.goto(`${baseUrl}/`);

  // Click the event — this triggers selectEvent → loading=true → loader appears
  await page.click(`[data-testid="event-card-${event.id}"]`);

  // Wait for loader to fully fade in
  await page.locator('text=Loading').waitFor();
  await page.waitForTimeout(1000); // let cars get mid-track

  saveIfChanged('screenshots/00-loader.png', await page.screenshot());
});

test('11-external-display', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const event = await seedEvent({ name: 'External Projector Display' });

  // Complete 8 heats so top-standings on display is populated
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();
  for (let h = 0; h < 8 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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

  // Set event to 'racing' so the display page reliably picks it up
  await fetch(`${baseUrl}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'racing' }),
  });

  // Start a heat to have something interesting on the display
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-race"]');
  await page.waitForTimeout(600);
  await page.click('[data-testid="btn-start-heat"]');
  await page.waitForTimeout(600);

  // Navigate to display
  await page.goto(`${baseUrl}/display`);
  await page.waitForTimeout(1000);

  saveIfChanged('screenshots/11-external-display.png', await page.screenshot());
});

test('12-racer-profile-with-photo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Final Standings' });

  // Complete 12 heats (same setup as 09-standings)
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 12 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-standings"]');
  await page.waitForTimeout(600);

  // Click Dean Kim (car #1, has photo)
  await page.click('[data-testid="standing-card-1"]');
  await page.waitForTimeout(1000);

  saveIfChanged('screenshots/12-racer-profile-with-photo.png', await page.screenshot());
});

test('13-racer-profile-no-photo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Final Standings' });

  // Complete 12 heats (same setup as 09-standings)
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 12 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.click('[data-testid="nav-standings"]');
  await page.waitForTimeout(600);

  // Click Lyile Bowers (car #2, no photo)
  await page.click('[data-testid="standing-card-2"]');
  await page.waitForTimeout(1000);

  saveIfChanged('screenshots/13-racer-profile-no-photo.png', await page.screenshot());
});

test('14-certificate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Final Standings' });

  // Complete 12 heats
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < 12 && h < heats.length; h++) {
    const heatId = heats[h].id;
    await fetch(`${baseUrl}/api/heats/${heatId}/start`, { method: 'POST' });
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
    await fetch(`${baseUrl}/api/heats/${heatId}/complete`, { method: 'POST' });
  }

  // Mark event complete so certificates are accessible
  await fetch(`${baseUrl}/api/events/${event.id}/end-race`, { method: 'POST' });

  await page.goto(`${baseUrl}/certificates`);
  await page.waitForTimeout(1500);

  saveIfChanged('screenshots/14-certificate.png', await page.screenshot());
});

/** Seed an event, generate heats with extra rounds, complete them all in a loop
 *  (the planner queues heats progressively), and end the race.
 *  Returns the event and racers array. Each racer will have ~rounds history entries. */
async function seedCompletedRace(name: string, rounds: number, customRacers?: typeof racers) {
  const event = await seedEvent({ name, ...(customRacers ? { racers: customRacers } : {}) });

  // Re-generate heats with more rounds
  await fetch(`${baseUrl}/api/events/${event.id}/heats`, { method: 'DELETE' });
  await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rounds }),
  });

  // Complete heats in a loop — planner generates new heats as earlier ones finish
  let completed = 0;
  for (let pass = 0; pass < 20; pass++) {
    const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
    const heats = await heatsRes.json();
    const pending = heats.filter((h: any) => h.status === 'pending');
    if (pending.length === 0) break;

    for (const heat of pending) {
      const h = completed;
      await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: 'POST' });
      const results = heat.lanes.map((lane: any, idx: number) => ({
        lane_number: lane.lane_number,
        racer_id: lane.racer_id,
        place: ((idx + h) % 4) + 1,
        time_ms: 3200 + Math.round(Math.sin(h * 1.7 + idx * 2.3) * 400 + idx * 80),
      }));
      await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
      await fetch(`${baseUrl}/api/heats/${heat.id}/complete`, { method: 'POST' });
      completed++;
    }
  }

  await fetch(`${baseUrl}/api/events/${event.id}/end-race`, { method: 'POST' });

  const racersRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`);
  const eventRacers = await racersRes.json();
  return { event, racers: eventRacers };
}

// 6 racers on 4 lanes → ~2 heats per round (manageable table)
const sixRacers = [
  { name: 'Dean Kim',         den: 'Wolves',  hasPhoto: true },
  { name: 'Klara Kny-Flores', den: 'Webelos', hasPhoto: true },
  { name: 'Flora Kny-Flores', den: 'Tigers',  hasPhoto: true },
  { name: 'Liam Chen',        den: 'Bears',   hasPhoto: true },
  { name: 'Nate McShreedy',   den: 'Wolves',  hasPhoto: false },
  { name: 'Olivia Park',      den: 'Webelos', hasPhoto: false },
];

test('15-certificate-results-card', async ({ page }) => {
  test.setTimeout(15000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { event, racers: eventRacers } = await seedCompletedRace('Results Card Demo', 1, sixRacers);

  await page.goto(`${baseUrl}/certificate/${eventRacers[0].id}`);
  await page.waitForSelector('[data-testid="certificate"]');
  await page.click('text=Cert + Results');
  await page.waitForSelector('[data-testid="results-card"]');
  await page.waitForTimeout(500);

  // Scroll to show the results card
  await page.evaluate(() => {
    document.querySelector('[data-testid="results-card"]')?.scrollIntoView();
  });
  await page.waitForTimeout(300);

  saveIfChanged('screenshots/15-certificate-results-card.png', await page.screenshot());
});

test('16-certificate-combined', async ({ page }) => {
  test.setTimeout(15000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { event, racers: eventRacers } = await seedCompletedRace('Combined Cert Demo', 1, sixRacers);

  await page.goto(`${baseUrl}/certificate/${eventRacers[0].id}`);
  await page.waitForSelector('[data-testid="certificate"]');
  await page.click('text=Combined');
  await page.waitForSelector('[data-testid="combined-certificate"]');
  await page.waitForTimeout(500);

  saveIfChanged('screenshots/16-certificate-combined.png', await page.screenshot());
});

test('17-info-overview', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Info Page Demo' });

  // Select event then go to info page
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.goto(`${baseUrl}/info`);
  await page.waitForTimeout(400);

  saveIfChanged('screenshots/17-info-overview.png', await page.screenshot({ fullPage: true }));
});

test('18-info-scheduling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Info Scheduling Demo' });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.goto(`${baseUrl}/info`);
  await page.waitForTimeout(300);

  // Click the Heat Scheduling sidebar button
  await page.locator('nav button', { hasText: 'Heat Scheduling' }).click();
  await page.waitForTimeout(300);

  saveIfChanged('screenshots/18-info-scheduling.png', await page.screenshot({ fullPage: true }));
});

test('20-event-setup', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`${baseUrl}/new`);
  await page.waitForTimeout(300);

  // Fill in some example data so the form looks populated
  await page.fill('input[placeholder="Pack 152 Pinewood Derby 2026"]', 'Pack 152 Pinewood Derby 2026');
  await page.waitForTimeout(200);

  saveIfChanged('screenshots/20-event-setup.png', await page.screenshot({ fullPage: true }));
});

test('21-event-edit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // Create an event with awards to edit
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Pack 152 Pinewood Derby 2026',
      date: '2026-03-15',
      lane_count: 4,
      organization: 'Cub Scouts of America',
    }),
  });
  const event = await eventRes.json();

  // Set up some awards
  await fetch(`${baseUrl}/api/events/${event.id}/awards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      awards: [
        { name: 'Most Creative', allow_second: true, allow_third: false },
        { name: 'Best Build Quality', allow_second: false, allow_third: false },
      ],
    }),
  });

  await page.goto(`${baseUrl}/event/${event.id}/edit`);
  await page.waitForTimeout(600);

  // Verify it loaded in edit mode
  await page.locator('text=Edit Event').waitFor();

  saveIfChanged('screenshots/21-event-edit.png', await page.screenshot({ fullPage: true }));
});

test('19-info-standings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent({ name: 'Info Standings Demo' });

  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card-${event.id}"]`);
  await page.goto(`${baseUrl}/info`);
  await page.waitForTimeout(300);

  // Click the Standings & Ranking sidebar button
  await page.locator('nav button', { hasText: 'Standings & Ranking' }).click();
  await page.waitForTimeout(300);

  saveIfChanged('screenshots/19-info-standings.png', await page.screenshot({ fullPage: true }));
});

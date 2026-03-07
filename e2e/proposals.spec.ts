import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

const racers = [
  { name: 'Dean Kim',         den: 'Wolves',   hasPhoto: true  },
  { name: 'Lyile Bowers',     den: 'Bears',    hasPhoto: false },
  { name: 'Klara Kny-Flores', den: 'Webelos',  hasPhoto: true  },
  { name: 'Rio Kny-Flores',   den: 'Lions',    hasPhoto: false },
];

async function seedEvent() {
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Proposals Event', date: '2026-03-15', lane_count: 4 }),
  });
  const event = await eventRes.json();

  const photoPath = path.join(import.meta.dirname, '../tests/assets/car1.jpg');

  for (const data of racers) {
    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, den: data.den }),
    });
    const racer = await racerRes.json();
    
    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    if (data.hasPhoto && fs.existsSync(photoPath)) {
      const photoBuffer = fs.readFileSync(photoPath);
      const formData = new FormData();
      formData.append("photo", new Blob([photoBuffer], { type: "image/jpeg" }), "car.jpg");
      await fetch(`${baseUrl}/api/racers/${racer.id}/photo`, { method: "POST", body: formData });
    }
  }

  await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();
  
  // Complete one heat
  const results = heats[0].lanes.map((lane: any, idx: number) => ({
    lane_number: lane.lane_number,
    racer_id: lane.racer_id,
    place: idx + 1,
    time_ms: 3000 + (idx * 100)
  }));
  await fetch(`${baseUrl}/api/heats/${heats[0].id}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });

  return event;
}

test('proposal-racer-profile-with-photo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  
  // Click Dean Kim (has photo)
  await page.click('[data-testid="car-number-1"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/proposals/racer-profile-with-photo.png' });
});

test('proposal-racer-profile-no-photo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  
  // Click Lyile Bowers (no photo)
  await page.click('[data-testid="car-number-2"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/proposals/racer-profile-no-photo.png' });
});

test('proposal-heats-winners', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const event = await seedEvent();
  await page.goto(`${baseUrl}/`);
  await page.click(`[data-testid="event-card"]:has-text("${event.name}")`);
  await page.click('[data-testid="nav-heats"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/proposals/heats-with-winners.png', fullPage: true });
});

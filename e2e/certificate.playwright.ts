import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const PORT = 3001;
const baseUrl = `http://localhost:${PORT}`;

// Racers across multiple dens for den ranking tests.
// We need enough racers to test: overall podium, top-10, den champion, bottom-of-den.
const racers = [
  { name: 'Dean Kim',         den: 'Wolves',  hasPhoto: true  },
  { name: 'Lyile Bowers',     den: 'Bears',    hasPhoto: false },
  { name: 'Klara Kny-Flores', den: 'Webelos',  hasPhoto: true  },
  { name: 'Rio Kny-Flores',   den: 'Lions',    hasPhoto: false },
  { name: 'Flora Kny-Flores', den: 'Tigers',   hasPhoto: true  },
  { name: 'Nate McShreedy',   den: 'Wolves',   hasPhoto: false },
  { name: 'Liam Chen',        den: 'Bears',    hasPhoto: false },
  { name: 'Olivia Park',      den: 'Wolves',   hasPhoto: false },
  { name: 'Noah Martinez',    den: 'Wolves',   hasPhoto: false },
  { name: 'Emma Johnson',     den: 'Wolves',   hasPhoto: false },
  { name: 'Ava Williams',     den: 'Wolves',   hasPhoto: false },
  { name: 'Sophie Brown',     den: 'Wolves',   hasPhoto: false },
];

interface SeedResult {
  event: { id: string; name: string };
  racerIds: string[];
}

async function seedAndComplete(): Promise<SeedResult> {
  // Create event
  const eventRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Certificate Test Derby',
      date: '2026-03-15',
      lane_count: 4,
    }),
  });
  const event = await eventRes.json();

  const photoPaths = [
    path.join(import.meta.dirname, '../tests/assets/car1.jpg'),
    path.join(import.meta.dirname, '../tests/assets/car2.jpg'),
    path.join(import.meta.dirname, '../tests/assets/car3.jpg'),
  ];

  // Create racers
  const racerIds: string[] = [];
  let photoIndex = 0;
  for (const data of racers) {
    const racerRes = await fetch(`${baseUrl}/api/events/${event.id}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, den: data.den }),
    });
    const racer = await racerRes.json();
    racerIds.push(racer.id);

    // Inspect
    await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_ok: true }),
    });

    // Photo
    if (data.hasPhoto) {
      const photoPath = photoPaths[photoIndex % photoPaths.length]!;
      if (fs.existsSync(photoPath)) {
        const photoBuffer = fs.readFileSync(photoPath);
        const formData = new FormData();
        formData.append('photo', new Blob([photoBuffer], { type: 'image/jpeg' }), path.basename(photoPath));
        await fetch(`${baseUrl}/api/racers/${racer.id}/photo`, {
          method: 'POST',
          body: formData,
        });
        photoIndex++;
      }
    }
  }

  // Generate heats
  await fetch(`${baseUrl}/api/events/${event.id}/generate-heats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  // Complete heats — vary placements so standings spread out
  const heatsRes = await fetch(`${baseUrl}/api/events/${event.id}/heats`);
  const heats = await heatsRes.json();

  for (let h = 0; h < Math.min(12, heats.length); h++) {
    const heat = heats[h];
    await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: 'POST' });
    const results = heat.lanes.map((lane: any, idx: number) => ({
      lane_number: lane.lane_number,
      racer_id: lane.racer_id,
      place: ((idx + h) % 4) + 1,
    }));
    await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
  }

  // Ensure event is marked complete so certificates are accessible
  await fetch(`${baseUrl}/api/events/${event.id}/end-race`, { method: 'POST' });

  return { event, racerIds };
}

test.describe('Certificate Page', () => {
  let seed: SeedResult;

  test.beforeAll(async () => {
    seed = await seedAndComplete();
  });

  test('single certificate loads with racer name and event name', async ({ page }) => {
    const racerId = seed.racerIds[0]; // Dean Kim
    await page.goto(`${baseUrl}/certificate/${racerId}`);
    await page.waitForSelector('[data-testid="certificate"]');

    await expect(page.locator('[data-testid="certificate-racer-name"]')).toContainText('Dean Kim');
    await expect(page.locator('[data-testid="certificate-event-name"]')).toBeVisible();
  });

  test('batch certificates page loads with multiple certificates', async ({ page }) => {
    await page.goto(`${baseUrl}/certificates`);
    await page.waitForSelector('[data-testid="certificate"]');

    const certs = page.locator('[data-testid="certificate"]');
    await expect(certs).toHaveCount(racers.length);
  });

  test('overall top 3 racer shows placement headline', async ({ page }) => {
    // Get standings to find who's 1st
    const standingsRes = await fetch(`${baseUrl}/api/events/${seed.event.id}/standings`);
    const standings = await standingsRes.json();
    const firstPlaceId = standings[0]?.racer_id;
    expect(firstPlaceId).toBeTruthy();

    await page.goto(`${baseUrl}/certificate/${firstPlaceId}`);
    await page.waitForSelector('[data-testid="certificate"]');

    await expect(page.locator('[data-testid="certificate-headline"]')).toContainText('1st Place');
  });

  test('den image is displayed for racer with den', async ({ page }) => {
    // Dean Kim (index 0) is in Wolves den
    const racerId = seed.racerIds[0];
    await page.goto(`${baseUrl}/certificate/${racerId}`);
    await page.waitForSelector('[data-testid="certificate"]');

    const img = page.locator('[data-testid="certificate"] img[alt="Wolves"]');
    await expect(img.first()).toBeVisible();
  });

  test('print button is visible', async ({ page }) => {
    await page.goto(`${baseUrl}/certificates`);
    await page.waitForSelector('[data-testid="certificate"]');

    await expect(page.locator('[data-testid="btn-print"]')).toBeVisible();
  });

  test('den champion outside top 10 shows "Fastest <den>" headline', async ({ page }) => {
    // Seed a separate small event where we control placements precisely:
    // 11 Wolves + 1 Bear → Bear guaranteed to be outside top 10 and den champion
    const evRes = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Den Champion Test', date: '2026-04-01', lane_count: 4 }),
    });
    const ev = await evRes.json();

    const ids: string[] = [];
    const denChampionRacers = [
      ...Array.from({ length: 11 }, (_, i) => ({ name: `Wolf ${i + 1}`, den: 'Wolves' })),
      { name: 'Lone Bear', den: 'Bears' },
    ];
    for (const r of denChampionRacers) {
      const res = await fetch(`${baseUrl}/api/events/${ev.id}/racers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      });
      const created = await res.json();
      ids.push(created.id);
      await fetch(`${baseUrl}/api/racers/${created.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_ok: true }),
      });
    }

    // Generate and complete heats — Bear always gets last place
    await fetch(`${baseUrl}/api/events/${ev.id}/generate-heats`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const heatsRes = await fetch(`${baseUrl}/api/events/${ev.id}/heats`);
    const evHeats = await heatsRes.json();
    const bearId = ids[ids.length - 1]!;

    for (const heat of evHeats) {
      await fetch(`${baseUrl}/api/heats/${heat.id}/start`, { method: 'POST' });
      const results = heat.lanes.map((lane: any, idx: number) => ({
        lane_number: lane.lane_number,
        racer_id: lane.racer_id,
        // Bear always gets last place in their heat
        place: lane.racer_id === bearId ? heat.lanes.length : idx + 1,
      }));
      await fetch(`${baseUrl}/api/heats/${heat.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
    }

    await fetch(`${baseUrl}/api/events/${ev.id}/end-race`, { method: 'POST' });

    await page.goto(`${baseUrl}/certificate/${bearId}`);
    await page.waitForSelector('[data-testid="certificate"]');
    await expect(page.locator('[data-testid="certificate-headline"]')).toContainText('Fastest Bear');
  });
});

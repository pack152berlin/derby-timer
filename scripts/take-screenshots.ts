import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

async function takeScreenshots() {
  const PORT = 3001;
  const baseUrl = `http://localhost:${PORT}`;
  
  mkdirSync('screenshots', { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 }
  });

  // 1. Create a test event
  console.log('Creating test event...');
  const eventResponse = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'UX Showcase Derby', date: '2026-03-01', lane_count: 4 }),
  });
  const event = await eventResponse.json();
  const eventId = event.id;

  // 2. Seed various racers
  console.log('Seeding racers...');
  const samplePhoto = readFileSync('docs/ui-examples/burgerderby.webp');

  const racers = [
    { name: 'Alice Adventure', den: 'Wolves', inspected: true, withPhoto: true },
    { name: 'Bob Builder', den: 'Tigers', inspected: false, withPhoto: false },
    { name: 'Charlie Champion', den: 'Bears', inspected: true, withPhoto: false },
    { name: 'Daisy Driver', den: 'Lions', inspected: false, withPhoto: true },
  ];

  for (const r of racers) {
    const rRes = await fetch(`${baseUrl}/api/events/${eventId}/racers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: r.name, den: r.den }),
    });
    const racer = await rRes.json();

    if (r.inspected) {
      await fetch(`${baseUrl}/api/racers/${racer.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_ok: true }),
      });
    }

    if (r.withPhoto) {
      const formData = new FormData();
      formData.append('photo', new Blob([samplePhoto], { type: 'image/webp' }), 'car.webp');
      await fetch(`${baseUrl}/api/racers/${racer.id}/photo`, {
        method: 'POST',
        body: formData,
      });
    }
  }

  // 3. Navigation
  await page.goto(`${baseUrl}/register`);
  await page.click(`text=${event.name}`);
  await page.waitForTimeout(1000);

  // 4. Index Page (List View)
  console.log('Capturing Index Page...');
  await page.screenshot({ path: 'screenshots/01-registration-index.png' });

  // 5. Help Modal
  console.log('Capturing Help Modal...');
  await page.click('button:has-text("Help")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/02-help-modal.png' });
  await page.keyboard.press('Escape');

  // 6. Add Racer Form
  console.log('Capturing Add Racer Form...');
  await page.click('text=Add Racer');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/03-add-racer-form.png' });

  // 7. Success Modal
  console.log('Capturing Success Modal...');
  await page.fill('input[placeholder="Johnny Smith"]', 'Newest Racer');
  await page.click('[data-slot="select-trigger"]:has-text("Select Den")');
  await page.click('text=Webelos');
  await page.click('button:has-text("Add Racer")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/04-registration-success.png' });
  await page.click('text=Close');

  // 8. Photo Removal Modal
  console.log('Capturing Photo Removal Modal...');
  // Find a racer card with a photo and click the delete photo button
  // In our seed, Alice (first one) has a photo
  await page.click('button:has-text("Delete Photo")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/05-photo-removal-modal.png' });
  await page.click('text=Cancel');

  // 9. Racer Deletion Modal
  console.log('Capturing Racer Deletion Modal...');
  await page.click('button[title="Delete Racer"] >> nth=0');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/06-racer-deletion-modal.png' });

  await browser.close();
  console.log('Screenshots saved to screenshots/ directory.');
}

takeScreenshots().catch(console.error);

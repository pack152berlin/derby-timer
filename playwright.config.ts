import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.playwright.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  // Set timeout to 5s. Most tests should complete in under 3s.
  timeout: 5000,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/screenshots.playwright.ts', '**/auth-ui-gating.playwright.ts', '**/auth-private-mode.playwright.ts'],
    },
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth-ui-gating.playwright.ts',
    },
    {
      name: 'private',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth-private-mode.playwright.ts',
    },
    {
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/screenshots.playwright.ts',
    },
  ],
});

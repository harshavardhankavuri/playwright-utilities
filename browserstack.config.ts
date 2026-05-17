/**
 * BrowserStack Playwright Configuration
 *
 * This config enables running Playwright tests on BrowserStack's real device cloud.
 * Supports: Android (Chrome), iPhone (Safari/WebKit), Windows (Chrome/Edge/Firefox)
 *
 * Prerequisites:
 *   - Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables
 *   - Or update the credentials below
 *
 * Usage:
 *   npx playwright test --config=browserstack.config.ts
 *   npx playwright test --config=browserstack.config.ts --project="BS iPhone 15"
 *   npx playwright test --config=browserstack.config.ts --project="BS Pixel 8"
 */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific config
const envFile = process.env.ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, 'env', `.env.${envFile}`) });

// BrowserStack credentials
const BROWSERSTACK_USERNAME = process.env.BROWSERSTACK_USERNAME || 'YOUR_USERNAME';
const BROWSERSTACK_ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY || 'YOUR_ACCESS_KEY';

// BrowserStack WebSocket endpoint
const BS_CDP_ENDPOINT = `wss://cdp.browserstack.com/playwright?caps=`;

/**
 * Build a BrowserStack capabilities URL for connecting via CDP.
 */
function buildBSEndpoint(caps: Record<string, unknown>): string {
  const capsJson = JSON.stringify({
    ...caps,
    'browserstack.username': BROWSERSTACK_USERNAME,
    'browserstack.accessKey': BROWSERSTACK_ACCESS_KEY,
    'client.playwrightVersion': require('@playwright/test/package.json').version,
  });
  return `${BS_CDP_ENDPOINT}${encodeURIComponent(capsJson)}`;
}

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 5, // BrowserStack supports parallel sessions based on your plan
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright'],
  ],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.BASE_URL || 'https://playwright.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // ─── Windows Real Devices ───────────────────────────────────────────
    {
      name: 'BS Chrome Windows',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'chrome',
            browser_version: 'latest',
            os: 'Windows',
            os_version: '11',
            name: 'Playwright Chrome Windows',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
            'browserstack.networkLogs': true,
            'browserstack.console': 'info',
          }),
        },
      },
    },
    {
      name: 'BS Edge Windows',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'edge',
            browser_version: 'latest',
            os: 'Windows',
            os_version: '11',
            name: 'Playwright Edge Windows',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
      },
    },
    {
      name: 'BS Firefox Windows',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'playwright-firefox',
            os: 'Windows',
            os_version: '11',
            name: 'Playwright Firefox Windows',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
      },
    },

    // ─── iPhone Real Devices (WebKit/Safari) ────────────────────────────
    {
      name: 'BS iPhone 15',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'playwright-webkit',
            os: 'osx',
            os_version: 'Sonoma',
            name: 'Playwright iPhone 15',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
        ...devices['iPhone 15'],
      },
    },
    {
      name: 'BS iPhone 14',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'playwright-webkit',
            os: 'osx',
            os_version: 'Ventura',
            name: 'Playwright iPhone 14',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'BS iPad Pro',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'playwright-webkit',
            os: 'osx',
            os_version: 'Sonoma',
            name: 'Playwright iPad Pro',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
        ...devices['iPad Pro 11'],
      },
    },

    // ─── Android Real Devices (Chrome) ──────────────────────────────────
    {
      name: 'BS Pixel 8',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'chrome',
            browser_version: 'latest',
            os: 'Windows',
            os_version: '11',
            name: 'Playwright Pixel 8',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'BS Galaxy S23',
      use: {
        connectOptions: {
          wsEndpoint: buildBSEndpoint({
            browser: 'chrome',
            browser_version: 'latest',
            os: 'Windows',
            os_version: '11',
            name: 'Playwright Galaxy S23',
            build: `PW Build - ${new Date().toISOString().split('T')[0]}`,
          }),
        },
        ...devices['Galaxy S9+'],
      },
    },
  ],
});

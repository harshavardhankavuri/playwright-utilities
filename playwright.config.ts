import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import xrayConfig from './src/main/utils/xray/xray.config';

/**
 * Load environment-specific .env file from the env/ directory.
 * Usage: ENV=qa npx playwright test (defaults to 'dev')
 */
const envFile = process.env.ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, 'env', `.env.${envFile}`) });

/**
 * Report mode:
 *   - 'full' (default): all reporters + trace/video/screenshot on failure
 *   - 'single': allure-only reporter (use report:allure:generate:single to exclude traces from HTML)
 *
 * Usage: REPORT_MODE=single npx playwright test
 */
const reportMode = process.env.REPORT_MODE || 'full';
const isSingleReport = reportMode === 'single';

// Reporters based on mode
const reporters: any[] = isSingleReport
  ? [
      ['list'],
      ['html', { open: 'never', outputFolder: 'reports/html' }],
      ['allure-playwright', { outputFolder: 'allure-results' }],
    ]
  : [
      ['list'],
      ['html', { open: 'never', outputFolder: 'reports/html' }],
      ['allure-playwright', { outputFolder: 'allure-results' }],
      ['./src/main/utils/xray/reporter/xrayReporter.ts', xrayConfig],
    ];

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: reporters,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.BASE_URL || 'https://playwright.dev',
    // Trace is ALWAYS generated (stored in allure-results for debugging)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});

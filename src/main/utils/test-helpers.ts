import { type Page } from '@playwright/test';

/**
 * Wait for a specific amount of time (use sparingly, prefer explicit waits).
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Take a screenshot with a descriptive name.
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Generate a random string for test data.
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random email for test data.
 */
export function randomEmail(domain: string = 'test.com'): string {
  return `user_${randomString(6)}@${domain}`;
}

import { type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Wait for a specific amount of time (use sparingly, prefer explicit waits).
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Take a screenshot with a descriptive name.
 * Automatically creates the output directory if it doesn't exist.
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { dir?: string; fullPage?: boolean },
): Promise<string> {
  const dir = options?.dir ?? 'test-results/screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: options?.fullPage ?? true });
  return filePath;
}

/**
 * Generate a random alphanumeric string for test data.
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
 * Generate a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random email for test data.
 */
export function randomEmail(domain: string = 'test.com'): string {
  return `user_${randomString(6)}@${domain}`;
}

/**
 * Generate a random UUID v4.
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Convert a string to a URL-safe slug.
 * Useful for generating test IDs or file names from test titles.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Retry a synchronous function until it returns a truthy value or times out.
 * Useful for polling conditions that don't involve Playwright actions.
 */
export async function pollUntil<T>(
  fn: () => T | Promise<T>,
  options?: { timeout?: number; interval?: number },
): Promise<T> {
  const timeout = options?.timeout ?? 10_000;
  const interval = options?.interval ?? 250;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await delay(interval);
  }

  throw new Error(`pollUntil timed out after ${timeout}ms`);
}

/**
 * Chunk an array into smaller arrays of a given size.
 * Useful for batching API calls or processing large datasets in tests.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Deep clone a plain object (no functions, no circular refs).
 * Useful for creating isolated copies of test data objects.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from an object.
 * Useful for extracting only the fields you need from API responses.
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce(
    (acc, key) => {
      if (key in obj) acc[key] = obj[key];
      return acc;
    },
    {} as Pick<T, K>,
  );
}

/**
 * Omit specific keys from an object.
 * Useful for removing dynamic fields (timestamps, IDs) before comparison.
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result as Omit<T, K>;
}

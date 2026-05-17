import { type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Auth Helpers — Storage state management for authenticated sessions.
 *
 * Playwright best practice: authenticate once, save state, reuse across tests.
 * This avoids logging in before every test and speeds up execution significantly.
 */

const DEFAULT_STATE_DIR = path.resolve('.auth');

/**
 * Save the current browser context's storage state (cookies, localStorage)
 * to a file for reuse in other tests.
 *
 * Usage (in a setup/global fixture):
 *   await saveAuthState(page, 'admin');
 *   // Later in tests:
 *   test.use({ storageState: getAuthStatePath('admin') });
 */
export async function saveAuthState(
  page: Page,
  name: string,
  options?: { dir?: string },
): Promise<string> {
  const dir = options?.dir || DEFAULT_STATE_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${name}.json`);
  await page.context().storageState({ path: filePath });
  return filePath;
}

/**
 * Get the file path for a saved auth state.
 */
export function getAuthStatePath(name: string, options?: { dir?: string }): string {
  const dir = options?.dir || DEFAULT_STATE_DIR;
  return path.join(dir, `${name}.json`);
}

/**
 * Check if an auth state file exists.
 */
export function hasAuthState(name: string, options?: { dir?: string }): boolean {
  return fs.existsSync(getAuthStatePath(name, options));
}

/**
 * Perform a login flow and save the authenticated state.
 * Reusable login helper that can be customized per project.
 *
 * Usage:
 *   await loginAndSave(page, {
 *     url: '/login',
 *     username: 'admin@test.com',
 *     password: 'password123',
 *     usernameSelector: '#email',
 *     passwordSelector: '#password',
 *     submitSelector: 'button[type="submit"]',
 *     successUrl: /dashboard/,
 *     stateName: 'admin',
 *   });
 */
export async function loginAndSave(
  page: Page,
  config: {
    url: string;
    username: string;
    password: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    successUrl?: string | RegExp;
    stateName: string;
    stateDir?: string;
  },
): Promise<string> {
  await page.goto(config.url);

  const usernameField = config.usernameSelector || '[name="username"], [name="email"], #username, #email';
  const passwordField = config.passwordSelector || '[name="password"], #password';
  const submitBtn = config.submitSelector || 'button[type="submit"], input[type="submit"]';

  await page.locator(usernameField).fill(config.username);
  await page.locator(passwordField).fill(config.password);
  await page.locator(submitBtn).click();

  if (config.successUrl) {
    await page.waitForURL(config.successUrl);
  } else {
    await page.waitForLoadState('networkidle');
  }

  return saveAuthState(page, config.stateName, { dir: config.stateDir });
}

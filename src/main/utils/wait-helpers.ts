import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait Helpers — Common wait patterns for Playwright tests.
 *
 * These complement Playwright's built-in auto-waiting with higher-level
 * patterns for complex scenarios (API responses, animations, DOM stability).
 */

/**
 * Wait for a network response matching a URL pattern and return its JSON body.
 * Useful for waiting on API calls triggered by user actions.
 *
 * Usage:
 *   const data = await waitForApiResponse(page, '/api/users', async () => {
 *     await page.click('button#load-users');
 *   });
 */
export async function waitForApiResponse<T = unknown>(
  page: Page,
  urlPattern: string | RegExp,
  triggerAction: () => Promise<void>,
  options?: { timeout?: number; status?: number },
): Promise<T> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => {
        const urlMatch = typeof urlPattern === 'string'
          ? res.url().includes(urlPattern)
          : urlPattern.test(res.url());
        const statusMatch = options?.status ? res.status() === options.status : res.ok();
        return urlMatch && statusMatch;
      },
      { timeout: options?.timeout ?? 15_000 },
    ),
    triggerAction(),
  ]);
  return response.json() as Promise<T>;
}

/**
 * Wait for the page to reach a stable state (no pending network requests).
 * Useful after complex interactions that trigger multiple API calls.
 */
export async function waitForNetworkIdle(
  page: Page,
  options?: { timeout?: number; idleTime?: number },
): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Additional idle time to ensure all async rendering is complete
  if (options?.idleTime) {
    await page.waitForTimeout(options.idleTime);
  }
}

/**
 * Wait for an element to become stable (no layout shifts) before interacting.
 * Checks that the element's bounding box doesn't change over a short interval.
 */
export async function waitForElementStable(
  locator: Locator,
  options?: { timeout?: number; interval?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 5_000;
  const interval = options?.interval ?? 200;
  const startTime = Date.now();

  let lastBox = await locator.boundingBox();

  while (Date.now() - startTime < timeout) {
    await new Promise((r) => setTimeout(r, interval));
    const currentBox = await locator.boundingBox();

    if (
      lastBox &&
      currentBox &&
      lastBox.x === currentBox.x &&
      lastBox.y === currentBox.y &&
      lastBox.width === currentBox.width &&
      lastBox.height === currentBox.height
    ) {
      return; // Stable
    }
    lastBox = currentBox;
  }
}

/**
 * Wait for a specific number of elements to appear.
 * Useful for lists that load incrementally.
 */
export async function waitForCount(
  locator: Locator,
  count: number,
  options?: { timeout?: number },
): Promise<void> {
  await expect(locator).toHaveCount(count, { timeout: options?.timeout ?? 10_000 });
}

/**
 * Retry an action until it succeeds or times out.
 * Useful for flaky interactions that may need multiple attempts.
 *
 * Usage:
 *   await retryAction(async () => {
 *     await page.click('button#submit');
 *     await expect(page.locator('.success')).toBeVisible();
 *   }, { retries: 3, delay: 1000 });
 */
export async function retryAction(
  action: () => Promise<void>,
  options?: { retries?: number; delay?: number },
): Promise<void> {
  const retries = options?.retries ?? 3;
  const delay = options?.delay ?? 500;
  let lastError: Error | undefined;

  for (let i = 0; i <= retries; i++) {
    try {
      await action();
      return;
    } catch (error) {
      lastError = error as Error;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Wait for a URL to match a pattern (useful after navigation/redirects).
 */
export async function waitForUrl(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for a download to complete and return the file path.
 */
export async function waitForDownload(
  page: Page,
  triggerAction: () => Promise<void>,
  options?: { saveDir?: string; timeout?: number },
): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: options?.timeout ?? 30_000 }),
    triggerAction(),
  ]);

  const filePath = options?.saveDir
    ? `${options.saveDir}/${download.suggestedFilename()}`
    : await download.path();

  if (options?.saveDir) {
    await download.saveAs(filePath!);
  }

  return filePath!;
}

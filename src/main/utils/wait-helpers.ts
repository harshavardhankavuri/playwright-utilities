import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait Helpers — Common wait patterns for Playwright tests.
 *
 * These complement Playwright's built-in auto-waiting with higher-level
 * patterns for complex scenarios (API responses, animations, DOM stability).
 *
 * BrowserStack / remote grid note:
 * All waits use explicit timeouts and throw on expiry so tests never hang
 * in a pending state on remote grids. Raw setTimeout loops are avoided in
 * favour of locator.waitFor() which propagates errors correctly over CDP.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENT WAITS  (locator.waitFor() based — safe on BrowserStack)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for an element to reach a specific DOM state.
 *
 * Wraps locator.waitFor() with an explicit timeout so the test always
 * throws (and fails cleanly) rather than hanging on remote grids.
 *
 * States:
 *   'attached'  — element exists in DOM (default)
 *   'detached'  — element removed from DOM
 *   'visible'   — element is visible and not hidden
 *   'hidden'    — element is hidden or detached
 *
 * Usage:
 *   await waitFor(page.locator('.spinner'), 'hidden');
 *   await waitFor(page.locator('.modal'), 'visible', { timeout: 10_000 });
 */
export async function waitFor(
  locator: Locator,
  state: 'attached' | 'detached' | 'visible' | 'hidden' = 'visible',
  options?: { timeout?: number },
): Promise<void> {
  await locator.waitFor({ state, timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for an element to be visible.
 * Shorthand for waitFor(locator, 'visible').
 */
export async function waitForVisible(
  locator: Locator,
  options?: { timeout?: number },
): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for an element to be hidden or removed from the DOM.
 * Shorthand for waitFor(locator, 'hidden').
 *
 * Usage:
 *   await waitForHidden(page.locator('.loading-spinner'));
 */
export async function waitForHidden(
  locator: Locator,
  options?: { timeout?: number },
): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for an element to be attached to the DOM (not necessarily visible).
 * Shorthand for waitFor(locator, 'attached').
 */
export async function waitForAttached(
  locator: Locator,
  options?: { timeout?: number },
): Promise<void> {
  await locator.waitFor({ state: 'attached', timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for an element to be detached from the DOM.
 * Shorthand for waitFor(locator, 'detached').
 *
 * Usage:
 *   await waitForDetached(page.locator('.toast-notification'));
 */
export async function waitForDetached(
  locator: Locator,
  options?: { timeout?: number },
): Promise<void> {
  await locator.waitFor({ state: 'detached', timeout: options?.timeout ?? 15_000 });
}

/**
 * Wait for an element to become stable (no layout shifts) before interacting.
 *
 * Uses locator.waitFor() to confirm the element is attached first, then
 * polls its bounding box. Throws with a clear message if the element never
 * stabilises — prevents silent hangs on BrowserStack.
 */
export async function waitForElementStable(
  locator: Locator,
  options?: { timeout?: number; interval?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 5_000;
  const interval = options?.interval ?? 200;

  // Ensure element is in the DOM before polling — throws if not found
  await locator.waitFor({ state: 'attached', timeout });

  const deadline = Date.now() + timeout;
  let lastBox = await locator.boundingBox();

  while (Date.now() < deadline) {
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

  throw new Error(
    `waitForElementStable: element did not stabilise within ${timeout}ms`,
  );
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
 * Wait for an element to contain specific text (case-insensitive substring match).
 * Useful when you need partial text matching with a custom timeout.
 *
 * Usage:
 *   await waitForText(page.locator('.status'), 'success', { timeout: 15_000 });
 */
export async function waitForText(
  locator: Locator,
  text: string,
  options?: { timeout?: number; ignoreCase?: boolean },
): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  const pattern =
    options?.ignoreCase !== false
      ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : text;
  await expect(locator).toContainText(pattern, { timeout });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE / NETWORK WAITS
// ─────────────────────────────────────────────────────────────────────────────

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
        const urlMatch =
          typeof urlPattern === 'string'
            ? res.url().includes(urlPattern)
            : urlPattern.test(res.url());
        const statusMatch = options?.status
          ? res.status() === options.status
          : res.ok();
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
  await page.waitForLoadState('networkidle', { timeout: options?.timeout ?? 30_000 });
  if (options?.idleTime) {
    await page.waitForTimeout(options.idleTime);
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// POLLING / RETRY WAITS
// ─────────────────────────────────────────────────────────────────────────────

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
 * Wait for a custom condition to become true by polling.
 *
 * Always throws on timeout — prevents tests from hanging on BrowserStack.
 *
 * Usage:
 *   await waitForCondition(async () => {
 *     const count = await page.locator('.item').count();
 *     return count > 5;
 *   }, { timeout: 10_000, interval: 500, message: 'Expected more than 5 items' });
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number; message?: string },
): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  const interval = options?.interval ?? 250;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    options?.message ?? `waitForCondition timed out after ${timeout}ms`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION & TRANSITION WAITS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for all CSS animations and transitions on an element to complete.
 * Useful before taking screenshots or asserting final visual state.
 *
 * Usage:
 *   await waitForAnimation(page.locator('.modal'));
 */
export async function waitForAnimation(
  locator: Locator,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 5_000;
  await locator.waitFor({ state: 'visible', timeout });

  await locator.evaluate((el) => {
    return new Promise<void>((resolve) => {
      const animations = el.getAnimations?.() ?? [];
      if (animations.length === 0) { resolve(); return; }
      Promise.all(animations.map((a) => a.finished)).then(() => resolve()).catch(() => resolve());
    });
  });
}

/**
 * Wait for a localStorage key to have a specific value.
 * Useful for waiting on async operations that store results in localStorage.
 *
 * Usage:
 *   await waitForLocalStorage(page, 'auth_token', (v) => v !== null);
 */
export async function waitForLocalStorage(
  page: Page,
  key: string,
  predicate: (value: string | null) => boolean,
  options?: { timeout?: number; interval?: number },
): Promise<string | null> {
  const timeout = options?.timeout ?? 10_000;
  const interval = options?.interval ?? 250;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const value = await page.evaluate((k) => localStorage.getItem(k), key);
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`waitForLocalStorage: key "${key}" did not satisfy predicate within ${timeout}ms`);
}

/**
 * Wait for a sessionStorage key to have a specific value.
 */
export async function waitForSessionStorage(
  page: Page,
  key: string,
  predicate: (value: string | null) => boolean,
  options?: { timeout?: number; interval?: number },
): Promise<string | null> {
  const timeout = options?.timeout ?? 10_000;
  const interval = options?.interval ?? 250;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const value = await page.evaluate((k) => sessionStorage.getItem(k), key);
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`waitForSessionStorage: key "${key}" did not satisfy predicate within ${timeout}ms`);
}

/**
 * Wait for a specific number of network requests to complete.
 * Useful for waiting on parallel API calls triggered by a single action.
 *
 * Usage:
 *   await waitForRequestCount(page, '/api/data', 3, async () => {
 *     await page.click('#load-all');
 *   });
 */
export async function waitForRequestCount(
  page: Page,
  urlPattern: string | RegExp,
  expectedCount: number,
  triggerAction?: () => Promise<void>,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  let count = 0;

  const handler = (response: any) => {
    const url = response.url();
    const matches = typeof urlPattern === 'string'
      ? url.includes(urlPattern)
      : urlPattern.test(url);
    if (matches) count++;
  };

  page.on('response', handler);

  try {
    if (triggerAction) await triggerAction();

    const deadline = Date.now() + timeout;
    while (count < expectedCount && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (count < expectedCount) {
      throw new Error(
        `waitForRequestCount: expected ${expectedCount} requests to "${urlPattern}", got ${count} within ${timeout}ms`,
      );
    }
  } finally {
    page.off('response', handler);
  }
}

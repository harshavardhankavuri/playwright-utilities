import { type Page, type Locator } from '@playwright/test';

/**
 * Visual Helpers — Utilities for visual testing and debugging.
 *
 * Includes: element highlighting, viewport management, scroll utilities,
 * and console error collection.
 */

/**
 * Highlight an element on the page (useful for debugging/screenshots).
 */
export async function highlightElement(
  locator: Locator,
  options?: { color?: string; duration?: number },
): Promise<void> {
  const color = options?.color || 'red';
  const duration = options?.duration || 3000;

  await locator.evaluate(
    (el, { color, duration }) => {
      const originalOutline = el.style.outline;
      el.style.outline = `3px solid ${color}`;
      setTimeout(() => {
        el.style.outline = originalOutline;
      }, duration);
    },
    { color, duration },
  );
}

/**
 * Scroll an element into the center of the viewport.
 */
export async function scrollToCenter(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });
}

/**
 * Scroll to the bottom of the page (useful for infinite scroll testing).
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
}

/**
 * Scroll to the top of the page.
 */
export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Collect all console errors that occurred on the page.
 * Call this at the start of a test, then check at the end.
 *
 * Usage:
 *   const errors = collectConsoleErrors(page);
 *   // ... do test actions ...
 *   expect(errors.get()).toHaveLength(0);
 */
export function collectConsoleErrors(page: Page): { get: () => string[]; clear: () => void } {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return {
    get: () => [...errors],
    clear: () => { errors.length = 0; },
  };
}

/**
 * Get the current viewport dimensions.
 */
export async function getViewportSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
}

/**
 * Set viewport to common device sizes for responsive testing.
 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  widescreen: { width: 1920, height: 1080 },
} as const;

/**
 * Take a full-page screenshot with a descriptive name and timestamp.
 */
export async function takeFullPageScreenshot(
  page: Page,
  name: string,
  options?: { dir?: string },
): Promise<string> {
  const dir = options?.dir || 'test-results/screenshots';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${dir}/${name}-${timestamp}.png`;
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

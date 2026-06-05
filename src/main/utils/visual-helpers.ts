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

/**
 * Collect all console warnings that occurred on the page.
 *
 * Usage:
 *   const warnings = collectConsoleWarnings(page);
 *   // ... test actions ...
 *   expect(warnings.get()).toHaveLength(0);
 */
export function collectConsoleWarnings(page: Page): { get: () => string[]; clear: () => void } {
  const warnings: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  return {
    get: () => [...warnings],
    clear: () => { warnings.length = 0; },
  };
}

/**
 * Collect all failed network requests (4xx/5xx responses).
 *
 * Usage:
 *   const failures = collectNetworkErrors(page);
 *   // ... test actions ...
 *   expect(failures.get()).toHaveLength(0);
 */
export function collectNetworkErrors(page: Page): {
  get: () => Array<{ url: string; status: number }>;
  clear: () => void;
} {
  const failures: Array<{ url: string; status: number }> = [];

  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.push({ url: response.url(), status: response.status() });
    }
  });

  return {
    get: () => [...failures],
    clear: () => { failures.length = 0; },
  };
}

/**
 * Set the viewport to a specific size or a named preset.
 *
 * Usage:
 *   await setViewport(page, 'mobile');
 *   await setViewport(page, { width: 1280, height: 720 });
 */
export async function setViewport(
  page: Page,
  size: keyof typeof VIEWPORTS | { width: number; height: number },
): Promise<void> {
  const dimensions = typeof size === 'string' ? VIEWPORTS[size] : size;
  await page.setViewportSize(dimensions);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED VISUAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect ALL console messages (log, info, warn, error, debug).
 * Returns a structured collector with filtering capabilities.
 *
 * Usage:
 *   const console = collectAllConsole(page);
 *   // ... test actions ...
 *   const errors = console.getByType('error');
 *   expect(errors).toHaveLength(0);
 */
export function collectAllConsole(page: Page): {
  get: () => Array<{ type: string; text: string; timestamp: number }>;
  getByType: (type: string) => Array<{ type: string; text: string; timestamp: number }>;
  clear: () => void;
  hasErrors: () => boolean;
} {
  const messages: Array<{ type: string; text: string; timestamp: number }> = [];

  page.on('console', (msg) => {
    messages.push({ type: msg.type(), text: msg.text(), timestamp: Date.now() });
  });

  page.on('pageerror', (error) => {
    messages.push({ type: 'pageerror', text: error.message, timestamp: Date.now() });
  });

  return {
    get: () => [...messages],
    getByType: (type) => messages.filter((m) => m.type === type),
    clear: () => { messages.length = 0; },
    hasErrors: () => messages.some((m) => m.type === 'error' || m.type === 'pageerror'),
  };
}

/**
 * Measure the bounding box and computed styles of an element.
 * Useful for layout assertions and responsive design testing.
 *
 * Usage:
 *   const info = await measureElement(page.locator('.hero-banner'));
 *   expect(info.width).toBeGreaterThan(800);
 */
export async function measureElement(locator: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  isVisible: boolean;
  isInViewport: boolean;
}> {
  const box = await locator.boundingBox();
  const isVisible = await locator.isVisible();

  if (!box) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, isVisible: false, isInViewport: false };
  }

  const viewport = await locator.page().viewportSize();
  const isInViewport = viewport
    ? box.x < viewport.width && box.y < viewport.height && box.x + box.width > 0 && box.y + box.height > 0
    : false;

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    left: box.x,
    isVisible,
    isInViewport,
  };
}

/**
 * Scroll to a specific pixel position on the page.
 *
 * Usage:
 *   await scrollTo(page, { x: 0, y: 500 });
 */
export async function scrollTo(
  page: Page,
  position: { x?: number; y?: number },
  options?: { behavior?: 'smooth' | 'instant' },
): Promise<void> {
  await page.evaluate(
    ({ x, y, behavior }) => window.scrollTo({ left: x ?? window.scrollX, top: y ?? window.scrollY, behavior }),
    { x: position.x, y: position.y, behavior: options?.behavior ?? 'instant' },
  );
}

/**
 * Scroll an element into view and wait for it to be stable.
 *
 * Usage:
 *   await scrollIntoView(page.locator('#footer'));
 */
export async function scrollIntoView(
  locator: Locator,
  options?: { block?: 'start' | 'center' | 'end' | 'nearest' },
): Promise<void> {
  await locator.evaluate(
    (el, block) => el.scrollIntoView({ behavior: 'smooth', block }),
    options?.block ?? 'center',
  );
  await locator.page().waitForTimeout(300);
}

/**
 * Get the current scroll position of the page.
 */
export async function getScrollPosition(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
}

/**
 * Check if an element is fully visible within the viewport (not clipped).
 */
export async function isFullyVisible(locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;

  const viewport = await locator.page().viewportSize();
  if (!viewport) return false;

  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height
  );
}

/**
 * Simulate a dark mode preference change.
 *
 * Usage:
 *   await setColorScheme(page, 'dark');
 */
export async function setColorScheme(
  page: Page,
  scheme: 'dark' | 'light' | 'no-preference',
): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
}

/**
 * Simulate a reduced motion preference.
 * Useful for testing animation-disabled states.
 */
export async function setReducedMotion(
  page: Page,
  preference: 'reduce' | 'no-preference',
): Promise<void> {
  await page.emulateMedia({ reducedMotion: preference });
}

/**
 * Simulate a forced colors (high contrast) mode.
 */
export async function setForcedColors(
  page: Page,
  mode: 'active' | 'none',
): Promise<void> {
  await page.emulateMedia({ forcedColors: mode });
}

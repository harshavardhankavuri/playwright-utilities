import { type Page } from '@playwright/test';

/**
 * DateTime Helpers — Utilities for testing date/time pickers, formatting,
 * timezone handling, and time-dependent UI behavior.
 *
 * Covers:
 * - Clock mocking (freeze/advance time)
 * - Date picker interaction helpers
 * - Date formatting and parsing for assertions
 * - Timezone simulation
 */

// ─────────────────────────────────────────────────────────────────────────────
// CLOCK CONTROL (freeze/advance time for deterministic tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Freeze the browser clock at a specific date/time.
 * All calls to Date.now(), new Date(), setTimeout, setInterval will use the frozen time.
 *
 * Usage:
 *   await freezeClock(page, '2025-06-15T10:30:00Z');
 *   // Now page.evaluate(() => new Date().toISOString()) returns '2025-06-15T10:30:00.000Z'
 */
export async function freezeClock(page: Page, dateTime: string | Date): Promise<void> {
  const timestamp = typeof dateTime === 'string' ? new Date(dateTime).getTime() : dateTime.getTime();
  await page.clock.setFixedTime(new Date(timestamp));
}

/**
 * Install a controllable clock starting at a specific time.
 * Unlike freezeClock, this allows you to advance time manually.
 *
 * Usage:
 *   await installClock(page, '2025-01-01T00:00:00Z');
 *   await advanceClock(page, 5000); // advance 5 seconds
 */
export async function installClock(page: Page, dateTime: string | Date): Promise<void> {
  const timestamp = typeof dateTime === 'string' ? new Date(dateTime).getTime() : dateTime.getTime();
  await page.clock.install({ time: new Date(timestamp) });
}

/**
 * Advance the installed clock by a specified number of milliseconds.
 */
export async function advanceClock(page: Page, ms: number): Promise<void> {
  await page.clock.fastForward(ms);
}

/**
 * Resume the clock to real time after freezing/installing.
 */
export async function resumeClock(page: Page): Promise<void> {
  await page.clock.resume();
}

/**
 * Set the clock to a specific time without freezing (time continues to advance from there).
 */
export async function setClockTime(page: Page, dateTime: string | Date): Promise<void> {
  const timestamp = typeof dateTime === 'string' ? new Date(dateTime).getTime() : dateTime.getTime();
  await page.clock.setSystemTime(new Date(timestamp));
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emulate a specific timezone for the browser context.
 * Must be called BEFORE navigating to the page (set in context options).
 *
 * Common timezones: 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'
 *
 * Usage (in playwright.config.ts or fixture):
 *   use: { timezoneId: 'America/New_York' }
 *
 * Or programmatically in a test:
 *   const context = await browser.newContext({ timezoneId: 'Asia/Tokyo' });
 */
export const TIMEZONES = {
  UTC: 'UTC',
  US_EASTERN: 'America/New_York',
  US_CENTRAL: 'America/Chicago',
  US_PACIFIC: 'America/Los_Angeles',
  UK: 'Europe/London',
  CENTRAL_EUROPE: 'Europe/Berlin',
  INDIA: 'Asia/Kolkata',
  JAPAN: 'Asia/Tokyo',
  AUSTRALIA: 'Australia/Sydney',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING & PARSING (for assertions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a date into common display formats for assertion matching.
 */
export function formatDate(date: string | Date, format: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const tokens: Record<string, string> = {
    YYYY: d.getFullYear().toString(),
    YY: d.getFullYear().toString().slice(-2),
    MM: (d.getMonth() + 1).toString().padStart(2, '0'),
    M: (d.getMonth() + 1).toString(),
    DD: d.getDate().toString().padStart(2, '0'),
    D: d.getDate().toString(),
    HH: d.getHours().toString().padStart(2, '0'),
    H: d.getHours().toString(),
    hh: (d.getHours() % 12 || 12).toString().padStart(2, '0'),
    h: (d.getHours() % 12 || 12).toString(),
    mm: d.getMinutes().toString().padStart(2, '0'),
    ss: d.getSeconds().toString().padStart(2, '0'),
    A: d.getHours() >= 12 ? 'PM' : 'AM',
    a: d.getHours() >= 12 ? 'pm' : 'am',
  };

  let result = format;
  // Replace longest tokens first to avoid partial matches
  const sortedKeys = Object.keys(tokens).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    result = result.replace(new RegExp(key, 'g'), tokens[key]);
  }
  return result;
}

/**
 * Get today's date formatted.
 */
export function today(format: string = 'YYYY-MM-DD'): string {
  return formatDate(new Date(), format);
}

/**
 * Get a date relative to today (e.g. +7 days, -30 days).
 */
export function relativeDate(days: number, format: string = 'YYYY-MM-DD'): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d, format);
}

/**
 * Get a date relative to a base date.
 */
export function relativeTo(
  base: string | Date,
  offset: { days?: number; hours?: number; minutes?: number; months?: number; years?: number },
  format: string = 'YYYY-MM-DD',
): string {
  const d = typeof base === 'string' ? new Date(base) : new Date(base.getTime());
  if (offset.years) d.setFullYear(d.getFullYear() + offset.years);
  if (offset.months) d.setMonth(d.getMonth() + offset.months);
  if (offset.days) d.setDate(d.getDate() + offset.days);
  if (offset.hours) d.setHours(d.getHours() + offset.hours);
  if (offset.minutes) d.setMinutes(d.getMinutes() + offset.minutes);
  return formatDate(d, format);
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER INTERACTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill a native HTML date input (<input type="date">).
 * Handles the browser-specific format requirements.
 */
export async function fillDateInput(
  page: Page,
  selector: string,
  date: string | Date,
): Promise<void> {
  const d = typeof date === 'string' ? new Date(date) : date;
  const value = formatDate(d, 'YYYY-MM-DD');
  await page.locator(selector).fill(value);
}

/**
 * Fill a native HTML datetime-local input.
 */
export async function fillDateTimeInput(
  page: Page,
  selector: string,
  dateTime: string | Date,
): Promise<void> {
  const d = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  const value = formatDate(d, 'YYYY-MM-DDTHH:mm');
  await page.locator(selector).fill(value);
}

/**
 * Fill a native HTML time input.
 */
export async function fillTimeInput(
  page: Page,
  selector: string,
  time: string,
): Promise<void> {
  await page.locator(selector).fill(time);
}

/**
 * Select a date in a custom date picker by navigating months and clicking a day.
 * Works with most calendar-style date pickers (Material UI, Ant Design, etc.).
 *
 * Usage:
 *   await selectDateInPicker(page, {
 *     triggerSelector: '#date-field',
 *     targetDate: '2025-03-15',
 *     nextMonthSelector: 'button[aria-label="Next month"]',
 *     prevMonthSelector: 'button[aria-label="Previous month"]',
 *     daySelector: (day) => `button:has-text("${day}")`,
 *     currentMonthSelector: '.MuiPickersCalendarHeader-label',
 *   });
 */
export async function selectDateInPicker(
  page: Page,
  options: {
    /** Selector to click to open the date picker */
    triggerSelector: string;
    /** Target date to select */
    targetDate: string | Date;
    /** Selector for the "next month" navigation button */
    nextMonthSelector: string;
    /** Selector for the "previous month" navigation button */
    prevMonthSelector: string;
    /** Function that returns a selector for a specific day number */
    daySelector: (day: number) => string;
    /** Selector that shows the currently displayed month/year text */
    currentMonthSelector: string;
    /** Maximum number of month navigations before giving up. Default: 24 */
    maxNavigations?: number;
  },
): Promise<void> {
  const target = typeof options.targetDate === 'string'
    ? new Date(options.targetDate)
    : options.targetDate;
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  const targetDay = target.getDate();
  const maxNav = options.maxNavigations ?? 24;

  // Open the picker
  await page.locator(options.triggerSelector).click();

  // Navigate to the correct month
  for (let i = 0; i < maxNav; i++) {
    const monthText = await page.locator(options.currentMonthSelector).textContent();
    if (!monthText) break;

    // Parse the displayed month (handles formats like "March 2025", "Mar 2025", "2025-03")
    const displayedDate = new Date(monthText.trim() + ' 1');
    if (isNaN(displayedDate.getTime())) break;

    const displayedMonth = displayedDate.getMonth();
    const displayedYear = displayedDate.getFullYear();

    if (displayedMonth === targetMonth && displayedYear === targetYear) {
      break; // We're on the right month
    }

    // Determine direction
    const targetTimestamp = new Date(targetYear, targetMonth).getTime();
    const displayedTimestamp = new Date(displayedYear, displayedMonth).getTime();

    if (targetTimestamp > displayedTimestamp) {
      await page.locator(options.nextMonthSelector).click();
    } else {
      await page.locator(options.prevMonthSelector).click();
    }

    await page.waitForTimeout(300); // Wait for animation
  }

  // Click the target day
  await page.locator(options.daySelector(targetDay)).click();
}

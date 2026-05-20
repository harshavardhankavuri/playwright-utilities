import { type Page, type Locator } from '@playwright/test';

/**
 * Keyboard Helpers — Utilities for keyboard navigation and shortcut testing.
 *
 * Covers:
 * - Tab navigation and focus order verification
 * - Keyboard shortcut simulation
 * - Accessible keyboard interaction patterns
 */

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

/** Platform-aware modifier key (Meta on Mac, Control on Windows/Linux). */
export const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * Press a keyboard shortcut using the platform-aware modifier key.
 * Automatically uses Cmd on macOS and Ctrl on Windows/Linux.
 *
 * Usage:
 *   await pressShortcut(page, 'a');   // Ctrl+A / Cmd+A
 *   await pressShortcut(page, 'z');   // Ctrl+Z / Cmd+Z
 *   await pressShortcut(page, 'Shift+z'); // Ctrl+Shift+Z / Cmd+Shift+Z
 */
export async function pressShortcut(page: Page, key: string): Promise<void> {
  await page.keyboard.press(`${MOD}+${key}`);
}

/**
 * Select all text in the focused element.
 */
export async function selectAll(page: Page): Promise<void> {
  await pressShortcut(page, 'a');
}

/**
 * Copy selected content to clipboard.
 */
export async function copy(page: Page): Promise<void> {
  await pressShortcut(page, 'c');
}

/**
 * Paste clipboard content.
 */
export async function paste(page: Page): Promise<void> {
  await pressShortcut(page, 'v');
}

/**
 * Cut selected content.
 */
export async function cut(page: Page): Promise<void> {
  await pressShortcut(page, 'x');
}

/**
 * Undo the last action.
 */
export async function undo(page: Page): Promise<void> {
  await pressShortcut(page, 'z');
}

/**
 * Redo the last undone action.
 */
export async function redo(page: Page): Promise<void> {
  await pressShortcut(page, process.platform === 'darwin' ? 'Shift+z' : 'y');
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Press Tab N times to navigate forward through focusable elements.
 */
export async function tabForward(page: Page, times: number = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Tab');
  }
}

/**
 * Press Shift+Tab N times to navigate backward through focusable elements.
 */
export async function tabBackward(page: Page, times: number = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Shift+Tab');
  }
}

/**
 * Get the currently focused element's accessible name or tag.
 * Useful for asserting focus order in keyboard navigation tests.
 */
export async function getFocusedElementInfo(
  page: Page,
): Promise<{ tag: string; id: string; name: string; role: string; text: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    if (!el) return { tag: 'none', id: '', name: '', role: '', text: '' };
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      name: el.getAttribute('aria-label') || el.getAttribute('name') || '',
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      text: el.textContent?.trim().slice(0, 50) || '',
    };
  });
}

/**
 * Verify the tab order of focusable elements matches the expected sequence.
 * Starts from the currently focused element and tabs through.
 *
 * Usage:
 *   await page.locator('#first-input').focus();
 *   await verifyTabOrder(page, ['#first-input', '#second-input', 'button[type="submit"]']);
 */
export async function verifyTabOrder(
  page: Page,
  expectedSelectors: string[],
): Promise<void> {
  for (let i = 0; i < expectedSelectors.length; i++) {
    const expected = page.locator(expectedSelectors[i]);
    const isFocused = await expected.evaluate((el) => el === document.activeElement);

    if (!isFocused) {
      const focused = await getFocusedElementInfo(page);
      throw new Error(
        `Tab order mismatch at position ${i + 1}.\n` +
          `Expected: ${expectedSelectors[i]}\n` +
          `Focused:  <${focused.tag}> id="${focused.id}" text="${focused.text}"`,
      );
    }

    if (i < expectedSelectors.length - 1) {
      await page.keyboard.press('Tab');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM INTERACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear a field and type new text using keyboard events.
 * More realistic than locator.fill() — triggers keydown/keyup events.
 *
 * Usage:
 *   await typeInto(page.locator('#search'), 'playwright');
 */
export async function typeInto(
  locator: Locator,
  text: string,
  options?: { delay?: number; clearFirst?: boolean },
): Promise<void> {
  await locator.click();
  if (options?.clearFirst !== false) {
    await locator.selectText().catch(() => {
      // selectText may not work on all elements; fall back to Ctrl+A
    });
    await locator.page().keyboard.press(`${MOD}+a`);
    await locator.page().keyboard.press('Delete');
  }
  await locator.pressSequentially(text, { delay: options?.delay ?? 0 });
}

/**
 * Submit a form by pressing Enter in a field.
 */
export async function submitByEnter(locator: Locator): Promise<void> {
  await locator.press('Enter');
}

/**
 * Dismiss a dialog or close a modal by pressing Escape.
 */
export async function pressEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}

/**
 * Navigate a dropdown/listbox using arrow keys.
 *
 * Usage:
 *   await page.locator('select').focus();
 *   await navigateWithArrows(page, 'down', 3); // Move down 3 options
 */
export async function navigateWithArrows(
  page: Page,
  direction: 'up' | 'down' | 'left' | 'right',
  times: number = 1,
): Promise<void> {
  const key = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
  }[direction];

  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
  }
}

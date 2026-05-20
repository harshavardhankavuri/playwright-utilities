import { type Page, type Locator } from '@playwright/test';

/**
 * Keyboard Helpers — Utilities for keyboard navigation and shortcut testing.
 *
 * Covers:
 * - Tab navigation and focus order verification
 * - Keyboard shortcut simulation
 * - Clipboard read/write and paste
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
 *   await pressShortcut(page, 'a');       // Ctrl+A / Cmd+A
 *   await pressShortcut(page, 'z');       // Ctrl+Z / Cmd+Z
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
 * Paste clipboard content into the focused element.
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
// CLIPBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write text directly into the browser clipboard.
 *
 * Uses the Clipboard API via page.evaluate() so it works without OS-level
 * clipboard permissions. Requires the browser context to have
 * `permissions: ['clipboard-read', 'clipboard-write']` granted (Chromium only).
 *
 * For cross-browser / BrowserStack use, prefer setClipboardAndPaste() which
 * falls back to a hidden input technique when the Clipboard API is unavailable.
 *
 * Usage:
 *   await setClipboard(page, 'Hello World');
 *   await paste(page); // Ctrl+V / Cmd+V into the focused element
 */
export async function setClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, text);
}

/**
 * Read the current text content of the browser clipboard.
 *
 * Requires `permissions: ['clipboard-read']` on the browser context.
 *
 * Usage:
 *   await copy(page);
 *   const text = await readClipboard(page);
 *   expect(text).toBe('expected value');
 */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(async () => navigator.clipboard.readText());
}

/**
 * Write text to the clipboard and immediately paste it into a locator.
 *
 * This is the most reliable cross-browser approach for pasting programmatic
 * content into an input. It uses a hidden textarea as a clipboard bridge
 * when the Clipboard API is unavailable (Firefox, WebKit, BrowserStack).
 *
 * Strategy:
 *   1. Try navigator.clipboard.writeText() (Chromium with permissions)
 *   2. Fall back to a hidden textarea + execCommand('copy') bridge
 *   3. Focus the target locator and press Ctrl+V / Cmd+V
 *
 * Usage:
 *   await setClipboardAndPaste(page, page.locator('#search'), 'Hello World');
 */
export async function setClipboardAndPaste(
  page: Page,
  locator: Locator,
  text: string,
): Promise<void> {
  // Write to clipboard — try native API first, fall back to execCommand bridge
  const written = await page.evaluate(async (value) => {
    // Strategy 1: Clipboard API (Chromium with permissions)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Fall through to bridge
      }
    }

    // Strategy 2: Hidden textarea bridge (Firefox, WebKit, BrowserStack)
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }, text);

  if (!written) {
    // Last resort: type the text directly (no clipboard involved)
    await locator.focus();
    await locator.pressSequentially(text);
    return;
  }

  // Focus the target and paste
  await locator.focus();
  await page.keyboard.press(`${MOD}+v`);
}

/**
 * Perform an action and return whatever text ended up in the clipboard.
 *
 * Useful for asserting what gets copied when a user clicks a "Copy" button.
 * Automatically grants clipboard-read/write permissions before the action.
 *
 * Usage:
 *   const copied = await getClipboardAfterAction(page, async () => {
 *     await page.locator('button#copy-code').click();
 *   });
 *   expect(copied).toBe('expected code');
 */
export async function getClipboardAfterAction(
  page: Page,
  action: () => Promise<void>,
): Promise<string> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await action();
  return page.evaluate(async () => navigator.clipboard.readText());
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

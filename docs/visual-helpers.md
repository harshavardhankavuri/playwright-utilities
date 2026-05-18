# Visual Helpers

**File:** `src/main/utils/visual-helpers.ts`

## Overview

Visual Helpers provide utilities for visual testing and debugging: highlighting elements on the page, scrolling, collecting console errors, managing viewport sizes, and taking full-page screenshots. Use them for debugging test failures, responsive testing, and capturing evidence.

## How It Works

These are stateless utility functions that operate directly on Playwright `Page` or `Locator` objects:

- **highlightElement** — Injects an inline `outline` style on the element, auto-removes after a duration.
- **scrollToCenter/Top/Bottom** — Calls `scrollIntoView` or `window.scrollTo` via `evaluate`.
- **collectConsoleErrors** — Registers `console` and `pageerror` event listeners, accumulates messages in an array.
- **VIEWPORTS** — A constant object with common device dimensions.
- **takeFullPageScreenshot** — Takes a full-page screenshot with a timestamped filename.

## Configuration

### Viewport presets

```typescript
import { VIEWPORTS } from '@utils/visual-helpers';

VIEWPORTS.mobile      // { width: 375, height: 812 }
VIEWPORTS.tablet      // { width: 768, height: 1024 }
VIEWPORTS.desktop     // { width: 1440, height: 900 }
VIEWPORTS.widescreen  // { width: 1920, height: 1080 }
```

## Usage Examples

### Highlight an element (debugging)

```typescript
import { highlightElement } from '@utils/visual-helpers';

// Red outline for 3 seconds (default)
await highlightElement(page.locator('#submit-btn'));

// Custom color and duration
await highlightElement(page.locator('.error-field'), {
  color: 'blue',
  duration: 5000,
});
```

### Scroll utilities

```typescript
import { scrollToCenter, scrollToBottom, scrollToTop } from '@utils/visual-helpers';

// Scroll element into center of viewport
await scrollToCenter(page.locator('#footer-section'));

// Scroll to bottom (infinite scroll testing)
await scrollToBottom(page);

// Scroll back to top
await scrollToTop(page);
```

### Collect console errors

```typescript
import { collectConsoleErrors } from '@utils/visual-helpers';

test('no console errors during checkout', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await page.goto('/checkout');
  await page.click('#submit-order');

  // Assert no JS errors occurred
  expect(errors.get()).toHaveLength(0);
});
```

### Clear and reuse error collector

```typescript
const errors = collectConsoleErrors(page);

// Phase 1
await page.goto('/page-a');
expect(errors.get()).toHaveLength(0);

// Reset for phase 2
errors.clear();
await page.goto('/page-b');
expect(errors.get()).toHaveLength(0);
```

### Responsive testing with VIEWPORTS

```typescript
import { VIEWPORTS } from '@utils/visual-helpers';

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test(`inventory renders on ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/inventory.html');
    await expect(page.locator('.inventory_list')).toBeVisible();
  });
}
```

### Take full-page screenshot

```typescript
import { takeFullPageScreenshot } from '@utils/visual-helpers';

test('capture checkout page', async ({ page }) => {
  await page.goto('/checkout');

  const filePath = await takeFullPageScreenshot(page, 'checkout-complete', {
    dir: 'test-results/screenshots',
  });
  // Saved as: test-results/screenshots/checkout-complete-2025-06-15T10-30-00-000Z.png
});
```

### Get current viewport size

```typescript
import { getViewportSize } from '@utils/visual-helpers';

const { width, height } = await getViewportSize(page);
console.log(`Current viewport: ${width}x${height}`);
```

### SauceDemo example — debug a failing test

```typescript
test('debug inventory layout', async ({ page }) => {
  await page.goto('/inventory.html');

  // Highlight the element we're about to interact with
  await highlightElement(page.locator('.shopping_cart_link'));

  // Take a screenshot for the report
  await takeFullPageScreenshot(page, 'inventory-highlighted');

  // Scroll to a product at the bottom
  await scrollToCenter(page.locator('.inventory_item:last-child'));
});
```

## Tips & Best Practices

- Use `highlightElement` during test development to visually confirm which element your locator targets — remove it before committing.
- `collectConsoleErrors` should be set up at the START of the test (before navigation) to catch all errors including those during page load.
- Use `VIEWPORTS` with Playwright's `test.describe` to create responsive test suites without duplicating test logic.
- `takeFullPageScreenshot` includes a timestamp in the filename, so multiple runs don't overwrite each other.
- Combine `scrollToBottom` with `waitForCount` for infinite-scroll testing: scroll, wait for new items, assert count.

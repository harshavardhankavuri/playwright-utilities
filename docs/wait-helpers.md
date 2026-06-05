# Wait Helpers

**File:** `src/main/utils/wait-helpers.ts`

## Overview

Wait Helpers provide higher-level wait patterns that complement Playwright's built-in auto-waiting. Use them for complex scenarios: waiting for API responses triggered by user actions, ensuring DOM stability after animations, retrying flaky interactions, and waiting for downloads.

## How It Works

Each helper wraps Playwright primitives (`waitForResponse`, `waitForEvent`, `expect().toHaveCount()`, etc.) into reusable patterns with sensible defaults. They're pure functions — no class instantiation needed.

- `waitForApiResponse` — Uses `Promise.all` to trigger an action and wait for a matching network response simultaneously.
- `waitForElementStable` — Polls the element's bounding box at intervals and resolves when it stops changing.
- `retryAction` — Wraps an action in a retry loop with configurable attempts and delay.
- `waitForDownload` — Combines `waitForEvent('download')` with the trigger action.
- `waitForCount` — Wraps `expect(locator).toHaveCount()` with a timeout.

## Configuration

All functions accept an `options` object with `timeout` (and function-specific parameters). Defaults:

| Function | Default Timeout | Other Defaults |
|----------|----------------|----------------|
| `waitForApiResponse` | 15,000ms | status: any 2xx |
| `waitForNetworkIdle` | — | idleTime: 0 |
| `waitForElementStable` | 5,000ms | interval: 200ms |
| `waitForCount` | 10,000ms | — |
| `retryAction` | — | retries: 3, delay: 500ms |
| `waitForUrl` | 15,000ms | — |
| `waitForDownload` | 30,000ms | — |

## Usage Examples

### Wait for API response after a click

```typescript
import { waitForApiResponse } from '@utils/wait-helpers';

const data = await waitForApiResponse<{ users: User[] }>(
  page,
  '/api/users',
  async () => {
    await page.click('button#load-users');
  },
);
expect(data.users).toHaveLength(10);
```

### Wait for specific status code

```typescript
const response = await waitForApiResponse(
  page,
  '/api/orders',
  async () => { await page.click('#submit-order'); },
  { status: 201, timeout: 10_000 },
);
```

### Wait for element stability (no layout shifts)

```typescript
import { waitForElementStable } from '@utils/wait-helpers';

// Wait for an animated element to settle
await waitForElementStable(page.locator('.sliding-panel'), {
  timeout: 3000,
  interval: 100,
});
await page.locator('.sliding-panel button').click();
```

### Wait for a specific element count

```typescript
import { waitForCount } from '@utils/wait-helpers';

// Wait for exactly 6 inventory items to load
await waitForCount(page.locator('.inventory_item'), 6);
```

### Retry a flaky action

```typescript
import { retryAction } from '@utils/wait-helpers';

await retryAction(
  async () => {
    await page.click('button#submit');
    await expect(page.locator('.success-toast')).toBeVisible({ timeout: 2000 });
  },
  { retries: 3, delay: 1000 },
);
```

### Wait for a file download

```typescript
import { waitForDownload } from '@utils/wait-helpers';

const filePath = await waitForDownload(
  page,
  async () => { await page.click('a#export-csv'); },
  { saveDir: 'test-results/downloads', timeout: 15_000 },
);
expect(filePath).toContain('.csv');
```

### Wait for URL after navigation

```typescript
import { waitForUrl } from '@utils/wait-helpers';

await page.click('a#dashboard-link');
await waitForUrl(page, /dashboard/, { timeout: 10_000 });
```

### Wait for network idle

```typescript
import { waitForNetworkIdle } from '@utils/wait-helpers';

await page.click('#load-all-data');
await waitForNetworkIdle(page, { idleTime: 500 });
// Now safe to assert — all async rendering is complete
```

### SauceDemo example

```typescript
test('add to cart updates badge', async ({ page }) => {
  await waitForApiResponse(page, '/api/cart', async () => {
    await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  });

  await waitForCount(page.locator('.shopping_cart_badge'), 1);
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
});
```

## Tips & Best Practices

- Prefer `waitForApiResponse` over `page.waitForTimeout` — it's deterministic and faster.
- Use `waitForElementStable` before interacting with elements that animate into position (modals, slide-outs, accordions).
- Keep `retryAction` retries low (2–3). If an action needs more retries, the test or the app has a deeper issue.
- `waitForDownload` returns the file path — use it to read and assert file contents.
- These helpers are composable: combine `retryAction` with `waitForApiResponse` for resilient API-triggered flows.

---

## New Helpers

### `waitForAnimation(locator, options?)`

Wait for all CSS animations and transitions on an element to complete. Useful before taking screenshots or asserting final visual state.

```typescript
import { waitForAnimation } from './src/main/utils';

// Wait for modal open animation to finish
await page.click('#open-modal');
await waitForAnimation(page.locator('.modal'));
await expect(page.locator('.modal')).toBeVisible();
```

### `waitForLocalStorage(page, key, predicate, options?)`

Wait for a localStorage key to satisfy a predicate. Useful for async operations that store results in localStorage.

```typescript
import { waitForLocalStorage } from './src/main/utils';

// Wait for auth token to be stored
await waitForLocalStorage(page, 'access_token', (v) => v !== null);

// Wait for a specific value
await waitForLocalStorage(page, 'status', (v) => v === 'ready');

// Wait for key to be removed
await waitForLocalStorage(page, 'loading', (v) => v === null);
```

### `waitForSessionStorage(page, key, predicate, options?)`

Same as `waitForLocalStorage` but for sessionStorage.

```typescript
import { waitForSessionStorage } from './src/main/utils';

await waitForSessionStorage(page, 'cart_id', (v) => v !== null && v.length > 0);
```

### `waitForRequestCount(page, urlPattern, expectedCount, triggerAction?, options?)`

Wait for a specific number of network requests to complete. Useful for parallel API calls.

```typescript
import { waitForRequestCount } from './src/main/utils';

// Wait for 3 API calls after clicking "Load All"
await waitForRequestCount(page, '/api/data', 3, async () => {
  await page.click('#load-all');
});

// Without trigger (count requests that already happened)
await waitForRequestCount(page, /\/api\/items/, 5);
```

# Fluent Assertions

**File:** `src/main/assertions/fluent-expect.ts`

## Overview

Fluent Assertions provide a chainable `expect$()` API for Playwright Locators, Pages, and API Responses. Instead of writing multiple `await expect(...)` lines, you chain assertions into a single readable expression that executes sequentially when awaited.

Use it to reduce boilerplate and improve readability in assertion-heavy tests.

## How It Works

Each assertion method (e.g. `.toBeVisible()`, `.toHaveText()`) pushes a step function onto an internal queue. The class implements `PromiseLike<void>`, so when you `await` the chain, all steps execute in order. If any step fails, execution stops with that error — identical to writing them sequentially.

Negation via `.not` applies only to the immediately following assertion, then resets.

## Configuration

The factory functions accept an optional timeout that applies to all assertions in the chain:

```typescript
import { fluentExpect, fluentExpectPage, fluentExpectResponse } from '@utils/assertions';

// Default timeout: 5000ms
fluentExpect(locator);

// Custom timeout for all assertions in this chain
fluentExpect(locator, { timeout: 10_000 });
```

Individual assertions can override the timeout:

```typescript
await fluentExpect(locator)
  .toBeVisible({ timeout: 2000 })
  .toHaveText('Hello', { timeout: 10_000 });
```

## Usage Examples

### Locator assertions (chained)

```typescript
await fluentExpect(page.locator('#login-btn'))
  .toBeVisible()
  .toBeEnabled()
  .toHaveText('Log in')
  .toHaveAttribute('type', 'submit');
```

### Negation

```typescript
await fluentExpect(page.locator('.error-message'))
  .not.toBeVisible();

// Negation applies only to the next assertion:
await fluentExpect(page.locator('#field'))
  .toBeVisible()
  .not.toBeDisabled()
  .toHaveValue('default');
```

### Page assertions

```typescript
await fluentExpectPage(page)
  .toHaveTitle('Swag Labs')
  .toHaveURL(/inventory\.html/);
```

### Response assertions

```typescript
await fluentExpectResponse(response).toBeOK();
```

### Custom `satisfies` assertion

```typescript
await fluentExpect(page.locator('.product-card'))
  .toBeVisible()
  .satisfies(async (loc) => {
    const box = await loc.boundingBox();
    if (!box || box.width < 200) throw new Error('Card too narrow');
  });
```

### SauceDemo example

```typescript
// After login, verify inventory page state
await fluentExpectPage(page)
  .toHaveTitle('Swag Labs')
  .toHaveURL('https://www.saucedemo.com/inventory.html');

await fluentExpect(page.locator('.inventory_item'))
  .toHaveCount(6);

await fluentExpect(page.locator('[data-test="add-to-cart-sauce-labs-backpack"]'))
  .toBeVisible()
  .toBeEnabled()
  .toHaveText('Add to cart');
```

## Tips & Best Practices

- Keep chains focused on a single element or page — don't mix unrelated assertions in one chain.
- Use `.satisfies()` for custom logic that Playwright's built-in matchers don't cover (bounding box checks, computed styles, etc.).
- Negation (`.not`) resets after one assertion — if you need multiple negated checks, prefix each with `.not`.
- All assertions are auto-retrying (they use Playwright's `expect()` under the hood), so they handle async rendering naturally.
- Prefer `fluentExpect` over raw `expect` when you have 3+ assertions on the same locator — it's more readable and avoids repeating the locator reference.

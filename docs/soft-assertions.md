# Soft Assertions

**File:** `src/main/utils/soft-assertions.ts`

## Overview

`SoftAssert` collects assertion failures without stopping the test, with full chain support. Unlike regular assertions that throw immediately, soft assertions record all violations and report them together when you call `assertAll()`. Ideal for form validation, page structure checks, and data integrity verification where you want every problem visible at once.

## Differences vs Playwright's `expect.soft()`

Playwright's built-in soft assertions ([docs](https://playwright.dev/docs/test-assertions#soft-assertions)) do not chain — each assertion is a separate `await`:

```typescript
// Playwright built-in
await expect.soft(input).toBeVisible();
await expect.soft(input).toBeEnabled();
await expect.soft(input).toHaveValue('admin');
await expect.soft(input).toHaveCSS('color', 'red');
```

Our `SoftAssert` chains all assertions on a single `await`, with negation, custom predicates, and a structured failure report:

```typescript
// Our chained version
await soft.expect(input, 'username field')
  .toBeVisible()
  .toBeEnabled()
  .toHaveValue('admin')
  .toHaveCSS('color', 'red')
  .not.toHaveAttribute('disabled')
  .satisfies(async (loc) => {
    const box = await loc.boundingBox();
    if (!box || box.width < 100) throw new Error('field too narrow');
  });
```

| Feature | Playwright `expect.soft()` | Our `SoftAssert` |
|---|---|---|
| Chaining | One assertion per `await` | All assertions on one `await` |
| Negation | `expect.soft(x).not.toBe...()` | `.not.toBe...()` inside chain |
| Custom predicates | Not supported in chain | `.satisfies(fn)` inside chain |
| Failure summary | Per-assertion in test output | Single grouped report with index + label |
| Structured access | Via testInfo errors | `getFailures()`, `hasFailures()`, `getCounts()` |
| Auto-fail on cleanup | Built into Playwright runner | Call `assertAll()` (or via fixture) |
| APIResponse chain | Yes | Yes (`expectResponse(...)`) |
| Page/value chain | Per-call | Yes, all chainable |

Both approaches collect failures without stopping mid-test. Use Playwright's built-in if you only need 1–2 soft checks. Use ours when you have many checks on the same target or want a single structured report.

## How It Works

1. Create a `SoftAssert` instance.
2. Build a chain via `soft.expect(locator)`, `soft.expectPage(page)`, `soft.expectResponse(response)`, or `soft.expectValue(value)`.
3. Each method on the chain queues a deferred step. Nothing runs until you `await` the chain.
4. On `await`, every step runs in order. Failures are recorded into the collector — never thrown.
5. At the end of the test, call `soft.assertAll()`. If any step failed, it throws a single grouped error listing all failures with their position, label, and message.

## Available Assertion Methods

### SoftLocatorAssert (covers Playwright's locator assertions)

`toBeAttached`, `toBeVisible`, `toBeHidden`, `toBeInViewport`, `toBeEnabled`, `toBeDisabled`, `toBeEditable`, `toBeChecked`, `toBeFocused`, `toBeEmpty`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveValues`, `toHaveAttribute`, `toHaveClass`, `toHaveCSS`, `toHaveId`, `toHaveCount`, `satisfies(fn)`

All support `.not` for negation and an optional `{ timeout }` parameter.

### SoftPageAssert

`toHaveTitle`, `toHaveURL`, `satisfies(fn)`

### SoftResponseAssert

`toBeOK`, `toHaveStatus`, `satisfies(fn)`

### SoftValueAssert

`toBe`, `toEqual`, `toBeTruthy`, `toBeFalsy`, `toContain`, `toBeGreaterThan`, `toBeLessThan`, `satisfies(fn)`

## Usage Examples

### Chained locator validation

```typescript
import { SoftAssert } from '@utils/soft-assertions';

const soft = new SoftAssert();

await soft.expect(page.locator('#email'), 'email field')
  .toBeVisible()
  .toBeEnabled()
  .toHaveValue('user@example.com')
  .toHaveAttribute('type', 'email')
  .not.toHaveClass(/error/);

soft.assertAll();
```

### Negation in a chain

```typescript
await soft.expect(submitBtn)
  .toBeVisible()
  .not.toBeDisabled()
  .not.toHaveText('Logout');
```

### Custom predicates inside a chain

```typescript
await soft.expect(card)
  .toBeVisible()
  .satisfies(async (loc) => {
    const box = await loc.boundingBox();
    if (!box || box.width < 200) throw new Error(`card too narrow: ${box?.width}px`);
  }, 'min width 200px');
```

### Page chain

```typescript
await soft.expectPage(page)
  .toHaveTitle(/Swag Labs/)
  .toHaveURL(/inventory/);
```

### Response chain

```typescript
const response = await page.request.get('/api/users');
await soft.expectResponse(response)
  .toBeOK()
  .toHaveStatus(200)
  .satisfies(async (r) => {
    const json = await r.json();
    if (!Array.isArray(json)) throw new Error('expected array');
  }, 'body is array');
```

### Value chain

```typescript
const cartCount = (await page.locator('.cart_item').count());

await soft.expectValue(cartCount, 'cart count')
  .toBeGreaterThan(0)
  .toBeLessThan(10)
  .not.toBe(5);
```

### Form validation test (SauceDemo)

```typescript
test('checkout form shows all validation errors', async ({ page }) => {
  const soft = new SoftAssert();

  await page.locator('[data-test="continue"]').click();

  await soft.expect(page.locator('[data-test="error"]'), 'error banner')
    .toBeVisible()
    .toContainText('First Name is required');

  await soft.expect(page.locator('#first-name')).toHaveClass(/error/);
  await soft.expect(page.locator('#last-name')).toHaveClass(/error/);
  await soft.expect(page.locator('#postal-code')).toHaveClass(/error/);

  soft.assertAll();
});
```

### Inspect without throwing

```typescript
if (soft.hasFailures()) {
  for (const f of soft.getFailures()) {
    console.log(`[${f.index + 1}] ${f.label ?? ''} ${f.assertion}`);
    console.log(`  → ${f.error}`);
  }
}

const { total, passed, failed } = soft.getCounts();
console.log(`${passed}/${total} passed, ${failed} failed`);
```

### Auto-fail at end of test (afterEach pattern)

```typescript
import { test as base } from '@playwright/test';
import { SoftAssert } from '@utils/soft-assertions';

const test = base.extend<{ soft: SoftAssert }>({
  soft: async ({}, use) => {
    const soft = new SoftAssert();
    await use(soft);
    soft.assertAll(); // runs after the test completes
  },
});

test('form check', async ({ page, soft }) => {
  await soft.expect(page.locator('#name')).toBeVisible().toBeEnabled();
  // No need to call assertAll() — fixture handles it.
});
```

## Tips & Best Practices

- Always end the test (or fixture teardown) with `soft.assertAll()` — without it, failures are silently swallowed.
- Use descriptive labels: `soft.expect(locator, 'submit button')` — they appear in every failure line.
- Soft assertions are for verification, not actions. If a click fails, let it throw — don't wrap actions in soft.
- Use `.satisfies()` for assertions Playwright doesn't expose directly (geometry checks, custom JSON shapes, etc.).
- Combine with `test.step()` to group related soft chains into a single Allure/Playwright step.
- Reuse a single `SoftAssert` per test to get one consolidated failure report.

# Soft Assertions

**File:** `src/main/utils/soft-assertions.ts`

## Overview

SoftAssert collects assertion failures without stopping the test. Unlike regular assertions that throw immediately, soft assertions record all violations and report them together when you call `assertAll()`. Ideal for form validation tests, page structure checks, and data integrity verification where you want to see ALL problems at once.

## How It Works

1. Create a `SoftAssert` instance.
2. Use `soft.expect(locator)` or `soft.expectValue(value)` — these return proxy objects that catch errors internally.
3. Each assertion increments a counter and, on failure, records the error message.
4. At the end of the test, call `soft.assertAll()` — it throws a single error listing ALL failures with their indices.

The proxy classes (`SoftLocatorAssert`, `SoftPageAssert`, `SoftValueAssert`) wrap Playwright's `expect()` in try/catch blocks. They use the same auto-retrying behavior as normal Playwright assertions.

## Configuration

No constructor options. The default timeout for locator assertions is 5000ms (passed to Playwright's `expect`). Override per-assertion:

```typescript
await soft.expect(locator).toBeVisible({ timeout: 10_000 });
```

## Usage Examples

### Basic locator assertions

```typescript
import { SoftAssert } from '@utils/soft-assertions';

const soft = new SoftAssert();

await soft.expect(page.locator('#name-field')).toBeVisible();
await soft.expect(page.locator('#email-field')).toHaveValue('test@example.com');
await soft.expect(page.locator('#submit-btn')).toBeEnabled();
await soft.expect(page.locator('.error-msg')).toBeHidden();

soft.assertAll(); // Throws with ALL failures if any
```

### Page assertions

```typescript
await soft.expectPage(page).toHaveTitle('Swag Labs');
await soft.expectPage(page).toHaveURL(/inventory/);

soft.assertAll();
```

### Value assertions (non-locator)

```typescript
const price = await page.locator('.item_price').textContent();
const count = await page.locator('.cart_item').count();

soft.expectValue(price, 'price').toContain('$');
soft.expectValue(count, 'cart count').toBeGreaterThan(0);
soft.expectValue(count, 'cart count').toBeLessThan(10);

soft.assertAll();
```

### SauceDemo form validation test

```typescript
test('checkout form shows all validation errors', async ({ page }) => {
  const soft = new SoftAssert();

  // Submit empty form
  await page.locator('[data-test="continue"]').click();

  // Check all error states at once
  await soft.expect(page.locator('[data-test="error"]')).toBeVisible();
  await soft.expect(page.locator('[data-test="error"]')).toContainText('First Name is required');
  await soft.expect(page.locator('#first-name')).toHaveClass(/error/);
  await soft.expect(page.locator('#last-name')).toHaveClass(/error/);
  await soft.expect(page.locator('#postal-code')).toHaveClass(/error/);

  soft.assertAll();
});
```

### Check without throwing

```typescript
if (soft.hasFailures()) {
  const failures = soft.getFailures();
  console.log(`${failures.length} assertions failed`);
  for (const f of failures) {
    console.log(`  [${f.index}] ${f.assertion}: ${f.error}`);
  }
}
```

### Get counts

```typescript
const { total, passed, failed } = soft.getCounts();
console.log(`${passed}/${total} passed, ${failed} failed`);
```

## Available Assertion Methods

### SoftLocatorAssert
`toBeVisible`, `toBeHidden`, `toBeEnabled`, `toBeDisabled`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveAttribute`, `toHaveClass`, `toHaveCount`, `toBeChecked`, `toHaveCss`

### SoftPageAssert
`toHaveTitle`, `toHaveURL`

### SoftValueAssert
`toBe`, `toEqual`, `toBeTruthy`, `toBeFalsy`, `toContain`, `toBeGreaterThan`, `toBeLessThan`

## Tips & Best Practices

- Always call `soft.assertAll()` at the end — without it, failures are silently swallowed.
- Use descriptive labels: `soft.expect(locator, 'submit button')` — they appear in the failure report.
- Soft assertions are best for verification steps, not for actions. If a click fails, the test should stop immediately.
- Call `soft.reset()` if reusing the same instance across multiple test phases.
- Combine with `test.step()` for organized Playwright reports: group related soft assertions in a step, then `assertAll()` at the step boundary.

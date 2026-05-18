# Accessibility Helpers

**File:** `src/main/utils/accessibility-helpers.ts`

## Overview

Accessibility Helpers provide quick, lightweight a11y checks for Playwright tests. They validate common WCAG requirements — image alt text, form labels, heading hierarchy, and keyboard accessibility — without requiring a full axe-core integration. Use them as a first line of defense; for comprehensive WCAG audits, pair with `@axe-core/playwright`.

## How It Works

Each check function queries the page DOM for specific element types and validates accessibility attributes:

- **Images** — Checks every `<img>` for an `alt` attribute.
- **Form labels** — Checks inputs for associated `<label>`, `aria-label`, or `aria-labelledby`.
- **Heading hierarchy** — Validates that headings start at `h1` and don't skip levels (h1→h3).
- **Keyboard accessibility** — Checks elements with `onclick`, `role="button"`, or `role="link"` for `tabindex` or native focusability.

All functions return an `A11yCheckResult` with `passed`, `violations[]`, and `warnings[]`.

## Configuration

No configuration needed — these are stateless functions. Each returns a result object you can assert on.

```typescript
interface A11yCheckResult {
  passed: boolean;
  violations: string[];   // Hard failures
  warnings: string[];     // Soft issues (e.g. placeholder-only labels)
}
```

## Usage Examples

### Run all checks at once

```typescript
import { runA11yChecks } from '@utils/accessibility-helpers';

test('page passes basic a11y checks', async ({ page }) => {
  await page.goto('/inventory.html');

  const result = await runA11yChecks(page);
  expect(result.violations).toEqual([]);
});
```

### Individual checks

```typescript
import {
  checkImagesHaveAlt,
  checkFormLabels,
  checkHeadingHierarchy,
  checkKeyboardAccessibility,
} from '@utils/accessibility-helpers';

test('all images have alt text', async ({ page }) => {
  const result = await checkImagesHaveAlt(page);
  expect(result.passed).toBe(true);
});

test('form inputs have labels', async ({ page }) => {
  await page.goto('/checkout-step-one.html');
  const result = await checkFormLabels(page);

  if (!result.passed) {
    console.log('Label violations:', result.violations);
  }
  expect(result.passed).toBe(true);
});

test('heading hierarchy is correct', async ({ page }) => {
  const result = await checkHeadingHierarchy(page);
  expect(result.violations).toEqual([]);
});

test('interactive elements are keyboard accessible', async ({ page }) => {
  const result = await checkKeyboardAccessibility(page);
  expect(result.passed).toBe(true);
});
```

### SauceDemo example

```typescript
test('inventory page accessibility', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');

  const a11y = await runA11yChecks(page);

  // Log any issues for debugging
  if (a11y.violations.length > 0) {
    console.log('A11y violations:');
    a11y.violations.forEach((v) => console.log(`  ❌ ${v}`));
  }
  if (a11y.warnings.length > 0) {
    console.log('A11y warnings:');
    a11y.warnings.forEach((w) => console.log(`  ⚠️ ${w}`));
  }

  expect(a11y.passed).toBe(true);
});
```

### Combine with soft assertions

```typescript
import { SoftAssert } from '@utils/soft-assertions';

test('full page a11y audit', async ({ page }) => {
  const soft = new SoftAssert();
  const results = await runA11yChecks(page);

  for (const violation of results.violations) {
    soft.expectValue(true, violation).toBe(false); // Record each as a failure
  }

  soft.assertAll();
});
```

## What Each Check Validates

| Check | Validates | WCAG Criterion |
|-------|-----------|----------------|
| `checkImagesHaveAlt` | All `<img>` have `alt` attribute | 1.1.1 Non-text Content |
| `checkFormLabels` | Inputs have `<label>`, `aria-label`, or `aria-labelledby` | 1.3.1 Info and Relationships |
| `checkHeadingHierarchy` | Headings start at h1, no level skips | 1.3.1 Info and Relationships |
| `checkKeyboardAccessibility` | Interactive elements have tabindex or are natively focusable | 2.1.1 Keyboard |

## Tips & Best Practices

- Run `runA11yChecks` in a shared `afterEach` hook to catch regressions on every page visited.
- These checks are fast (DOM queries only) — they add negligible time to tests.
- Use `warnings` to track non-blocking issues (e.g. placeholder-as-label) that should be fixed but don't fail the build.
- For comprehensive WCAG compliance, add `@axe-core/playwright` alongside these helpers. These catch the most common issues quickly; axe catches the rest.
- Full WCAG validation requires manual testing with assistive technologies and expert accessibility review.

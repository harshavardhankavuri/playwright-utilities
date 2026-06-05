# Accessibility Helpers

**File:** `src/main/utils/accessibility-helpers.ts`

## Overview

Accessibility Helpers provide quick, lightweight a11y checks for Playwright tests. They validate common WCAG requirements without requiring a full axe-core integration. Use them as a first line of defense; for comprehensive WCAG audits, pair with `@axe-core/playwright`.

All functions return an `A11yCheckResult`:

```typescript
interface A11yCheckResult {
  passed: boolean;
  violations: string[];   // Hard failures
  warnings: string[];     // Soft issues (non-blocking)
}
```

---

## Quick Start

### Run all basic checks

```typescript
import { runA11yChecks } from './src/main/utils';

test('page passes basic a11y checks', async ({ page }) => {
  await page.goto('/');
  const result = await runA11yChecks(page);
  expect(result.violations).toEqual([]);
});
```

### Run full enhanced checks

```typescript
import { runFullA11yChecks } from './src/main/utils';

test('page passes full a11y audit', async ({ page }) => {
  await page.goto('/');
  const result = await runFullA11yChecks(page, {
    modalSelector: '[role="dialog"]', // Optional: check modal focus trap
  });

  if (result.violations.length > 0) {
    console.log('Violations:', result.violations);
  }
  expect(result.violations).toHaveLength(0);
});
```

---

## Basic Checks

### `checkImagesHaveAlt(page)`

Checks every `<img>` for an `alt` attribute.

```typescript
const result = await checkImagesHaveAlt(page);
// violations: ['Image missing alt attribute: /logo.png']
```

### `checkFormLabels(page)`

Checks inputs for associated `<label>`, `aria-label`, or `aria-labelledby`.

```typescript
const result = await checkFormLabels(page);
// violations: ['Input #email has no associated label']
// warnings:   ['Input uses placeholder as only label hint (not accessible)']
```

### `checkHeadingHierarchy(page)`

Validates headings start at `h1` and don't skip levels.

```typescript
const result = await checkHeadingHierarchy(page);
// violations: ['Heading level skipped: h2 → h4 ("Section Title")']
```

### `checkKeyboardAccessibility(page)`

Checks elements with `onclick`, `role="button"`, or `role="link"` for keyboard access.

```typescript
const result = await checkKeyboardAccessibility(page);
// violations: ['Element <div role="button"> "Click me" is not keyboard accessible (missing tabindex)']
```

### `runA11yChecks(page)`

Runs all four basic checks above and returns a combined result.

---

## Enhanced Checks

### `checkFocusIndicators(page)`

Samples up to 20 focusable elements and checks for visible focus rings (outline or box-shadow).

```typescript
import { checkFocusIndicators } from './src/main/utils';

const result = await checkFocusIndicators(page);
// warnings: ['<button> "Submit" may lack visible focus indicator (outline: none)']
```

### `checkAriaLiveRegions(page)`

Validates ARIA live regions are correctly configured for screen reader announcements.

```typescript
import { checkAriaLiveRegions } from './src/main/utils';

const result = await checkAriaLiveRegions(page);
// violations: ['[role="alert"] should have aria-live="assertive", got "polite"']
// warnings:   ['Live region <div> missing aria-atomic attribute']
```

### `checkFocusTrap(page, modalSelector)`

Checks that a modal dialog has proper ARIA attributes for focus trapping.

```typescript
import { checkFocusTrap } from './src/main/utils';

const result = await checkFocusTrap(page, '[role="dialog"]');
// violations: ['Modal "[role="dialog"]" missing aria-modal="true"']
```

### `checkSkipLinks(page)`

Checks for skip navigation links that allow keyboard users to bypass repetitive content.

```typescript
import { checkSkipLinks } from './src/main/utils';

const result = await checkSkipLinks(page);
// warnings: ['No skip navigation link found. Consider adding "Skip to main content"']
```

### `checkTouchTargetSize(page, options?)`

Checks that interactive elements meet the minimum touch target size (WCAG 2.5.5).

```typescript
import { checkTouchTargetSize } from './src/main/utils';

// Default: 44x44px minimum
const result = await checkTouchTargetSize(page);

// Custom minimum
const result = await checkTouchTargetSize(page, { minSize: 48 });
// violations: ['<button> "X" is 24x24px (min: 44x44px)']
```

### `runFullA11yChecks(page, options?)`

Runs all basic + enhanced checks in one call.

```typescript
import { runFullA11yChecks } from './src/main/utils';

const result = await runFullA11yChecks(page, {
  modalSelector: '[role="dialog"]',
});
```

---

## What Each Check Validates

| Check | Validates | WCAG Criterion |
|---|---|---|
| `checkImagesHaveAlt` | All `<img>` have `alt` attribute | 1.1.1 Non-text Content |
| `checkFormLabels` | Inputs have `<label>`, `aria-label`, or `aria-labelledby` | 1.3.1 Info and Relationships |
| `checkHeadingHierarchy` | Headings start at h1, no level skips | 1.3.1 Info and Relationships |
| `checkKeyboardAccessibility` | Interactive elements are keyboard accessible | 2.1.1 Keyboard |
| `checkFocusIndicators` | Focusable elements have visible focus rings | 2.4.7 Focus Visible |
| `checkAriaLiveRegions` | Live regions are correctly configured | 4.1.3 Status Messages |
| `checkFocusTrap` | Modals have `aria-modal`, `role="dialog"`, and label | 1.3.1, 2.1.2 |
| `checkSkipLinks` | Skip navigation links are present | 2.4.1 Bypass Blocks |
| `checkTouchTargetSize` | Touch targets are at least 44x44px | 2.5.5 Target Size |

---

## Tips

- Run `runA11yChecks` in a shared `afterEach` hook to catch regressions on every page.
- These checks are fast (DOM queries only) — they add negligible time to tests.
- Use `warnings` to track non-blocking issues that should be fixed but don't fail the build.
- For comprehensive WCAG compliance, add `@axe-core/playwright` alongside these helpers.
- Full WCAG validation requires manual testing with assistive technologies and expert review.

# Visual Regression

**File:** `src/main/utils/visual-regression.ts`

## Overview

`VisualRegression` is the **primary visual testing API** for the framework. It captures screenshots, applies masking, manages multiple valid baselines, and analyzes differences using the [`ScreenshotComparator`](screenshot-comparator.md) engine.

It improves on Playwright's built-in `toHaveScreenshot()` in five ways:

1. **Multiple valid baselines (up to 4)** — passes if ANY match. Useful for UIs with acceptable variations (sort orders, A/B states, dark/light mode).
2. **Three masking strategies** — Locator, CSS selector, and pixel region.
3. **Intelligent diff classification** — distinguishes anti-aliasing noise, alignment shifts, color variance, and real structural changes.
4. **Per-category tolerance** — tune sensitivity to specific kinds of noise rather than a single global threshold.
5. **Detailed failure reports** — category breakdown and bounding boxes of differing regions.

## How It Works

```
1. Capture screenshot
   ├── Inject CSS to hide maskSelectors (iframes, spinners)
   ├── Use Playwright's mask option for Locator-based hiding
   └── Apply region masks (gray rectangles on pixel coordinates)

2. Compare against baselines (up to 4)
   ├── Uses ScreenshotComparator for each baseline
   ├── Classifies diffs: anti-aliasing, alignment, color, structural
   └── Passes if ANY baseline matches

3. Result
   ├── passed: true/false
   ├── analysis: full diff breakdown
   └── summary: human-readable report
```

### Storage Structure

```
__snapshots__/
  login.spec.ts/              ← subfolder per spec file
    login-page/               ← subfolder per snapshot name
      baseline-1.png
      baseline-2.png
      baseline-3.png
      baseline-4.png
    submit-button/
      baseline-1.png
  inventory.spec.ts/
    product-grid/
      baseline-1.png
```

### Behavior

| Scenario | Outcome |
|----------|---------|
| No baselines exist | First screenshot saved as `baseline-1.png`, test passes |
| Subsequent runs | Compared against all stored baselines; passes if any match |
| `UPDATE_SNAPSHOTS=true` or `update: true` | Adds new baseline variant; rotates oldest if at `maxBaselines` |
| Normal runs never auto-create new baselines | Comparison only |

## Configuration

```typescript
const visual = new VisualRegression({
  snapshotsDir: '__snapshots__',          // Where baselines live
  diffDir: 'test-results/visual-diffs',    // Where diff images go on failure
  maxBaselines: 4,                          // Max valid states per snapshot
  comparatorOptions: {
    maxDiffPercentage: 0.5,                // % threshold
    maxStructuralPixels: 50,               // Structural pixel limit
    colorToleranceDelta: 25,               // Color sensitivity
    maxAlignmentShift: 3,                  // Shift detection radius
  },
});
```

### Per-assertion options

```typescript
await visual.assertPage(page, {
  name: 'dashboard',
  testFilePath: __filename,
  fullPage: true,
  animations: 'disabled',
  mask: [page.locator('.timestamp')],
  maskSelectors: ['iframe', '.ad-banner'],
  maskRegions: [{ x: 10, y: 50, width: 200, height: 30 }],
  maxBaselines: 4,
  comparatorOptions: { maxDiffPercentage: 1.0 },
  update: false,
});
```

## Usage Examples

### Basic page comparison

```typescript
import { VisualRegression } from '../main/utils';

const visual = new VisualRegression();

const result = await visual.assertPage(page, {
  name: 'login-page',
  testFilePath: __filename,
});
expect(result.passed).toBe(true);
```

### Element comparison

```typescript
const result = await visual.assertElement(
  page.locator('.shopping_cart_container'),
  page,
  { name: 'cart-icon', testFilePath: __filename },
);
expect(result.passed).toBe(true);
```

### Mask dynamic elements (Locators)

```typescript
await visual.assertPage(page, {
  name: 'dashboard',
  testFilePath: __filename,
  mask: [
    page.locator('.timestamp'),
    page.locator('.user-avatar'),
    page.locator('[data-test="notification-badge"]'),
  ],
});
```

### Mask by CSS selector (iframes, ads, spinners)

```typescript
await visual.assertPage(page, {
  name: 'report-page',
  testFilePath: __filename,
  maskSelectors: ['iframe', '.ad-banner', '.loading-spinner'],
});
```

### Mask by pixel region (coordinates)

```typescript
await visual.assertElement(card, page, {
  name: 'product-card',
  testFilePath: __filename,
  maskRegions: [
    { x: 10, y: 150, width: 100, height: 20 }, // Price area
    { x: 200, y: 5, width: 50, height: 15 },   // Badge
  ],
});
```

### Multiple valid baselines

```typescript
// Save different valid states
await visual.assertPage(page, { name: 'cart', testFilePath: __filename, update: true });
await addItemToCart();
await visual.assertPage(page, { name: 'cart', testFilePath: __filename, update: true });

// Later: passes if current state matches ANY baseline
const result = await visual.assertPage(page, { name: 'cart', testFilePath: __filename });
```

### Updating baselines

```bash
UPDATE_SNAPSHOTS=true npx playwright test
```

### Inspecting failures

```typescript
const result = await visual.assertPage(page, { name: 'checkout', testFilePath: __filename });
if (!result.passed) {
  console.log(result.summary);
  console.log(`Closest baseline: ${result.matchedIndex + 1}`);
  console.log(`Severity: ${result.analysis.severity}`);
  console.log(`Diff: ${result.analysis.diffPercentage}%`);
  console.log(`Diff image: ${result.diffPath}`);
}
```

## Comparison with Playwright's Built-in

| Feature | Playwright `toHaveScreenshot()` | VisualRegression |
|---------|---------------------------------|-----------------|
| Multi-baseline | ❌ One baseline only | ✅ Up to 4 valid states |
| Element masking | ✅ `mask` option | ✅ `mask` + `maskSelectors` + `maskRegions` |
| Region masking (coordinates) | ❌ | ✅ Black out pixel areas |
| CSS selector masking | ❌ (only `stylePath`) | ✅ Inline injection |
| Diff classification | ❌ Binary pass/fail | ✅ AA, alignment, color, structural |
| Failure analysis | ❌ Just "pixels differ" | ✅ Category breakdown + regions |
| Tolerance tuning | `maxDiffPixels` only | ✅ Per-category thresholds |

## Tips & Best Practices

- Use `animations: 'disabled'` (the default) to avoid flaky diffs from CSS transitions.
- Use `maskSelectors` for elements that change between runs (timestamps, ads, live data).
- Use `maskRegions` when you know the exact coordinates of dynamic areas.
- Use `mask` (Locator array) for elements you can target with selectors.
- Keep `maxBaselines` at 4 or fewer — too many baselines dilute the value of visual regression.
- Run `UPDATE_SNAPSHOTS=true` only on a clean, known-good state. Review the new baseline before committing.
- Commit the `__snapshots__/` directory to version control so CI has baselines.
- For raw image-vs-image diffing without baseline management, use [`ScreenshotComparator`](screenshot-comparator.md) directly — it's the engine `VisualRegression` is built on.

# Visual Regression

**File:** `src/main/utils/visual-regression.ts`

## Overview

Enhanced visual comparison that builds on Playwright's screenshot capabilities. Adds element masking, region masking, multi-baseline support, and intelligent diff analysis using the ScreenshotComparator engine.

## How It Works

```
1. Capture screenshot
   ├── Inject CSS to hide maskSelectors (iframes, spinners)
   ├── Use Playwright's mask option for Locator-based hiding
   └── Apply region masks (gray rectangles on pixel coordinates)

2. Compare against baselines (up to 4)
   ├── Uses ScreenshotComparator for each baseline
   ├── Classifies diffs: anti-aliasing, alignment, color, structural
   └── Passes if ANY baseline matches (accounting for tolerance)

3. Result
   ├── passed: true/false
   ├── analysis: full diff breakdown
   └── summary: human-readable report
```

## Configuration

```typescript
const visual = new VisualRegression({
  snapshotsDir: '__snapshots__',       // Where baselines live
  diffDir: 'test-results/visual-diffs', // Where diff images go on failure
  maxBaselines: 4,                      // Max valid states per snapshot
  comparatorOptions: {
    maxDiffPercentage: 0.5,            // % threshold
    maxStructuralPixels: 50,           // Structural pixel limit
    colorToleranceDelta: 25,           // Color sensitivity
    maxAlignmentShift: 3,              // Shift detection radius
  },
});
```

## Usage Examples

### Basic page comparison

```typescript
const result = await visual.assertPage(page, {
  name: 'login-page',
  testFilePath: __filename,
});
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
    { x: 10, y: 150, width: 100, height: 20 },  // Price area
    { x: 200, y: 5, width: 50, height: 15 },    // Badge
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

### Update baselines

```bash
UPDATE_SNAPSHOTS=true npx playwright test
```

## Comparison with Playwright's Built-in

| Feature | Playwright `toHaveScreenshot()` | VisualRegression |
|---------|-------------------------------|-----------------|
| Multi-baseline | ❌ One baseline only | ✅ Up to 4 valid states |
| Element masking | ✅ `mask` option | ✅ `mask` + `maskSelectors` + `maskRegions` |
| Region masking (coordinates) | ❌ | ✅ Black out pixel areas |
| CSS selector masking | ❌ (only `stylePath`) | ✅ Inline injection |
| Diff classification | ❌ Binary pass/fail | ✅ AA, alignment, color, structural |
| Failure analysis | ❌ Just "pixels differ" | ✅ Category breakdown + regions |
| Tolerance tuning | `maxDiffPixels` only | ✅ Per-category thresholds |

## Tips

- Use `maskSelectors` for elements that change between runs (timestamps, ads, live data)
- Use `maskRegions` when you know exact coordinates of dynamic areas
- Use `mask` (Locator array) for elements you can target with selectors
- Commit `__snapshots__/` to git so CI has baselines
- Run `UPDATE_SNAPSHOTS=true` after intentional UI changes

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
      win32/                  ← per-platform isolation
        baseline-1.png
        baseline-2.png
      linux/
        baseline-1.png
      darwin/
        baseline-1.png
    submit-button/
      linux/
        baseline-1.png
  inventory.spec.ts/
    product-grid/
      win32/
        baseline-1.png
```

Per-platform folders prevent false positives from font rendering and image decoder differences across Windows / Linux / macOS. The platform is auto-detected from `process.platform`. Override with the `VR_PLATFORM` env var if you need to force a specific bucket (e.g. running tests in a Docker container that should reuse the host's baselines).

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
  diffDir: '__visual-diffs__',             // Where diff images go on failure (at project root)
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

## Troubleshooting

### TypeScript Error: "Namespace 'Pixelmatch' has no exported member 'default'"

If you're using `screenshot-comparator.ts` in a different project and encounter this TypeScript error, it's due to how the `pixelmatch` package exports its types. The fix is already implemented in this utility, but if you copied the file before the fix, ensure the `loadPixelmatch()` function looks like this:

```typescript
async function loadPixelmatch(): Promise<(
  img1: Buffer | Uint8Array | Uint8ClampedArray,
  img2: Buffer | Uint8Array | Uint8ClampedArray,
  output: Buffer | Uint8Array | Uint8ClampedArray | null,
  width: number,
  height: number,
  options?: {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: Buffer | Uint8Array | Uint8ClampedArray;
  }
) => number> {
  const mod = await (eval('import("pixelmatch")') as Promise<any>);
  return mod.default || mod;
}
```

This handles both default and named exports properly across different bundler configurations.

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

Multiple baselines allow you to accept several valid visual states for a single component. This is useful when:
- UI can render in acceptable variations (sort orders, empty/populated states)
- Different browser rendering produces slightly different outputs
- A/B testing scenarios where multiple designs are valid
- Dark mode vs light mode variations

#### Capturing Multiple Baselines

There are three ways to capture multiple baselines:

**Method 1: Sequential captures in a single test**
```typescript
// Capture first state
await visual.assertPage(page, { 
  name: 'cart', 
  testFilePath: __filename, 
  update: true 
});

// Change state
await addItemToCart();

// Capture second state
await visual.assertPage(page, { 
  name: 'cart', 
  testFilePath: __filename, 
  update: true 
});

// Later: passes if current state matches ANY baseline
const result = await visual.assertPage(page, { name: 'cart', testFilePath: __filename });
```

**Method 2: Multiple test runs with UPDATE_SNAPSHOTS=true**
```bash
# Run 1: Capture state A
npm run test:visual -- --grep "cart test"

# Manually change app state (e.g., toggle dark mode, change sort order)

# Run 2: Capture state B
UPDATE_SNAPSHOTS=true npm run test:visual -- --grep "cart test"

# Run 3: Capture state C (if needed)
UPDATE_SNAPSHOTS=true npm run test:visual -- --grep "cart test"
```

**Method 3: Dedicated baseline capture script**
```typescript
// scripts/capture-baselines.ts
import { test } from '@playwright/test';
import { VisualRegression } from '../src/main/utils';

test.describe('Baseline Capture', () => {
  const visual = new VisualRegression();
  
  test('capture product list - empty state', async ({ page }) => {
    await page.goto('/products');
    await visual.assertPage(page, {
      name: 'product-list',
      testFilePath: __filename,
      update: true,
    });
  });
  
  test('capture product list - populated state', async ({ page }) => {
    await page.goto('/products');
    await addMockProducts(page);
    await visual.assertPage(page, {
      name: 'product-list',
      testFilePath: __filename,
      update: true,
    });
  });
  
  test('capture product list - grid view', async ({ page }) => {
    await page.goto('/products');
    await page.click('[data-view="grid"]');
    await visual.assertPage(page, {
      name: 'product-list',
      testFilePath: __filename,
      update: true,
    });
  });
});
```

Then run:
```bash
UPDATE_SNAPSHOTS=true npx playwright test scripts/capture-baselines.ts
```

#### Baseline Rotation

When you exceed `maxBaselines` (default: 4), the oldest baseline is automatically removed:
```
Before: baseline-1.png, baseline-2.png, baseline-3.png, baseline-4.png
After adding 5th: baseline-1.png (deleted), baseline-2→1, baseline-3→2, baseline-4→3, new→baseline-4.png
```

#### Managing Baselines

**List current baselines:**
```bash
ls -R __snapshots__/your-test.spec.ts/snapshot-name/
```

**Delete specific baselines manually:**
```bash
rm __snapshots__/your-test.spec.ts/snapshot-name/win32/baseline-2.png
```

**Reset all baselines for a snapshot:**
```bash
rm -rf __snapshots__/your-test.spec.ts/snapshot-name/
```

### Updating baselines

```bash
UPDATE_SNAPSHOTS=true npx playwright test
```

### Inspecting failures

When a visual test fails, diff images are automatically saved to `__visual-diffs__/` at the project root with a structured folder layout matching your test organization.

```typescript
const result = await visual.assertPage(page, { name: 'checkout', testFilePath: __filename });
if (!result.passed) {
  console.log(result.summary);
  console.log(`Closest baseline: ${result.matchedIndex + 1}`);
  console.log(`Severity: ${result.analysis.severity}`);
  console.log(`Diff: ${result.analysis.diffPercentage}%`);
  console.log(`Diff image: ${result.diffPath}`);
  // Diff artifacts saved to: __visual-diffs__/<spec-file>/<snapshot-name>/
}
```

**Diff artifacts structure:**
```
__visual-diffs__/
  visual-regression.spec.ts/           ← Test file name
    checkout/                          ← Snapshot name
      checkout-baseline.png            ← Baseline image (closest match)
      checkout-actual.png              ← Actual screenshot that failed
      checkout-diff.png                ← Visual diff highlighting changes
  login.spec.ts/
    login-form/
      login-form-baseline.png
      login-form-actual.png
      login-form-diff.png
```

**Key features:**
- **Baseline image**: The closest matching baseline from your `__snapshots__` directory
- **Actual image**: The screenshot captured during the test run that failed
- **Diff image**: Visual comparison highlighting the differences with colored regions
- **Organized structure**: Mirrors your test file and snapshot naming for easy navigation
- **Automatic cleanup**: Each test run overwrites previous diff artifacts with the same name

The `__visual-diffs__/` directory is automatically created and added to `.gitignore` to prevent committing test artifacts.

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

## Generating Baselines for CI

Visual baselines are platform-specific because fonts, image decoders, and color profiles differ between Windows, Linux, and macOS. Each platform gets its own folder under the snapshot name.

To generate Linux baselines for GitHub Actions CI without leaving Windows:

1. Push your code to a branch on GitHub.
2. Go to **Actions → Playwright Tests → Run workflow**.
3. Set `update_snapshots = true` and run.
4. The job runs on `ubuntu-latest`, captures fresh baselines, and pushes them back to your branch with a `[skip ci]` commit.
5. Pull the changes locally — your repo now has both `win32/` and `linux/` baselines.

For macOS baselines, run the same flow on a self-hosted macOS runner or set `VR_PLATFORM=darwin` and capture on a macOS dev machine.

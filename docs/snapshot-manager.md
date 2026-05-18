# Snapshot Manager

**File:** `src/main/utils/snapshot-manager.ts`

## Overview

SnapshotManager provides multi-baseline visual regression testing. Unlike Playwright's built-in single-baseline approach, it stores up to 4 valid baseline variants per snapshot. A test passes if the actual screenshot matches ANY stored baseline — ideal for UIs with acceptable visual variations (dark/light mode, A/B tests, platform rendering differences).

## How It Works

1. **First run** — No baselines exist. The screenshot is saved as `baseline-1.png` and the test passes.
2. **Subsequent runs** — The actual screenshot is compared against ALL stored baselines using `ScreenshotComparator`. If any baseline matches (accounting for anti-aliasing, alignment shifts, etc.), the test passes.
3. **Update mode** — When `UPDATE_SNAPSHOTS=true` or `updateBaseline: true`, the current screenshot is added as a new baseline variant.
4. **Rotation** — When at `maxBaselines` capacity (default: 4), the oldest baseline is removed and remaining ones shift down.

### Folder Structure

```
__snapshots__/
  login.spec.ts/              ← subfolder per spec file
    login-form/               ← subfolder per snapshot name
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

## Configuration

```typescript
const snapshots = new SnapshotManager({
  snapshotsDir: '__snapshots__',              // Root directory for baselines
  diffOutputDir: 'test-results/snapshot-diffs', // Where diff images are saved on failure
  maxBaselines: 4,                            // Max valid baselines per snapshot
  comparatorOptions: {                        // ScreenshotComparator settings
    threshold: 0.1,
    maxDiffPercentage: 0.5,
    maxStructuralPixels: 50,
  },
});
```

### Per-assertion options

```typescript
await snapshots.assertScreenshot(page, {
  name: 'login-form',
  testFilePath: __filename,
  updateBaseline: false,
  comparatorOptions: { maxDiffPercentage: 1.0 },
  screenshotOptions: {
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('.dynamic-ad')],
  },
});
```

## Usage Examples

### Basic page screenshot

```typescript
const snapshots = new SnapshotManager();

const result = await snapshots.assertScreenshot(page, {
  name: 'inventory-page',
  testFilePath: __filename,
});
expect(result.isMatch).toBe(true);
```

### Element screenshot

```typescript
const result = await snapshots.assertElementScreenshot(
  page.locator('.shopping_cart_container'),
  { name: 'cart-icon', testFilePath: __filename },
);
expect(result.isMatch).toBe(true);
```

### Updating baselines

```bash
# Add a new baseline variant for all snapshots
UPDATE_SNAPSHOTS=true npx playwright test
```

Or programmatically:

```typescript
await snapshots.assertScreenshot(page, {
  name: 'login-form',
  testFilePath: __filename,
  updateBaseline: true,
});
```

### Inspecting results on failure

```typescript
const result = await snapshots.assertScreenshot(page, { name: 'checkout' });
if (!result.isMatch) {
  console.log(result.summary);
  // Shows: which baseline was closest, diff %, severity breakdown
  console.log(`Best match: baseline ${result.matchedBaselineIndex + 1}`);
  console.log(`Diff: ${result.bestResult.diffPercentage}%`);
}
```

## Tips & Best Practices

- Use `animations: 'disabled'` (the default) to avoid flaky diffs from CSS transitions.
- Mask dynamic content (timestamps, ads, avatars) with `screenshotOptions.mask` to reduce false positives.
- Keep `maxBaselines` at 4 or fewer — too many baselines dilute the value of visual regression.
- Run `UPDATE_SNAPSHOTS=true` only on a clean, known-good state. Review the new baseline before committing.
- Commit the `__snapshots__/` directory to version control so the team shares baselines.

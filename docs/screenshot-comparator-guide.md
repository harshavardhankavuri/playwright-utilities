# Screenshot Comparator & Snapshot Manager — Detailed Guide

## Overview

This framework provides two complementary utilities for visual testing:

1. **ScreenshotComparator** — The engine that compares two images and intelligently classifies pixel differences into categories (anti-aliasing, alignment shift, color tolerance, structural).

2. **SnapshotManager** — The orchestrator that manages multiple valid baselines per test, stores them alongside test files, and uses ScreenshotComparator for intelligent fallback analysis when no baseline matches.

```
┌─────────────────────────────────────────────────────────────────┐
│  SnapshotManager (orchestrator)                                 │
│                                                                 │
│  • Stores multiple baselines per test                           │
│  • Tries all baselines — passes if ANY match                   │
│  • Falls back to ScreenshotComparator for analysis              │
│  • Stores snapshots alongside test files (folder-level)         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ScreenshotComparator (engine)                            │  │
│  │                                                           │  │
│  │  • Pixel-level comparison using pixelmatch                │  │
│  │  • Anti-aliasing detection (3x3 neighborhood analysis)    │  │
│  │  • Alignment shift detection (N-px radius search)         │  │
│  │  • Color tolerance (perceptual weighted RGB distance)     │  │
│  │  • Flood-fill clustering into regions                     │  │
│  │  • Severity scoring: NONE → NEGLIGIBLE → MINOR → MAJOR   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: ScreenshotComparator

### What It Does

Takes two PNG buffers (baseline vs actual) and produces a detailed analysis:
- **Is it a match?** (yes/no, accounting for tolerance)
- **What kind of differences?** (noise, alignment, color, or structural)
- **Where are the differences?** (clustered into regions with coordinates)
- **How severe?** (NONE, NEGLIGIBLE, MINOR, MAJOR)

### How It Classifies Differences

Every differing pixel goes through this classification pipeline:

```
Pixel differs between baseline and actual
         │
         ▼
┌─ Is it anti-aliasing? ──────────────────────────────────────┐
│  Check: Does the pixel sit on a high-contrast edge AND      │
│  does the other image have a similar pixel in its 3x3       │
│  neighborhood?                                              │
│  YES → classify as ANTI_ALIASING (noise, ignore)            │
└─────────────────────────────────────────────────────────────┘
         │ NO
         ▼
┌─ Is it an alignment shift? ─────────────────────────────────┐
│  Check: Does the baseline pixel's exact color exist within  │
│  a 1-3px radius in the actual image?                        │
│  YES → classify as ALIGNMENT_SHIFT (layout jitter, ignore)  │
└─────────────────────────────────────────────────────────────┘
         │ NO
         ▼
┌─ Is it within color tolerance? ─────────────────────────────┐
│  Check: Is the perceptual color distance (weighted RGB)     │
│  below the colorToleranceDelta threshold?                   │
│  YES → classify as COLOR_TOLERANCE (rendering variance)     │
└─────────────────────────────────────────────────────────────┘
         │ NO
         ▼
┌─ STRUCTURAL ────────────────────────────────────────────────┐
│  None of the above → this is a real visual difference.      │
│  Likely a bug.                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Options

```typescript
import { ScreenshotComparator } from '../main/utils';

const comparator = new ScreenshotComparator({
  // Pixelmatch threshold (0-1). Lower = stricter.
  // 0.1 is good for most cases. Use 0.05 for pixel-perfect requirements.
  threshold: 0.1,

  // Maximum % of total pixels that can differ and still be considered a match.
  // 0.5 means up to 0.5% of pixels can differ.
  maxDiffPercentage: 0.5,

  // Maximum number of STRUCTURAL pixels before the comparison fails.
  // Even if total diff % is low, >50 structural pixels = real issue.
  maxStructuralPixels: 50,

  // Color delta (0-255) below which a diff is "color tolerance" not "structural".
  // 25 is a good default. Increase for apps with dynamic theming.
  colorToleranceDelta: 25,

  // How far (in pixels) to search for alignment shifts.
  // 3 means: if the same pixel exists within 3px in any direction, it's a shift.
  maxAlignmentShift: 3,

  // Minimum cluster size to be considered a "region".
  // Clusters smaller than this are downgraded to noise.
  minClusterSize: 4,

  // Directory to save diff images (red/green overlay PNGs).
  // Leave empty to skip saving.
  outputDir: 'test-results/diff-images',

  // Whether to detect anti-aliasing (recommended: true).
  detectAntiAliasing: true,
});
```

### Basic Usage

```typescript
import { ScreenshotComparator, DiffSeverity } from '../main/utils';

test('visual regression check', async ({ page }) => {
  await page.goto('/dashboard');

  const comparator = new ScreenshotComparator({
    outputDir: 'test-results/diff-images',
  });

  // Take current screenshot
  const actual = await page.screenshot({ animations: 'disabled' });

  // Load baseline from file
  const baseline = fs.readFileSync('baselines/dashboard.png');

  // Compare
  const result = await comparator.compare(baseline, actual, 'dashboard');

  // Assert
  expect(result.isMatch).toBe(true);

  // If it fails, the summary tells you exactly what happened:
  if (!result.isMatch) {
    console.log(result.summary);
    // ❌ FAIL: Significant structural differences detected — likely a real visual bug.
    //    Diff: 3.383% of pixels differ.
    //    Breakdown:
    //      • Anti-aliasing:   3717 px
    //      • Alignment shift: 0 px
    //      • Color tolerance: 1 px
    //      • Structural:      35898 px
    //    Structural regions: 66
    //      → [218,246] 49x31 (1095px, avg Δ139)
    //      → [972,246] 33x46 (1083px, avg Δ132)
  }
});
```

### Comparing Files from Disk

```typescript
const result = await comparator.compareFiles(
  'baselines/homepage.png',
  'test-results/actual-homepage.png',
  'homepage-comparison',
);
```

### Understanding the Result Object

```typescript
interface ComparisonResult {
  isMatch: boolean;           // Final verdict: pass or fail
  severity: DiffSeverity;    // NONE | NEGLIGIBLE | MINOR | MAJOR
  summary: string;           // Human-readable report
  totalDiffPixels: number;   // Raw count of differing pixels
  diffPercentage: number;    // % of total pixels that differ
  categoryBreakdown: {       // Pixel count per category
    'anti-aliasing': number;
    'alignment-shift': number;
    'color-tolerance': number;
    'structural': number;
  };
  regions: DiffRegion[];     // Clustered diff areas with coordinates
  diffImagePath?: string;    // Path to saved diff overlay image
  dimensions: { width: number; height: number };
}
```

### Severity Decision Logic

| Condition | Severity | isMatch |
|-----------|----------|---------|
| 0 diff pixels | NONE | ✅ true |
| Only AA + color tolerance, no structural | NEGLIGIBLE | ✅ true |
| Some alignment shifts, structural ≤ threshold | MINOR | ✅ true (if within limits) |
| Structural > maxStructuralPixels | MAJOR | ❌ false |

### Real-World Examples

**Example 1: Font rendering difference across OS**
```
Severity: NEGLIGIBLE
Breakdown: Anti-aliasing: 2,400 px | Structural: 0 px
Verdict: PASS — just sub-pixel font smoothing differences
```

**Example 2: Element shifted 2px due to CSS change**
```
Severity: MINOR
Breakdown: Alignment shift: 16,000 px | Structural: 0 px
Verdict: PASS — all pixels found within 3px radius, no real content change
```

**Example 3: Button color changed from blue to red**
```
Severity: MAJOR
Breakdown: Structural: 35,000 px
Verdict: FAIL — real visual change detected
```

---

## Part 2: SnapshotManager

### What It Does

Manages the full lifecycle of visual baselines:
1. **First run:** No baseline exists → takes screenshot, saves as `baseline-1.png`
2. **Subsequent runs:** Compares against ALL stored baselines → passes if ANY match
3. **Multiple valid states:** Store N baselines (e.g. light mode, dark mode, different data)
4. **Failure analysis:** When no baseline matches, uses ScreenshotComparator to explain WHY
5. **Folder-level storage:** Baselines live alongside the test file that created them
6. **Protected baselines:** Once saved, baselines cannot be deleted programmatically

### Directory Structure

When you pass `testFilePath: __filename`, snapshots are stored alongside the test:

```
src/tests/
├── login/
│   ├── login.spec.ts
│   ├── login-dashboard-snapshots/      ← created automatically
│   │   ├── baseline-1.png             ← first valid state
│   │   ├── baseline-2.png             ← second valid state (e.g. dark mode)
│   │   └── baseline-3.png             ← third valid state
│   └── login-form-snapshots/
│       └── baseline-1.png
├── home.spec.ts
└── home-heading-snapshots/
    └── baseline-1.png
```

The folder name follows the pattern: `<test-file-basename>-<snapshot-name>-snapshots/`

### Basic Usage

```typescript
import { test } from '../main/fixtures';
import { SnapshotManager } from '../main/utils';

const manager = new SnapshotManager();

test('homepage visual test', async ({ page }) => {
  await page.goto('/');

  const result = await manager.assertScreenshot(page, {
    name: 'homepage',
    testFilePath: __filename,  // Stores snapshots next to this test file
  });

  expect(result.isMatch).toBe(true);
});
```

**First run:** Creates `<test-dir>/home-homepage-snapshots/baseline-1.png` and passes.
**Second run:** Compares against `baseline-1.png` — passes if it matches.

### Element-Level Screenshots

```typescript
test('button visual test', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Submit' });

  const result = await manager.assertElementScreenshot(button, {
    name: 'submit-button',
    testFilePath: __filename,
  });

  expect(result.isMatch).toBe(true);
});
```

### Multiple Valid Baselines

Some elements have multiple valid visual states. Store all of them:

```typescript
test.describe('theme support', () => {
  test('save light mode baseline', async ({ page }) => {
    await page.goto('/');
    // App is in light mode by default
    const result = await manager.assertScreenshot(page, {
      name: 'dashboard',
      testFilePath: __filename,
      updateBaseline: true,  // Force save as new baseline
    });
  });

  test('save dark mode baseline', async ({ page }) => {
    await page.goto('/');
    await page.click('#dark-mode-toggle');
    const result = await manager.assertScreenshot(page, {
      name: 'dashboard',
      testFilePath: __filename,
      updateBaseline: true,  // Adds baseline-2.png
    });
  });

  test('dashboard matches one of the baselines', async ({ page }) => {
    await page.goto('/');
    // Whether light or dark mode, it should match one baseline
    const result = await manager.assertScreenshot(page, {
      name: 'dashboard',
      testFilePath: __filename,
    });

    expect(result.isMatch).toBe(true);
    // result.matchedBaselineIndex tells you WHICH one matched
    console.log(`Matched baseline ${result.matchedBaselineIndex + 1}`);
  });
});
```

### Adding Baselines Programmatically

```typescript
// Take a screenshot and add it as a baseline
const screenshot = await page.screenshot({ animations: 'disabled' });
manager.addBaseline('dashboard', screenshot, __filename);

// List existing baselines
const baselines = manager.listBaselines('dashboard', __filename);
// ['baseline-1.png', 'baseline-2.png']
```

### Updating Baselines

Two ways to add new baselines:

```bash
# Method 1: Environment variable (updates ALL snapshot assertions in the run)
UPDATE_SNAPSHOTS=true npx playwright test
```

```typescript
// Method 2: Per-assertion (updates only this specific snapshot)
await manager.assertScreenshot(page, {
  name: 'dashboard',
  testFilePath: __filename,
  updateBaseline: true,
});
```

Both methods ADD a new baseline file (baseline-2, baseline-3, etc.) — they never overwrite or delete existing baselines.

### Understanding Failure Output

When no baseline matches, the summary provides actionable information:

```
❌ FAIL: Screenshot "dashboard" did not match any of 2 baseline(s).

   Closest match: baseline 1 (baseline-1.png)
   ❌ FAIL: Significant structural differences detected — likely a real visual bug.

   Per-baseline results:
     ❌ baseline-1.png: 12.362% diff, severity=major
     ❌ baseline-2.png: 45.100% diff, severity=major

   Intelligent analysis of closest match:
   ❌ FAIL: Significant structural differences detected — likely a real visual bug.
      Diff: 12.362% of pixels differ.
      Breakdown:
        • Anti-aliasing:   25191 px
        • Alignment shift: 487497 px
        • Color tolerance: 864 px
        • Structural:      101346 px
      Structural regions: 77
        → [87,681] 165x21 (1896px, avg Δ87)
        → [847,681] 104x21 (1343px, avg Δ87)

   💡 If this is a valid new state, run with UPDATE_SNAPSHOTS=true to save as a new baseline.
```

This tells you:
- How many baselines were tried
- Which was closest
- Whether the diff is noise/alignment (not a bug) or structural (real bug)
- Exact coordinates of structural regions

### Screenshot Options

```typescript
await manager.assertScreenshot(page, {
  name: 'full-page',
  testFilePath: __filename,
  screenshotOptions: {
    fullPage: true,              // Capture entire scrollable page
    animations: 'disabled',     // Freeze CSS animations (default)
    mask: [page.locator('.ad-banner')],  // Mask dynamic elements
    omitBackground: true,       // Transparent background
  },
  comparatorOptions: {
    maxDiffPercentage: 1.0,     // Allow up to 1% diff for this assertion
    maxStructuralPixels: 100,   // More lenient structural threshold
    maxAlignmentShift: 5,       // Allow up to 5px shifts
  },
});
```

### Using with Fixtures (Recommended)

The `SnapshotManager` is available as a fixture:

```typescript
import { test, expect } from '../main/fixtures';

test('visual test with fixture', async ({ page, snapshotManager }) => {
  await page.goto('/');

  const result = await snapshotManager.assertScreenshot(page, {
    name: 'homepage',
    testFilePath: __filename,
  });

  expect(result.isMatch).toBe(true);
});
```

### Baseline Protection

Baselines are **immutable** once created:
- `removeBaseline()` is disabled — logs a warning and does nothing
- `clearBaselines()` is disabled — logs a warning and does nothing
- To remove outdated baselines, use `git rm` or delete files manually
- This ensures baselines are always tracked in version control

### Complete Test Example

```typescript
import { test, expect } from '../main/fixtures';
import { SnapshotManager } from '../main/utils';

const manager = new SnapshotManager();

test.describe('Invoice Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/invoices/123');
    await page.waitForLoadState('networkidle');
    // Disable animations for deterministic screenshots
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        (el as HTMLElement).style.animation = 'none';
        (el as HTMLElement).style.transition = 'none';
      });
    });
  });

  test('full page matches baseline', async ({ page }) => {
    const result = await manager.assertScreenshot(page, {
      name: 'invoice-full-page',
      testFilePath: __filename,
      screenshotOptions: { fullPage: true },
    });
    expect(result.isMatch).toBe(true);
  });

  test('header section matches baseline', async ({ page }) => {
    const header = page.locator('.invoice-header');
    const result = await manager.assertElementScreenshot(header, {
      name: 'invoice-header',
      testFilePath: __filename,
    });
    expect(result.isMatch).toBe(true);
  });

  test('line items table matches baseline', async ({ page }) => {
    const table = page.locator('.line-items-table');
    const result = await manager.assertElementScreenshot(table, {
      name: 'invoice-line-items',
      testFilePath: __filename,
      comparatorOptions: {
        // More lenient for tables (font rendering varies)
        maxStructuralPixels: 100,
        colorToleranceDelta: 30,
      },
    });
    expect(result.isMatch).toBe(true);
  });
});
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run visual tests
  run: npx playwright test --project=chromium

# To update baselines after intentional UI changes:
- name: Update baselines
  run: UPDATE_SNAPSHOTS=true npx playwright test --project=chromium
  # Then commit the new baseline files
```

### Tips & Best Practices

1. **Always disable animations** — Use `animations: 'disabled'` in screenshot options to avoid flaky diffs from CSS transitions.

2. **Mask dynamic content** — Use the `mask` option to hide elements with changing content (timestamps, ads, user avatars).

3. **Use element screenshots** — Full-page screenshots are fragile. Prefer element-level screenshots for specific components.

4. **One baseline per OS/browser** — Font rendering differs across platforms. Consider separate baselines per project (chromium/firefox/webkit).

5. **Commit baselines to git** — Baselines are source-controlled artifacts. Review them in PRs just like code changes.

6. **Use `testFilePath: __filename`** — This keeps baselines organized next to their tests, making them easy to find and review.

7. **Don't over-tighten thresholds** — The defaults (0.5% diff, 50 structural pixels) work well for most apps. Only tighten for pixel-perfect requirements.

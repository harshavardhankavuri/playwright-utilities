# Screenshot Comparator

**File:** `src/main/utils/screenshot-comparator.ts`

## Overview

ScreenshotComparator is the **low-level pixel-diff engine** behind the framework. It takes two PNG buffers (or file paths) and produces a detailed analysis classifying every differing pixel as anti-aliasing noise, alignment shift, color tolerance, or structural change. It does not capture screenshots, manage baselines, or apply masking.

For day-to-day visual testing, use [`VisualRegression`](visual-regression.md) instead — it wraps this engine with capture, masking, and multi-baseline storage.

Use `ScreenshotComparator` directly only when you need raw image-vs-image comparison with full control: comparing PDFs rendered to PNG, diffing two arbitrary buffers from external sources, or building your own visual testing flow.

## How It Works

The comparison pipeline runs in 9 deterministic steps:

1. **Dimension check** — Mismatched dimensions immediately fail as MAJOR.
2. **pixelmatch** — Raw pixel diff with configurable threshold and AA detection.
3. **Diff map** — Builds a map of all differing pixels with perceptual color deltas (weighted RGB).
4. **Anti-aliasing detection** — Identifies pixels on high-contrast edges where the other image has a similar pixel nearby (sub-pixel rendering noise).
5. **Alignment shift detection** — For each diff pixel, searches within `maxAlignmentShift` (default: 3px) in the other image for a matching pixel.
6. **Classification** — Each diff pixel is assigned a category: AA, alignment, color-tolerance (delta ≤ 25), or structural.
7. **Clustering** — Adjacent diff pixels are grouped into regions via flood-fill. Small clusters (< `minClusterSize`) are downgraded to noise.
8. **Severity scoring** — Overall severity is determined from the category breakdown.
9. **Match decision** — Based on severity, structural pixel count, and diff percentage.

### Diff Categories

| Category | Description | Typical Cause |
|----------|-------------|---------------|
| `anti-aliasing` | Sub-pixel rendering noise | Font smoothing, browser engine differences |
| `alignment-shift` | 1–3px positional jitter | Layout rounding, scroll position |
| `color-tolerance` | Minor color variation (Δ ≤ 25) | Gamma, rendering engine, compression |
| `structural` | Meaningful visual difference | Actual UI bug |

### Severity Levels

| Severity | Meaning | Match? |
|----------|---------|--------|
| `NONE` | Identical images | ✅ |
| `NEGLIGIBLE` | Only AA/sub-pixel noise | ✅ |
| `MINOR` | Small alignment or color shifts | ✅ (if structural < threshold) |
| `MAJOR` | Significant structural differences | ❌ |

## Configuration

```typescript
const comparator = new ScreenshotComparator({
  threshold: 0.1,              // pixelmatch sensitivity (lower = stricter)
  maxDiffPercentage: 0.5,      // Max % of diff pixels to still pass
  maxStructuralPixels: 50,     // Max structural pixels before MAJOR
  colorToleranceDelta: 25,     // Color delta below which = "color tolerance"
  maxAlignmentShift: 3,        // Pixel radius for alignment detection
  minClusterSize: 4,           // Min cluster size to count as structural
  outputDir: 'test-results/diffs', // Save diff images here (empty = no save)
  detectAntiAliasing: true,    // Enable AA pixel detection
});
```

## Usage Examples

### Compare two buffers

```typescript
const comparator = new ScreenshotComparator();

const baseline = fs.readFileSync('baseline.png');
const actual = await page.screenshot();

const result = await comparator.compare(baseline, actual, 'login-page');

if (!result.isMatch) {
  console.log(result.summary);
  console.log(`Structural pixels: ${result.categoryBreakdown.structural}`);
  console.log(`Diff image: ${result.diffImagePath}`);
}
```

### Compare files from disk

```typescript
const result = await comparator.compareFiles(
  'baselines/checkout.png',
  'actual/checkout.png',
  'checkout-comparison',
);
```

### Inspect category breakdown

```typescript
const result = await comparator.compare(baseline, actual);
console.log(result.categoryBreakdown);
// {
//   'anti-aliasing': 142,
//   'alignment-shift': 28,
//   'color-tolerance': 15,
//   'structural': 3
// }
```

### Inspect diff regions

```typescript
for (const region of result.regions) {
  console.log(`[${region.x},${region.y}] ${region.width}x${region.height} — ${region.category} (${region.pixelCount}px)`);
}
```

## Tips & Best Practices

- Start with default settings and only loosen thresholds if you get consistent false positives from known-acceptable rendering differences.
- Use `outputDir` during development to visually inspect diff images — red pixels are structural, yellow are AA.
- If cross-browser tests produce many alignment-shift diffs, increase `maxAlignmentShift` to 4–5.
- For high-DPI screenshots, you may need to increase `maxStructuralPixels` proportionally.
- For end-to-end visual testing with baselines, masking, and capture in one call, use `VisualRegression` instead — it uses this engine internally.

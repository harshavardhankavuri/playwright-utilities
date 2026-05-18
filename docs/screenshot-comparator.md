# Screenshot Comparator

**File:** `src/main/utils/screenshot-comparator.ts`

## Overview

ScreenshotComparator performs pixel-level image comparison with intelligent diff classification. Instead of a simple "X% pixels differ" result, it categorizes each differing pixel into one of four classes — anti-aliasing noise, alignment shifts, color tolerance, or structural changes — and assigns an overall severity level. This dramatically reduces false positives in visual regression testing.

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
- Combine with `SnapshotManager` for multi-baseline support — the comparator is the engine, the manager handles storage and rotation.

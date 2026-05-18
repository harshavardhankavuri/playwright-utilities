import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dynamic import wrapper for pixelmatch (ESM-only package).
 */
async function loadPixelmatch(): Promise<typeof import('pixelmatch').default> {
  const mod = await (eval('import("pixelmatch")') as Promise<{ default: typeof import('pixelmatch').default }>);
  return mod.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classification of a detected difference.
 */
export enum DiffCategory {
  /** Sub-pixel rendering / font smoothing / anti-aliasing noise */
  ANTI_ALIASING = 'anti-aliasing',
  /** Small positional shift (1-3px) — alignment/layout jitter */
  ALIGNMENT_SHIFT = 'alignment-shift',
  /** Minor color variation within tolerance (e.g. gamma, rendering engine) */
  COLOR_TOLERANCE = 'color-tolerance',
  /** Actual meaningful visual difference — real bug */
  STRUCTURAL = 'structural',
}

/**
 * Severity level for the overall comparison result.
 */
export enum DiffSeverity {
  /** No differences at all */
  NONE = 'none',
  /** Only noise-level differences (anti-aliasing, sub-pixel) */
  NEGLIGIBLE = 'negligible',
  /** Minor alignment or color shifts — likely not a bug */
  MINOR = 'minor',
  /** Significant structural differences — likely a real issue */
  MAJOR = 'major',
}

/**
 * A cluster of differing pixels grouped by spatial proximity.
 */
export interface DiffRegion {
  /** Bounding box of the region */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Number of differing pixels in this region */
  pixelCount: number;
  /** Classified category of this region */
  category: DiffCategory;
  /** Average color delta in this region (0-255 scale) */
  avgColorDelta: number;
}

/**
 * Full comparison result with intelligent analysis.
 */
export interface ComparisonResult {
  /** Whether the images are considered matching (accounting for tolerance) */
  isMatch: boolean;
  /** Overall severity of differences */
  severity: DiffSeverity;
  /** Human-readable summary of the comparison */
  summary: string;
  /** Total raw pixel difference count */
  totalDiffPixels: number;
  /** Percentage of pixels that differ */
  diffPercentage: number;
  /** Breakdown by category */
  categoryBreakdown: Record<DiffCategory, number>;
  /** Individual diff regions with classification */
  regions: DiffRegion[];
  /** Path to the generated diff image (if outputDir provided) */
  diffImagePath?: string;
  /** Dimensions of compared images */
  dimensions: { width: number; height: number };
}

/**
 * Configuration options for the comparator.
 */
export interface ComparatorOptions {
  /**
   * Anti-aliasing pixel tolerance (pixelmatch threshold).
   * Lower = stricter. Default: 0.1
   */
  threshold?: number;
  /**
   * Maximum percentage of diff pixels to still consider a match.
   * Default: 0.5 (0.5%)
   */
  maxDiffPercentage?: number;
  /**
   * Maximum number of structural diff pixels before failing.
   * Default: 50
   */
  maxStructuralPixels?: number;
  /**
   * Color delta below which a pixel diff is considered "color tolerance".
   * Range 0-255. Default: 25
   */
  colorToleranceDelta?: number;
  /**
   * Max shift in pixels to detect alignment issues.
   * Default: 3
   */
  maxAlignmentShift?: number;
  /**
   * Minimum cluster size (pixels) to be considered a region.
   * Smaller clusters are treated as noise. Default: 4
   */
  minClusterSize?: number;
  /**
   * Directory to write diff images. If not set, no diff image is saved.
   */
  outputDir?: string;
  /**
   * Include anti-aliasing detection (uses pixelmatch's built-in AA detection).
   * Default: true
   */
  detectAntiAliasing?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE COMPARATOR
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<ComparatorOptions> = {
  threshold: 0.1,
  maxDiffPercentage: 0.5,
  maxStructuralPixels: 50,
  colorToleranceDelta: 25,
  maxAlignmentShift: 3,
  minClusterSize: 4,
  outputDir: '',
  detectAntiAliasing: true,
};

/**
 * ScreenshotComparator — Low-level pixel-diff engine.
 *
 * This is a pure comparison engine. It takes two PNG buffers and produces a
 * detailed analysis classifying every differing pixel as anti-aliasing noise,
 * alignment shift, color tolerance, or structural change.
 *
 * It does NOT manage baselines, capture screenshots, or apply masking. For
 * end-to-end visual testing, use `VisualRegression` which uses this engine
 * internally and adds capture, masking, and multi-baseline storage.
 *
 * Use this class directly only when you need raw image-vs-image comparison
 * with full control over inputs and outputs (e.g. comparing PDFs rendered to
 * PNG, comparing two arbitrary buffers from external sources).
 *
 * Usage:
 *   const comparator = new ScreenshotComparator();
 *   const result = await comparator.compare(baselineBuffer, actualBuffer);
 *   if (!result.isMatch) { ... }
 *
 *   // Or from file paths:
 *   const result = await comparator.compareFiles('baseline.png', 'actual.png');
 */
export class ScreenshotComparator {
  private readonly options: Required<ComparatorOptions>;

  constructor(options?: ComparatorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compare two PNG buffers.
   */
  async compare(
    baselineBuffer: Buffer,
    actualBuffer: Buffer,
    name?: string,
  ): Promise<ComparisonResult> {
    const baseline = PNG.sync.read(baselineBuffer);
    const actual = PNG.sync.read(actualBuffer);

    // Handle dimension mismatch
    if (baseline.width !== actual.width || baseline.height !== actual.height) {
      return this.buildDimensionMismatchResult(baseline, actual);
    }

    const { width, height } = baseline;
    const totalPixels = width * height;

    // Step 1: Run pixelmatch with AA detection to get raw diff
    const diffPng = new PNG({ width, height });
    const pixelmatch = await loadPixelmatch();
    const rawDiffCount = pixelmatch(
      baseline.data,
      actual.data,
      diffPng.data,
      width,
      height,
      {
        threshold: this.options.threshold,
        includeAA: !this.options.detectAntiAliasing,
        alpha: 0.3,
        diffColor: [255, 0, 0],
        diffColorAlt: [0, 255, 0],
        aaColor: [255, 255, 0],
      },
    );

    // If no differences at all
    if (rawDiffCount === 0) {
      return {
        isMatch: true,
        severity: DiffSeverity.NONE,
        summary: 'Images are identical.',
        totalDiffPixels: 0,
        diffPercentage: 0,
        categoryBreakdown: this.emptyBreakdown(),
        regions: [],
        dimensions: { width, height },
      };
    }

    // Step 2: Build a diff pixel map with color deltas
    const diffMap = this.buildDiffMap(baseline, actual, width, height);

    // Step 3: Detect anti-aliasing pixels
    const aaPixels = this.detectAntiAliasingPixels(baseline, actual, width, height);

    // Step 4: Detect alignment shift pixels
    const shiftPixels = this.detectAlignmentShifts(
      baseline, actual, diffMap, width, height,
    );

    // Step 5: Classify each diff pixel
    const classified = this.classifyPixels(diffMap, aaPixels, shiftPixels);

    // Step 6: Cluster diff pixels into regions
    const regions = this.clusterIntoRegions(classified, width, height);

    // Step 7: Build category breakdown
    const categoryBreakdown = this.buildCategoryBreakdown(classified);

    // Step 8: Determine severity and match
    const diffPercentage = (rawDiffCount / totalPixels) * 100;
    const structuralCount = categoryBreakdown[DiffCategory.STRUCTURAL];
    const severity = this.determineSeverity(categoryBreakdown, diffPercentage);
    const isMatch = this.determineMatch(severity, structuralCount, diffPercentage);

    // Step 9: Save diff image if outputDir specified
    let diffImagePath: string | undefined;
    if (this.options.outputDir) {
      diffImagePath = this.saveDiffImage(diffPng, name);
    }

    const summary = this.buildSummary(
      severity, categoryBreakdown, diffPercentage, regions, structuralCount,
    );

    return {
      isMatch,
      severity,
      summary,
      totalDiffPixels: rawDiffCount,
      diffPercentage: Math.round(diffPercentage * 1000) / 1000,
      categoryBreakdown,
      regions,
      diffImagePath,
      dimensions: { width, height },
    };
  }

  /**
   * Compare two PNG files from disk.
   */
  async compareFiles(
    baselinePath: string,
    actualPath: string,
    name?: string,
  ): Promise<ComparisonResult> {
    const baselineBuffer = fs.readFileSync(baselinePath);
    const actualBuffer = fs.readFileSync(actualPath);
    return this.compare(baselineBuffer, actualBuffer, name || path.basename(baselinePath));
  }

  // ─── Internal: Diff Map ───────────────────────────────────────────────

  private buildDiffMap(
    baseline: PNG,
    actual: PNG,
    width: number,
    height: number,
  ): Map<number, number> {
    const diffMap = new Map<number, number>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const delta = this.colorDelta(
          baseline.data[idx], baseline.data[idx + 1], baseline.data[idx + 2],
          actual.data[idx], actual.data[idx + 1], actual.data[idx + 2],
        );
        if (delta > 0) {
          diffMap.set(y * width + x, delta);
        }
      }
    }
    return diffMap;
  }

  /**
   * Compute perceptual color distance (weighted Euclidean in RGB).
   * Returns value 0-255.
   */
  private colorDelta(
    r1: number, g1: number, b1: number,
    r2: number, g2: number, b2: number,
  ): number {
    // Weighted by human perception (green > red > blue)
    const dr = (r1 - r2) * 0.3;
    const dg = (g1 - g2) * 0.59;
    const db = (b1 - b2) * 0.11;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // ─── Internal: Anti-Aliasing Detection ────────────────────────────────

  /**
   * Detect anti-aliasing pixels by checking if a pixel sits on a high-contrast
   * edge and its neighbors have similar color in one of the two images.
   */
  private detectAntiAliasingPixels(
    baseline: PNG,
    actual: PNG,
    width: number,
    height: number,
  ): Set<number> {
    const aaPixels = new Set<number>();
    if (!this.options.detectAntiAliasing) return aaPixels;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const delta = this.colorDelta(
          baseline.data[idx], baseline.data[idx + 1], baseline.data[idx + 2],
          actual.data[idx], actual.data[idx + 1], actual.data[idx + 2],
        );
        if (delta <= 0) continue;

        if (this.isAntiAliased(baseline.data, x, y, width, height, actual.data) ||
            this.isAntiAliased(actual.data, x, y, width, height, baseline.data)) {
          aaPixels.add(y * width + x);
        }
      }
    }
    return aaPixels;
  }

  /**
   * Check if a pixel is likely anti-aliased by examining its neighborhood.
   * A pixel is AA if it has high contrast with neighbors in its own image
   * but the other image has a similar pixel nearby.
   */
  private isAntiAliased(
    imgData: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    otherData: Buffer,
  ): boolean {
    const idx = (y * width + x) * 4;
    const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];

    let highContrastNeighbors = 0;
    let similarInOther = 0;

    // Check 3x3 neighborhood
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const nIdx = (ny * width + nx) * 4;

        // Check contrast with neighbor in same image
        const neighborDelta = this.colorDelta(
          r, g, b,
          imgData[nIdx], imgData[nIdx + 1], imgData[nIdx + 2],
        );
        if (neighborDelta > 30) highContrastNeighbors++;

        // Check if other image has similar pixel nearby
        const otherDelta = this.colorDelta(
          r, g, b,
          otherData[nIdx], otherData[nIdx + 1], otherData[nIdx + 2],
        );
        if (otherDelta < 15) similarInOther++;
      }
    }

    // AA pixel: high contrast with own neighbors, but similar pixel exists nearby in other
    return highContrastNeighbors >= 2 && similarInOther >= 1;
  }

  // ─── Internal: Alignment Shift Detection ──────────────────────────────

  /**
   * Detect pixels that differ due to a small positional shift.
   * For each diff pixel, check if the baseline pixel exists within
   * maxAlignmentShift distance in the actual image.
   */
  private detectAlignmentShifts(
    baseline: PNG,
    actual: PNG,
    diffMap: Map<number, number>,
    width: number,
    height: number,
  ): Set<number> {
    const shiftPixels = new Set<number>();
    const maxShift = this.options.maxAlignmentShift;

    for (const [pixelIdx] of diffMap) {
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);
      const bIdx = (y * width + x) * 4;
      const br = baseline.data[bIdx];
      const bg = baseline.data[bIdx + 1];
      const bb = baseline.data[bIdx + 2];

      let foundMatch = false;

      // Search in a small window around the pixel in the actual image
      for (let dy = -maxShift; dy <= maxShift && !foundMatch; dy++) {
        for (let dx = -maxShift; dx <= maxShift && !foundMatch; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const aIdx = (ny * width + nx) * 4;
          const delta = this.colorDelta(
            br, bg, bb,
            actual.data[aIdx], actual.data[aIdx + 1], actual.data[aIdx + 2],
          );

          if (delta < 10) {
            foundMatch = true;
          }
        }
      }

      if (foundMatch) {
        shiftPixels.add(pixelIdx);
      }
    }

    return shiftPixels;
  }

  // ─── Internal: Classification ─────────────────────────────────────────

  private classifyPixels(
    diffMap: Map<number, number>,
    aaPixels: Set<number>,
    shiftPixels: Set<number>,
  ): Map<number, { category: DiffCategory; delta: number }> {
    const classified = new Map<number, { category: DiffCategory; delta: number }>();

    for (const [pixelIdx, delta] of diffMap) {
      let category: DiffCategory;

      if (aaPixels.has(pixelIdx)) {
        category = DiffCategory.ANTI_ALIASING;
      } else if (shiftPixels.has(pixelIdx)) {
        category = DiffCategory.ALIGNMENT_SHIFT;
      } else if (delta <= this.options.colorToleranceDelta) {
        category = DiffCategory.COLOR_TOLERANCE;
      } else {
        category = DiffCategory.STRUCTURAL;
      }

      classified.set(pixelIdx, { category, delta });
    }

    return classified;
  }

  // ─── Internal: Clustering ─────────────────────────────────────────────

  /**
   * Cluster adjacent diff pixels into regions using flood-fill.
   * Small clusters below minClusterSize are downgraded to noise.
   */
  private clusterIntoRegions(
    classified: Map<number, { category: DiffCategory; delta: number }>,
    width: number,
    height: number,
  ): DiffRegion[] {
    const visited = new Set<number>();
    const regions: DiffRegion[] = [];

    for (const [pixelIdx, info] of classified) {
      if (visited.has(pixelIdx)) continue;

      // Flood-fill to find connected component
      const cluster: number[] = [];
      const queue: number[] = [pixelIdx];
      let totalDelta = 0;
      let minX = width, maxX = 0, minY = height, maxY = 0;

      while (queue.length > 0) {
        const current = queue.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const cx = current % width;
        const cy = Math.floor(current / width);

        if (!classified.has(current)) continue;

        cluster.push(current);
        totalDelta += classified.get(current)!.delta;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (!visited.has(nIdx) && classified.has(nIdx)) {
              queue.push(nIdx);
            }
          }
        }
      }

      if (cluster.length === 0) continue;

      // Determine dominant category in this cluster
      const categoryCounts = new Map<DiffCategory, number>();
      for (const idx of cluster) {
        const cat = classified.get(idx)!.category;
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }

      let dominantCategory = DiffCategory.ANTI_ALIASING;
      let maxCount = 0;
      for (const [cat, count] of categoryCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantCategory = cat;
        }
      }

      // Downgrade small clusters to noise (anti-aliasing)
      if (cluster.length < this.options.minClusterSize &&
          dominantCategory === DiffCategory.STRUCTURAL) {
        dominantCategory = DiffCategory.ANTI_ALIASING;
      }

      regions.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount: cluster.length,
        category: dominantCategory,
        avgColorDelta: Math.round(totalDelta / cluster.length),
      });
    }

    // Sort by pixel count descending (most significant first)
    return regions.sort((a, b) => b.pixelCount - a.pixelCount);
  }

  // ─── Internal: Scoring & Decision ─────────────────────────────────────

  private buildCategoryBreakdown(
    classified: Map<number, { category: DiffCategory; delta: number }>,
  ): Record<DiffCategory, number> {
    const breakdown: Record<DiffCategory, number> = {
      [DiffCategory.ANTI_ALIASING]: 0,
      [DiffCategory.ALIGNMENT_SHIFT]: 0,
      [DiffCategory.COLOR_TOLERANCE]: 0,
      [DiffCategory.STRUCTURAL]: 0,
    };

    for (const [, info] of classified) {
      breakdown[info.category]++;
    }

    return breakdown;
  }

  private determineSeverity(
    breakdown: Record<DiffCategory, number>,
    diffPercentage: number,
  ): DiffSeverity {
    const structural = breakdown[DiffCategory.STRUCTURAL];
    const alignment = breakdown[DiffCategory.ALIGNMENT_SHIFT];
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

    if (total === 0) return DiffSeverity.NONE;

    // If structural pixels dominate or exceed threshold
    if (structural > this.options.maxStructuralPixels) {
      return DiffSeverity.MAJOR;
    }

    // If alignment shifts are significant
    if (alignment > 100 || diffPercentage > 2) {
      return DiffSeverity.MINOR;
    }

    // If only AA and color tolerance
    if (structural === 0 && alignment < 20) {
      return DiffSeverity.NEGLIGIBLE;
    }

    return DiffSeverity.MINOR;
  }

  private determineMatch(
    severity: DiffSeverity,
    structuralCount: number,
    diffPercentage: number,
  ): boolean {
    if (severity === DiffSeverity.NONE || severity === DiffSeverity.NEGLIGIBLE) {
      return true;
    }

    if (severity === DiffSeverity.MINOR) {
      // Minor is a match if structural pixels are below threshold
      return structuralCount <= this.options.maxStructuralPixels &&
             diffPercentage <= this.options.maxDiffPercentage;
    }

    // MAJOR = not a match
    return false;
  }

  // ─── Internal: Summary & Output ───────────────────────────────────────

  private buildSummary(
    severity: DiffSeverity,
    breakdown: Record<DiffCategory, number>,
    diffPercentage: number,
    regions: DiffRegion[],
    structuralCount: number,
  ): string {
    const lines: string[] = [];

    switch (severity) {
      case DiffSeverity.NONE:
        lines.push('✅ PASS: Images are identical.');
        break;
      case DiffSeverity.NEGLIGIBLE:
        lines.push('✅ PASS: Differences are negligible (anti-aliasing/sub-pixel noise only).');
        break;
      case DiffSeverity.MINOR:
        lines.push('⚠️  MINOR: Small differences detected — likely alignment or rendering variance.');
        break;
      case DiffSeverity.MAJOR:
        lines.push('❌ FAIL: Significant structural differences detected — likely a real visual bug.');
        break;
    }

    lines.push(`   Diff: ${diffPercentage.toFixed(3)}% of pixels differ.`);
    lines.push(`   Breakdown:`);
    lines.push(`     • Anti-aliasing:   ${breakdown[DiffCategory.ANTI_ALIASING]} px`);
    lines.push(`     • Alignment shift: ${breakdown[DiffCategory.ALIGNMENT_SHIFT]} px`);
    lines.push(`     • Color tolerance: ${breakdown[DiffCategory.COLOR_TOLERANCE]} px`);
    lines.push(`     • Structural:      ${structuralCount} px`);

    if (regions.length > 0) {
      const structuralRegions = regions.filter(r => r.category === DiffCategory.STRUCTURAL);
      if (structuralRegions.length > 0) {
        lines.push(`   Structural regions: ${structuralRegions.length}`);
        for (const r of structuralRegions.slice(0, 5)) {
          lines.push(
            `     → [${r.x},${r.y}] ${r.width}x${r.height} (${r.pixelCount}px, avg Δ${r.avgColorDelta})`,
          );
        }
      }
    }

    return lines.join('\n');
  }

  private buildDimensionMismatchResult(baseline: PNG, actual: PNG): ComparisonResult {
    return {
      isMatch: false,
      severity: DiffSeverity.MAJOR,
      summary: [
        '❌ FAIL: Image dimensions do not match.',
        `   Baseline: ${baseline.width}x${baseline.height}`,
        `   Actual:   ${actual.width}x${actual.height}`,
        '   This indicates a layout change or viewport difference.',
      ].join('\n'),
      totalDiffPixels: -1,
      diffPercentage: 100,
      categoryBreakdown: this.emptyBreakdown(),
      regions: [],
      dimensions: { width: baseline.width, height: baseline.height },
    };
  }

  private saveDiffImage(diffPng: PNG, name?: string): string {
    const dir = this.options.outputDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `${name || 'diff'}-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, PNG.sync.write(diffPng));
    return filePath;
  }

  private emptyBreakdown(): Record<DiffCategory, number> {
    return {
      [DiffCategory.ANTI_ALIASING]: 0,
      [DiffCategory.ALIGNMENT_SHIFT]: 0,
      [DiffCategory.COLOR_TOLERANCE]: 0,
      [DiffCategory.STRUCTURAL]: 0,
    };
  }
}

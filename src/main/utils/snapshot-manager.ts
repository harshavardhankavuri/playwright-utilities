import * as fs from 'fs';
import * as path from 'path';
import { type Page, type Locator } from '@playwright/test';
import { ScreenshotComparator, type ComparatorOptions, type ComparisonResult, DiffSeverity } from './screenshot-comparator';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a multi-snapshot comparison.
 */
export interface MultiSnapshotResult {
  /** Whether the actual screenshot matched any of the stored baselines */
  isMatch: boolean;
  /** Which baseline matched (index), or -1 if none matched */
  matchedBaselineIndex: number;
  /** Name of the matched baseline file, or undefined */
  matchedBaselineName?: string;
  /** The best (closest) comparison result among all baselines */
  bestResult: ComparisonResult;
  /** All individual comparison results (one per baseline) */
  allResults: ComparisonResult[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Options for the snapshot assertion.
 */
export interface SnapshotOptions {
  /** Custom name for the snapshot (defaults to test title) */
  name?: string;
  /**
   * Path to the test file calling this assertion.
   * Used to create a subfolder under __snapshots__/ named after the spec file.
   * Pass `__filename`.
   */
  testFilePath?: string;
  /** Comparator options override for this assertion */
  comparatorOptions?: ComparatorOptions;
  /** Screenshot options passed to Playwright */
  screenshotOptions?: {
    fullPage?: boolean;
    animations?: 'disabled' | 'allow';
    mask?: Locator[];
    omitBackground?: boolean;
  };
  /**
   * If true, saves the current screenshot as a new valid baseline variant.
   * Equivalent to running with UPDATE_SNAPSHOTS=true env var.
   * Respects maxBaselines — rotates oldest if at capacity.
   */
  updateBaseline?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT MANAGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SnapshotManager — Visual regression testing with multiple valid baselines.
 *
 * STORAGE STRUCTURE (similar to Playwright's built-in but with multi-baseline support):
 *   __snapshots__/
 *     login.spec.ts/              ← subfolder per spec file
 *       login-form/               ← subfolder per snapshot name
 *         baseline-1.png          ← up to maxBaselines valid states
 *         baseline-2.png
 *         baseline-3.png
 *         baseline-4.png
 *       submit-button/
 *         baseline-1.png
 *     inventory.spec.ts/
 *       product-grid/
 *         baseline-1.png
 *
 * BEHAVIOR:
 * 1. First run (no baselines exist): saves screenshot as baseline-1.png, test passes.
 * 2. Subsequent runs: compares against ALL stored baselines using ScreenshotComparator.
 *    Passes if ANY baseline matches (accounting for anti-aliasing, alignment, etc.)
 * 3. Update mode (UPDATE_SNAPSHOTS=true or updateBaseline: true):
 *    Adds a new baseline variant. If at maxBaselines capacity, rotates out the oldest.
 * 4. Never saves new baselines automatically on normal runs — only compares.
 *
 * Usage:
 *   const snapshots = new SnapshotManager();
 *
 *   const result = await snapshots.assertScreenshot(page, {
 *     name: 'login-form',
 *     testFilePath: __filename,
 *   });
 *   expect(result.isMatch).toBe(true);
 */
export class SnapshotManager {
  private readonly snapshotsDir: string;
  private readonly diffOutputDir: string;
  private readonly maxBaselines: number;
  private readonly comparator: ScreenshotComparator;

  constructor(options?: {
    /**
     * Root directory for all snapshots. Default: '__snapshots__' (project root).
     * All spec subfolders are created inside this directory.
     */
    snapshotsDir?: string;
    /** Directory for diff output images on failure. Default: 'test-results/snapshot-diffs' */
    diffOutputDir?: string;
    /**
     * Maximum number of valid baselines per snapshot.
     * When exceeded during update, the oldest baseline is rotated out.
     * Default: 4
     */
    maxBaselines?: number;
    /** Comparator options applied to all comparisons */
    comparatorOptions?: ComparatorOptions;
  }) {
    this.snapshotsDir = options?.snapshotsDir || path.resolve('__snapshots__');
    this.diffOutputDir = options?.diffOutputDir || path.resolve('test-results', 'snapshot-diffs');
    this.maxBaselines = options?.maxBaselines || 4;
    this.comparator = new ScreenshotComparator({
      outputDir: this.diffOutputDir,
      ...options?.comparatorOptions,
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Assert a full-page screenshot matches one of the stored baselines.
   * If no baselines exist, saves the first one and passes.
   */
  async assertScreenshot(page: Page, options?: SnapshotOptions): Promise<MultiSnapshotResult> {
    const buffer = await page.screenshot({
      fullPage: options?.screenshotOptions?.fullPage,
      animations: options?.screenshotOptions?.animations ?? 'disabled',
      mask: options?.screenshotOptions?.mask,
      omitBackground: options?.screenshotOptions?.omitBackground,
    });
    return this.assertBuffer(buffer, options);
  }

  /**
   * Assert an element screenshot matches one of the stored baselines.
   */
  async assertElementScreenshot(locator: Locator, options?: SnapshotOptions): Promise<MultiSnapshotResult> {
    const buffer = await locator.screenshot({
      animations: options?.screenshotOptions?.animations ?? 'disabled',
      mask: options?.screenshotOptions?.mask,
      omitBackground: options?.screenshotOptions?.omitBackground,
    });
    return this.assertBuffer(buffer, options);
  }

  /**
   * Assert a raw PNG buffer against stored baselines.
   */
  async assertBuffer(actualBuffer: Buffer, options?: SnapshotOptions): Promise<MultiSnapshotResult> {
    const name = this.sanitizeName(options?.name || 'screenshot');
    const snapshotDir = this.resolveSnapshotDir(name, options?.testFilePath);
    const shouldUpdate = options?.updateBaseline || process.env.UPDATE_SNAPSHOTS === 'true';

    // ─── Update mode: save new baseline ──────────────────────────────────
    if (shouldUpdate) {
      this.saveBaseline(snapshotDir, actualBuffer);
      return {
        isMatch: true,
        matchedBaselineIndex: -1,
        bestResult: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 Saved/updated baseline in: ${snapshotDir}`,
      };
    }

    // ─── First run: no baselines exist → save first and pass ─────────────
    const baselines = this.loadBaselines(snapshotDir);
    if (baselines.length === 0) {
      this.saveBaseline(snapshotDir, actualBuffer);
      return {
        isMatch: true,
        matchedBaselineIndex: -1,
        bestResult: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 No baselines found. Saved first baseline in: ${snapshotDir}`,
      };
    }

    // ─── Compare against all baselines ───────────────────────────────────
    const comparator = options?.comparatorOptions
      ? new ScreenshotComparator({ outputDir: this.diffOutputDir, ...options.comparatorOptions })
      : this.comparator;

    const allResults: ComparisonResult[] = [];
    let bestResult: ComparisonResult | null = null;
    let bestIndex = -1;
    let matchedIndex = -1;

    for (let i = 0; i < baselines.length; i++) {
      const result = await comparator.compare(
        baselines[i].buffer,
        actualBuffer,
        `${name}-vs-baseline-${i + 1}`,
      );
      allResults.push(result);

      if (!bestResult || result.diffPercentage < bestResult.diffPercentage) {
        bestResult = result;
        bestIndex = i;
      }

      if (result.isMatch) {
        matchedIndex = i;
        break; // Found a match, no need to check more
      }
    }

    const matched = matchedIndex >= 0;
    const summary = this.buildSummary(matched, matchedIndex, bestIndex, baselines, allResults, bestResult!, name);

    return {
      isMatch: matched,
      matchedBaselineIndex: matchedIndex,
      matchedBaselineName: matchedIndex >= 0 ? baselines[matchedIndex].name : undefined,
      bestResult: bestResult!,
      allResults,
      summary,
    };
  }

  /**
   * Manually add a new baseline variant.
   * Respects maxBaselines — rotates oldest if at capacity.
   */
  addBaseline(name: string, buffer: Buffer, testFilePath?: string): string {
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    return this.saveBaseline(snapshotDir, buffer);
  }

  /**
   * List all stored baselines for a snapshot.
   */
  listBaselines(name: string, testFilePath?: string): string[] {
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    if (!fs.existsSync(snapshotDir)) return [];
    return fs.readdirSync(snapshotDir).filter((f) => f.endsWith('.png')).sort();
  }

  /**
   * Get the snapshot directory path for a given name and test file.
   */
  getSnapshotDir(name: string, testFilePath?: string): string {
    return this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
  }

  // ─── Internal: Directory Resolution ─────────────────────────────────────

  /**
   * Resolve the snapshot directory.
   *
   * Structure: __snapshots__/<spec-filename>/<snapshot-name>/
   *
   * Example:
   *   testFilePath = '/project/src/tests/saucedemo/login.spec.ts'
   *   name = 'login-form'
   *   → __snapshots__/login.spec.ts/login-form/
   */
  private resolveSnapshotDir(name: string, testFilePath?: string): string {
    if (!testFilePath) {
      // Fallback: flat structure under __snapshots__/<name>/
      return path.join(this.snapshotsDir, name);
    }

    // Use the spec filename (with extension) as the subfolder name
    const specFileName = path.basename(testFilePath);
    return path.join(this.snapshotsDir, specFileName, name);
  }

  // ─── Internal: Baseline I/O ─────────────────────────────────────────────

  private loadBaselines(dir: string): { name: string; buffer: Buffer }[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => ({ name: f, buffer: fs.readFileSync(path.join(dir, f)) }));
  }

  /**
   * Save a new baseline. If at maxBaselines capacity, rotate out the oldest.
   */
  private saveBaseline(dir: string, buffer: Buffer): string {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();

    // If at capacity, remove the oldest (baseline-1) and shift others down
    if (existing.length >= this.maxBaselines) {
      // Remove oldest
      fs.unlinkSync(path.join(dir, existing[0]));
      // Rename remaining to fill the gap (baseline-2 → baseline-1, etc.)
      const remaining = existing.slice(1);
      for (let i = 0; i < remaining.length; i++) {
        const oldPath = path.join(dir, remaining[i]);
        const newPath = path.join(dir, `baseline-${i + 1}.png`);
        if (oldPath !== newPath) {
          fs.renameSync(oldPath, newPath);
        }
      }
      // Save new as the last slot
      const filePath = path.join(dir, `baseline-${this.maxBaselines}.png`);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    }

    // Not at capacity: save as next index
    const nextIndex = existing.length + 1;
    const filePath = path.join(dir, `baseline-${nextIndex}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  // ─── Internal: Helpers ──────────────────────────────────────────────────

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }

  private identicalResult(buffer: Buffer): ComparisonResult {
    const { PNG } = require('pngjs') as typeof import('pngjs');
    const img = PNG.sync.read(buffer);
    return {
      isMatch: true,
      severity: DiffSeverity.NONE,
      summary: 'Images are identical.',
      totalDiffPixels: 0,
      diffPercentage: 0,
      categoryBreakdown: {
        'anti-aliasing': 0,
        'alignment-shift': 0,
        'color-tolerance': 0,
        structural: 0,
      },
      regions: [],
      dimensions: { width: img.width, height: img.height },
    };
  }

  private buildSummary(
    matched: boolean,
    matchedIndex: number,
    bestIndex: number,
    baselines: { name: string; buffer: Buffer }[],
    allResults: ComparisonResult[],
    bestResult: ComparisonResult,
    name: string,
  ): string {
    const lines: string[] = [];

    if (matched) {
      lines.push(`✅ PASS: Screenshot "${name}" matched baseline ${matchedIndex + 1}/${baselines.length} (${baselines[matchedIndex].name}).`);
    } else {
      lines.push(`❌ FAIL: Screenshot "${name}" did not match any of ${baselines.length} baseline(s).`);
      lines.push('');
      lines.push(`   Closest match: baseline ${bestIndex + 1} (${baselines[bestIndex].name})`);
      lines.push(`   ${bestResult.summary.split('\n')[0]}`);
      lines.push('');
      lines.push('   Per-baseline results:');
      for (let i = 0; i < allResults.length; i++) {
        const r = allResults[i];
        const icon = r.isMatch ? '✅' : '❌';
        lines.push(`     ${icon} ${baselines[i].name}: ${r.diffPercentage}% diff, severity=${r.severity}`);
      }
      lines.push('');
      lines.push('   Intelligent analysis of closest match:');
      lines.push(`   ${bestResult.summary.split('\n').join('\n   ')}`);
      lines.push('');
      lines.push('   💡 To update baselines: UPDATE_SNAPSHOTS=true npx playwright test');
    }

    return lines.join('\n');
  }
}

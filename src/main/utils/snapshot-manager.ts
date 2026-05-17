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
   * Used to determine where snapshots are stored (alongside the test file).
   * Pass `__filename` or use the fixture which auto-injects this.
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
   */
  updateBaseline?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT MANAGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SnapshotManager - Manages multiple valid baseline screenshots per test.
 *
 * Key features:
 * - Store multiple valid baselines for the same element/page (e.g. different
 *   valid states, OS rendering differences, light/dark mode variants)
 * - On assertion, tries ALL baselines — passes if ANY match
 * - If all baselines fail, uses ScreenshotComparator for intelligent analysis
 *   to determine if the diff is a real bug or just noise/alignment
 * - Supports adding new baselines via UPDATE_SNAPSHOTS=true or updateBaseline option
 *
 * Directory structure (folder-level, alongside test files):
 *   src/tests/login/
 *     login.spec.ts
 *     login-dashboard-snapshots/
 *       baseline-1.png
 *       baseline-2.png
 *   src/tests/
 *     home.spec.ts
 *     home-heading-snapshots/
 *       baseline-1.png
 *
 * Usage:
 *   const manager = new SnapshotManager();
 *   const result = await manager.assertScreenshot(page, {
 *     name: 'homepage',
 *     testFilePath: __filename,  // or use the fixture which auto-injects this
 *   });
 */
export class SnapshotManager {
  private readonly snapshotsDir: string;
  private readonly comparator: ScreenshotComparator;
  private readonly diffOutputDir: string;

  constructor(options?: {
    /**
     * Root directory for storing baselines (fallback when testFilePath is not provided).
     * Default: '__snapshots__'
     */
    snapshotsDir?: string;
    /** Directory for diff output images. Default: 'test-results/snapshot-diffs' */
    diffOutputDir?: string;
    /** Comparator options applied to all comparisons */
    comparatorOptions?: ComparatorOptions;
  }) {
    this.snapshotsDir = options?.snapshotsDir || path.resolve('__snapshots__');
    this.diffOutputDir = options?.diffOutputDir || path.resolve('test-results', 'snapshot-diffs');
    this.comparator = new ScreenshotComparator({
      outputDir: this.diffOutputDir,
      ...options?.comparatorOptions,
    });
  }

  /**
   * Resolve the snapshot directory for a given test file and snapshot name.
   *
   * If testFilePath is provided:
   *   src/tests/login/login.spec.ts + name "dashboard"
   *   → src/tests/login/login-dashboard-snapshots/
   *
   * If testFilePath is NOT provided, falls back to:
   *   <snapshotsDir>/<name>/
   */
  private resolveSnapshotDir(name: string, testFilePath?: string): string {
    if (!testFilePath) {
      return path.join(this.snapshotsDir, name);
    }

    // Extract the test file's directory and base name (without extension)
    const testDir = path.dirname(testFilePath);
    const testBaseName = path.basename(testFilePath).replace(/\.(spec|test)\.(ts|js|mjs)$/, '');
    const folderName = `${testBaseName}-${name}-snapshots`;

    return path.join(testDir, folderName);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Assert a full-page screenshot matches one of the stored baselines.
   * If no baselines exist, saves the current screenshot as the first baseline.
   */
  async assertScreenshot(
    page: Page,
    options?: SnapshotOptions,
  ): Promise<MultiSnapshotResult> {
    const screenshotBuffer = await page.screenshot({
      fullPage: options?.screenshotOptions?.fullPage,
      animations: options?.screenshotOptions?.animations ?? 'disabled',
      mask: options?.screenshotOptions?.mask,
      omitBackground: options?.screenshotOptions?.omitBackground,
    });

    return this.assertBuffer(screenshotBuffer, options);
  }

  /**
   * Assert an element screenshot matches one of the stored baselines.
   */
  async assertElementScreenshot(
    locator: Locator,
    options?: SnapshotOptions,
  ): Promise<MultiSnapshotResult> {
    const screenshotBuffer = await locator.screenshot({
      animations: options?.screenshotOptions?.animations ?? 'disabled',
      mask: options?.screenshotOptions?.mask,
      omitBackground: options?.screenshotOptions?.omitBackground,
    });

    return this.assertBuffer(screenshotBuffer, options);
  }

  /**
   * Assert a raw PNG buffer against stored baselines.
   */
  async assertBuffer(
    actualBuffer: Buffer,
    options?: SnapshotOptions,
  ): Promise<MultiSnapshotResult> {
    const name = this.sanitizeName(options?.name || 'screenshot');
    const shouldUpdate = options?.updateBaseline || process.env.UPDATE_SNAPSHOTS === 'true';
    const snapshotDir = this.resolveSnapshotDir(name, options?.testFilePath);

    // If update mode, save as new baseline
    if (shouldUpdate) {
      this.saveNewBaseline(snapshotDir, actualBuffer);
      return {
        isMatch: true,
        matchedBaselineIndex: -1,
        bestResult: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 Saved new baseline variant in: ${snapshotDir}`,
      };
    }

    // Load existing baselines
    const baselines = this.loadBaselines(snapshotDir);

    // If no baselines exist, save the first one automatically
    if (baselines.length === 0) {
      this.saveNewBaseline(snapshotDir, actualBuffer);
      return {
        isMatch: true,
        matchedBaselineIndex: -1,
        bestResult: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 No baselines found. Saved first baseline in: ${snapshotDir}`,
      };
    }

    // Compare against all baselines
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

      // Track the best (closest) result
      if (!bestResult || result.diffPercentage < bestResult.diffPercentage) {
        bestResult = result;
        bestIndex = i;
      }

      // If any baseline matches, we're done
      if (result.isMatch) {
        matchedIndex = i;
        break;
      }
    }

    const matched = matchedIndex >= 0;
    const summary = this.buildMultiSummary(
      matched, matchedIndex, bestIndex, baselines, allResults, bestResult!, name,
    );

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
   * Manually add a new valid baseline variant for a snapshot name.
   * @param name - Snapshot name
   * @param buffer - PNG buffer to save
   * @param testFilePath - Optional test file path for folder-level storage
   */
  addBaseline(name: string, buffer: Buffer, testFilePath?: string): string {
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    return this.saveNewBaseline(snapshotDir, buffer);
  }

  /**
   * List all stored baselines for a given snapshot name.
   * @param name - Snapshot name
   * @param testFilePath - Optional test file path for folder-level storage
   */
  listBaselines(name: string, testFilePath?: string): string[] {
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    if (!fs.existsSync(snapshotDir)) return [];
    return fs.readdirSync(snapshotDir)
      .filter((f) => f.endsWith('.png'))
      .sort();
  }

  /**
   * Remove a specific baseline by name and index.
   * @param name - Snapshot name
   * @param index - Baseline index to remove
   * @param testFilePath - Optional test file path for folder-level storage
   */
  removeBaseline(name: string, index: number, testFilePath?: string): boolean {
    const baselines = this.listBaselines(name, testFilePath);
    if (index < 0 || index >= baselines.length) return false;
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    fs.unlinkSync(path.join(snapshotDir, baselines[index]));
    return true;
  }

  /**
   * Remove all baselines for a snapshot name.
   * @param name - Snapshot name
   * @param testFilePath - Optional test file path for folder-level storage
   */
  clearBaselines(name: string, testFilePath?: string): void {
    const snapshotDir = this.resolveSnapshotDir(this.sanitizeName(name), testFilePath);
    if (fs.existsSync(snapshotDir)) {
      fs.rmSync(snapshotDir, { recursive: true });
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private loadBaselines(dir: string): { name: string; buffer: Buffer }[] {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => ({
        name: f,
        buffer: fs.readFileSync(path.join(dir, f)),
      }));
  }

  private saveNewBaseline(dir: string, buffer: Buffer): string {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Find next available index
    const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    const nextIndex = existing.length + 1;
    const filename = `baseline-${nextIndex}.png`;
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

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

  private buildMultiSummary(
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
      lines.push(`   💡 If this is a valid new state, run with UPDATE_SNAPSHOTS=true to save as a new baseline.`);
    }

    return lines.join('\n');
  }
}

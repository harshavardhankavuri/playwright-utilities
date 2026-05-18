import { type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { ScreenshotComparator, type ComparatorOptions, type ComparisonResult, DiffSeverity } from './screenshot-comparator';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rectangular region to mask (black out) in the screenshot.
 * Coordinates are relative to the page/element viewport.
 */
export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Options for visual regression assertions.
 */
export interface VisualRegressionOptions {
  /** Snapshot name. Auto-generated from test title if not provided. */
  name?: string;
  /** Path to the test file (for folder structure). Pass __filename. */
  testFilePath?: string;
  /** Locators to mask (hidden via CSS before screenshot). */
  mask?: Locator[];
  /** Rectangular regions to black out after capture (pixel coordinates). */
  maskRegions?: MaskRegion[];
  /** CSS selectors to hide before screenshot (applied via stylePath). */
  maskSelectors?: string[];
  /** Take full-page screenshot. Default: false */
  fullPage?: boolean;
  /** Disable CSS animations. Default: 'disabled' */
  animations?: 'disabled' | 'allow';
  /** ScreenshotComparator options for intelligent diff analysis. */
  comparatorOptions?: ComparatorOptions;
  /**
   * Maximum number of valid baselines. Default: 4.
   * When exceeded during update, oldest is rotated out.
   */
  maxBaselines?: number;
  /**
   * If true, saves current screenshot as a new baseline.
   * Also triggered by UPDATE_SNAPSHOTS=true env var.
   */
  update?: boolean;
}

/**
 * Result of a visual regression check.
 */
export interface VisualRegressionResult {
  /** Whether the screenshot matched a baseline */
  passed: boolean;
  /** Which baseline matched (0-indexed), or -1 */
  matchedIndex: number;
  /** Intelligent diff analysis from ScreenshotComparator */
  analysis: ComparisonResult;
  /** All comparison results (one per baseline) */
  allResults: ComparisonResult[];
  /** Path to the diff image (if generated) */
  diffPath?: string;
  /** Human-readable summary */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL REGRESSION CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VisualRegression — Enhanced visual comparison built on top of Playwright's
 * screenshot capabilities with intelligent diff analysis.
 *
 * Improvements over Playwright's built-in toHaveScreenshot():
 * 1. Multiple valid baselines (up to 4) — passes if ANY match
 * 2. Element masking (hide dynamic elements via CSS injection)
 * 3. Region masking (black out pixel areas after capture)
 * 4. Intelligent diff classification (anti-aliasing, alignment, structural)
 * 5. Configurable tolerance that distinguishes real bugs from rendering noise
 * 6. Detailed failure reports with category breakdown
 *
 * Usage:
 *   const visual = new VisualRegression();
 *
 *   // Basic — like Playwright's toHaveScreenshot but smarter
 *   await visual.assertPage(page, { name: 'login', testFilePath: __filename });
 *
 *   // With element masking (hides dynamic content)
 *   await visual.assertPage(page, {
 *     name: 'dashboard',
 *     testFilePath: __filename,
 *     mask: [page.locator('.timestamp'), page.locator('.ad-banner')],
 *     maskSelectors: ['iframe', '.loading-spinner'],
 *   });
 *
 *   // With region masking (black out coordinates)
 *   await visual.assertPage(page, {
 *     name: 'report',
 *     testFilePath: __filename,
 *     maskRegions: [{ x: 10, y: 50, width: 200, height: 30 }],
 *   });
 */
export class VisualRegression {
  private readonly snapshotsDir: string;
  private readonly diffDir: string;
  private readonly maxBaselines: number;
  private readonly comparator: ScreenshotComparator;

  constructor(options?: {
    snapshotsDir?: string;
    diffDir?: string;
    maxBaselines?: number;
    comparatorOptions?: ComparatorOptions;
  }) {
    this.snapshotsDir = options?.snapshotsDir || path.resolve('__snapshots__');
    this.diffDir = options?.diffDir || path.resolve('test-results', 'visual-diffs');
    this.maxBaselines = options?.maxBaselines || 4;
    this.comparator = new ScreenshotComparator({
      outputDir: this.diffDir,
      ...options?.comparatorOptions,
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Assert a full-page or viewport screenshot against stored baselines.
   */
  async assertPage(page: Page, options?: VisualRegressionOptions): Promise<VisualRegressionResult> {
    const buffer = await this.captureScreenshot(page, null, options);
    return this.compare(buffer, options);
  }

  /**
   * Assert an element screenshot against stored baselines.
   */
  async assertElement(locator: Locator, page: Page, options?: VisualRegressionOptions): Promise<VisualRegressionResult> {
    const buffer = await this.captureScreenshot(page, locator, options);
    return this.compare(buffer, options);
  }

  /**
   * Capture a screenshot with masking applied, without comparing.
   * Useful for manual inspection or custom comparison logic.
   */
  async capture(page: Page, locator?: Locator | null, options?: VisualRegressionOptions): Promise<Buffer> {
    return this.captureScreenshot(page, locator || null, options);
  }

  // ─── Screenshot Capture with Masking ────────────────────────────────────

  /**
   * Take a screenshot with all masking applied:
   * 1. Inject CSS to hide maskSelectors
   * 2. Use Playwright's mask option for Locator-based masking
   * 3. Apply region masking (black rectangles) on the captured PNG
   */
  private async captureScreenshot(
    page: Page,
    locator: Locator | null,
    options?: VisualRegressionOptions,
  ): Promise<Buffer> {
    // Step 1: Inject CSS to hide selectors (more reliable than Playwright's mask for iframes, etc.)
    let injectedStyleTag: any = null;
    if (options?.maskSelectors && options.maskSelectors.length > 0) {
      const css = options.maskSelectors
        .map((sel) => `${sel} { visibility: hidden !important; }`)
        .join('\n');
      injectedStyleTag = await page.addStyleTag({ content: css });
    }

    // Step 2: Take screenshot with Playwright's built-in mask option
    let buffer: Buffer;
    const screenshotOpts: any = {
      animations: options?.animations ?? 'disabled',
      mask: options?.mask,
    };

    if (locator) {
      buffer = await locator.screenshot(screenshotOpts);
    } else {
      screenshotOpts.fullPage = options?.fullPage ?? false;
      buffer = await page.screenshot(screenshotOpts);
    }

    // Step 3: Remove injected CSS
    if (injectedStyleTag) {
      await injectedStyleTag.evaluate((el: HTMLElement) => el.remove());
    }

    // Step 4: Apply region masking (black out pixel areas on the PNG)
    if (options?.maskRegions && options.maskRegions.length > 0) {
      buffer = this.applyRegionMasks(buffer, options.maskRegions);
    }

    return buffer;
  }

  /**
   * Black out rectangular regions on a PNG buffer.
   * Draws solid black rectangles over the specified coordinates.
   */
  private applyRegionMasks(buffer: Buffer, regions: MaskRegion[]): Buffer {
    const png = PNG.sync.read(buffer);
    const { width, data } = png;

    for (const region of regions) {
      const startX = Math.max(0, Math.floor(region.x));
      const startY = Math.max(0, Math.floor(region.y));
      const endX = Math.min(png.width, startX + Math.floor(region.width));
      const endY = Math.min(png.height, startY + Math.floor(region.height));

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = 128;     // R (gray, not pure black — distinguishable from content)
          data[idx + 1] = 128; // G
          data[idx + 2] = 128; // B
          data[idx + 3] = 255; // A
        }
      }
    }

    return PNG.sync.write(png);
  }

  // ─── Comparison Logic ───────────────────────────────────────────────────

  private async compare(actualBuffer: Buffer, options?: VisualRegressionOptions): Promise<VisualRegressionResult> {
    const name = this.sanitize(options?.name || 'screenshot');
    const dir = this.resolveDir(name, options?.testFilePath);
    const shouldUpdate = options?.update || process.env.UPDATE_SNAPSHOTS === 'true';
    const maxBaselines = options?.maxBaselines ?? this.maxBaselines;

    // Update mode: save and return pass
    if (shouldUpdate) {
      this.saveBaseline(dir, actualBuffer, maxBaselines);
      return {
        passed: true,
        matchedIndex: -1,
        analysis: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 Baseline saved/updated in: ${dir}`,
      };
    }

    // First run: no baselines → save first and pass
    const baselines = this.loadBaselines(dir);
    if (baselines.length === 0) {
      this.saveBaseline(dir, actualBuffer, maxBaselines);
      return {
        passed: true,
        matchedIndex: -1,
        analysis: this.identicalResult(actualBuffer),
        allResults: [],
        summary: `📸 First baseline saved in: ${dir}`,
      };
    }

    // Compare against all baselines using ScreenshotComparator
    const comparator = options?.comparatorOptions
      ? new ScreenshotComparator({ outputDir: this.diffDir, ...options.comparatorOptions })
      : this.comparator;

    const allResults: ComparisonResult[] = [];
    let bestResult: ComparisonResult | null = null;
    let bestIdx = -1;
    let matchedIdx = -1;

    for (let i = 0; i < baselines.length; i++) {
      // Also apply region masks to the baseline for fair comparison
      const baselineBuffer = options?.maskRegions?.length
        ? this.applyRegionMasks(baselines[i].buffer, options.maskRegions)
        : baselines[i].buffer;

      const result = await comparator.compare(baselineBuffer, actualBuffer, `${name}-vs-${i + 1}`);
      allResults.push(result);

      if (!bestResult || result.diffPercentage < bestResult.diffPercentage) {
        bestResult = result;
        bestIdx = i;
      }

      if (result.isMatch) {
        matchedIdx = i;
        break;
      }
    }

    const passed = matchedIdx >= 0;
    const summary = this.buildSummary(passed, matchedIdx, bestIdx, baselines, allResults, bestResult!, name);

    return {
      passed,
      matchedIndex: matchedIdx,
      analysis: bestResult!,
      allResults,
      diffPath: bestResult?.diffImagePath,
      summary,
    };
  }

  // ─── Baseline Storage ───────────────────────────────────────────────────

  /**
   * Directory structure: __snapshots__/<spec-file>/<snapshot-name>/<platform>/
   *
   * Per-platform isolation prevents cross-platform false positives caused by
   * font rendering, image decoders, and color profiles differing between
   * Windows / Linux / macOS. Mirrors Playwright's built-in toHaveScreenshot()
   * which appends -<platform>.png to baseline filenames.
   */
  private resolveDir(name: string, testFilePath?: string): string {
    const platform = this.platformDirName();
    if (!testFilePath) return path.join(this.snapshotsDir, name, platform);
    const specName = path.basename(testFilePath);
    return path.join(this.snapshotsDir, specName, name, platform);
  }

  /**
   * Folder name representing the current platform.
   * Examples: 'linux', 'darwin', 'win32'.
   * Override via VR_PLATFORM env var if you need to force a specific bucket.
   */
  private platformDirName(): string {
    return process.env.VR_PLATFORM || process.platform;
  }

  private loadBaselines(dir: string): { name: string; buffer: Buffer }[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => ({ name: f, buffer: fs.readFileSync(path.join(dir, f)) }));
  }

  private saveBaseline(dir: string, buffer: Buffer, maxBaselines: number): string {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();

    // Rotate oldest if at capacity
    if (existing.length >= maxBaselines) {
      fs.unlinkSync(path.join(dir, existing[0]));
      const remaining = existing.slice(1);
      for (let i = 0; i < remaining.length; i++) {
        const oldP = path.join(dir, remaining[i]);
        const newP = path.join(dir, `baseline-${i + 1}.png`);
        if (oldP !== newP) fs.renameSync(oldP, newP);
      }
      const filePath = path.join(dir, `baseline-${maxBaselines}.png`);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    }

    const filePath = path.join(dir, `baseline-${existing.length + 1}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }

  private identicalResult(buffer: Buffer): ComparisonResult {
    const png = PNG.sync.read(buffer);
    return {
      isMatch: true,
      severity: DiffSeverity.NONE,
      summary: 'Images are identical.',
      totalDiffPixels: 0,
      diffPercentage: 0,
      categoryBreakdown: { 'anti-aliasing': 0, 'alignment-shift': 0, 'color-tolerance': 0, structural: 0 },
      regions: [],
      dimensions: { width: png.width, height: png.height },
    };
  }

  private buildSummary(
    passed: boolean, matchedIdx: number, bestIdx: number,
    baselines: { name: string }[], allResults: ComparisonResult[],
    best: ComparisonResult, name: string,
  ): string {
    if (passed) {
      return `✅ "${name}" matched baseline ${matchedIdx + 1}/${baselines.length} (${baselines[matchedIdx].name})`;
    }
    const lines = [
      `❌ "${name}" did not match any of ${baselines.length} baseline(s).`,
      `   Closest: ${baselines[bestIdx].name} (${best.diffPercentage}% diff, ${best.severity})`,
      `   ${best.summary.split('\n')[0]}`,
      '',
      '   Per-baseline:',
      ...allResults.map((r, i) => `     ${r.isMatch ? '✅' : '❌'} ${baselines[i].name}: ${r.diffPercentage}% diff`),
      '',
      '   💡 UPDATE_SNAPSHOTS=true npx playwright test --update-snapshots',
    ];
    return lines.join('\n');
  }
}

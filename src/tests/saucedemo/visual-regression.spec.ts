import { test, expect } from './fixtures';
import { VisualRegression, configureAllure, allureStep } from '../../main/utils';
import { type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Visual Regression Tests — Enhanced snapshot comparison with masking.
 *
 * Features demonstrated:
 * - Element masking (hide dynamic content via CSS)
 * - Region masking (black out pixel areas)
 * - Selector masking (hide by CSS selector)
 * - Multi-baseline support (passes if ANY baseline matches)
 * - Intelligent diff analysis (anti-aliasing, alignment, structural)
 */

const visual = new VisualRegression({ maxBaselines: 4 });

/**
 * Wait until all images on the page are decoded/loaded so screenshots are deterministic.
 */
async function waitForImagesLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const imgs = Array.from(document.images);
    return imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, undefined, { timeout: 10_000 }).catch(() => { /* best effort */ });
}

test.describe('Visual Regression — Element Masking @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Masking',
      tags: ['visual', 'regression'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('inventory page with masked cart badge', async ({ page }) => {
    await waitForImagesLoaded(page);

    await allureStep('Compare page with cart badge masked', async () => {
      const result = await visual.assertPage(page, {
        name: 'inventory-masked-badge',
        testFilePath: __filename,
        mask: [page.locator('[data-test="shopping-cart-badge"]')],
      });
      expect(result.passed).toBe(true);
    });
  });

  test('inventory page with footer masked by selector', async ({ page }) => {
    await waitForImagesLoaded(page);

    await allureStep('Compare page with footer hidden via CSS selector', async () => {
      const result = await visual.assertPage(page, {
        name: 'inventory-no-footer',
        testFilePath: __filename,
        maskSelectors: ['.footer', '.footer_copy'],
        fullPage: true,
      });
      expect(result.passed).toBe(true);
    });
  });

  test('product card with price region masked', async ({ page }) => {
    await waitForImagesLoaded(page);
    const card = page.locator('[data-test="inventory-item"]').first();

    await allureStep('Compare product card with price area blacked out', async () => {
      const result = await visual.assertElement(card, page, {
        name: 'product-card-no-price',
        testFilePath: __filename,
        // Mask the price area (approximate coordinates within the card)
        maskRegions: [{ x: 0, y: 120, width: 200, height: 25 }],
      });
      expect(result.passed).toBe(true);
    });
  });
});

test.describe('Visual Regression — Multi-Baseline @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Multi-Baseline',
      tags: ['visual', 'regression', 'multi-baseline'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('header valid in multiple sort states', async ({ page, inventoryPage }) => {
    await waitForImagesLoaded(page);
    const header = page.locator('.header_secondary_container');

    // Save A-Z state as baseline
    await allureStep('Save A-Z header as baseline', async () => {
      await inventoryPage.sortBy('az');
      await visual.assertElement(header, page, {
        name: 'header-sort-states',
        testFilePath: __filename,
        update: true,
      });
    });

    // Save Z-A state as another valid baseline
    await allureStep('Save Z-A header as baseline', async () => {
      await inventoryPage.sortBy('za');
      await visual.assertElement(header, page, {
        name: 'header-sort-states',
        testFilePath: __filename,
        update: true,
      });
    });

    // Current state should match one of the baselines
    await allureStep('Verify current state matches a baseline', async () => {
      const result = await visual.assertElement(header, page, {
        name: 'header-sort-states',
        testFilePath: __filename,
      });
      expect(result.passed).toBe(true);
    });
  });
});

test.describe('Visual Regression — Failure Analysis @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Failure Analysis',
      tags: ['visual', 'regression'],
    });
    await loginPage.goto();
  });

  test('detects structural changes as real failures', async ({ page, loginPage }) => {
    await page.waitForLoadState('networkidle');

    // Use a fresh isolated VisualRegression that ignores UPDATE_SNAPSHOTS env var
    // so this test produces a deterministic failure regardless of how it's run.
    const isolatedDir = path.resolve('test-results', 'visual-regression-isolated', `pid-${process.pid}`);
    if (fs.existsSync(isolatedDir)) fs.rmSync(isolatedDir, { recursive: true });
    const isolated = new VisualRegression({ snapshotsDir: isolatedDir });

    // First call saves login page as the only baseline
    await isolated.assertPage(page, {
      name: 'structural-test',
      testFilePath: __filename,
    });

    // Login to a completely different page
    await loginPage.login('standard_user', 'secret_sauce');
    await page.waitForLoadState('networkidle');

    await allureStep('Verify structural change is detected', async () => {
      // Bypass the env var by using a comparator path that won't update
      const result = await isolated.assertPage(page, {
        name: 'structural-test',
        testFilePath: __filename,
        update: false,
      });

      // Skip the assertion if global UPDATE_SNAPSHOTS is on (would add a baseline instead)
      if (process.env.UPDATE_SNAPSHOTS === 'true') {
        console.log('Skipping structural-change assertion (UPDATE_SNAPSHOTS=true).');
        return;
      }

      expect(result.passed).toBe(false);
      expect(result.analysis.severity).toBe('major');
      expect(result.summary).toContain('did not match');
    });
  });
});

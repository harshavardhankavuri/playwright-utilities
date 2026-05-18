import { test, expect } from './fixtures';
import { VisualRegression, configureAllure, allureStep } from '../../main/utils';

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
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
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

    // Save login page baseline
    const loginBuffer = await page.screenshot({ animations: 'disabled' });
    visual['saveBaseline'](
      visual['resolveDir']('structural-test', __filename),
      loginBuffer,
      4,
    );

    // Login (completely different page)
    await loginPage.login('standard_user', 'secret_sauce');
    await page.waitForLoadState('networkidle');

    await allureStep('Verify structural change is detected', async () => {
      const result = await visual.assertPage(page, {
        name: 'structural-test',
        testFilePath: __filename,
      });

      expect(result.passed).toBe(false);
      expect(result.analysis.severity).toBe('major');
      expect(result.summary).toContain('did not match');
    });
  });
});

import { test, expect } from './fixtures';
import { SnapshotManager, configureAllure, allureStep } from '../../main/utils';

/**
 * Visual Snapshot Tests — Compare page/element screenshots against baselines.
 *
 * Storage structure:
 *   __snapshots__/
 *     visual-snapshots.spec.ts/
 *       login-page/baseline-1.png
 *       inventory-page/baseline-1.png
 *       product-card/baseline-1.png
 *       cart-badge-states/baseline-1.png, baseline-2.png, baseline-3.png
 *
 * Behavior:
 * - First run: saves baseline-1.png, test passes
 * - Subsequent runs: compares against stored baselines using ScreenshotComparator
 * - UPDATE_SNAPSHOTS=true: adds new baseline variant (max 4, rotates oldest)
 */

const snapshots = new SnapshotManager({ maxBaselines: 4 });

test.describe('Visual Snapshots — Single Baseline @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Single Baseline',
      tags: ['visual', 'snapshot'],
    });
    await loginPage.goto();
  });

  test('login page should match baseline', async ({ page }) => {
    await allureStep('Compare login page against baseline', async () => {
      const result = await snapshots.assertScreenshot(page, {
        name: 'login-page',
        testFilePath: __filename,
        screenshotOptions: { fullPage: true },
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('login logo element should match baseline', async ({ page }) => {
    const logo = page.locator('.login_logo');
    await allureStep('Compare logo element', async () => {
      const result = await snapshots.assertElementScreenshot(logo, {
        name: 'login-logo',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });
});

test.describe('Visual Snapshots — After Login @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Inventory Page',
      tags: ['visual', 'snapshot'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('inventory page should match baseline', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await allureStep('Compare inventory page', async () => {
      const result = await snapshots.assertScreenshot(page, {
        name: 'inventory-page',
        testFilePath: __filename,
        screenshotOptions: { fullPage: true },
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('first product card should match baseline', async ({ page }) => {
    const card = page.locator('[data-test="inventory-item"]').first();
    await allureStep('Compare product card element', async () => {
      const result = await snapshots.assertElementScreenshot(card, {
        name: 'product-card',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('header should match baseline', async ({ page }) => {
    const header = page.locator('.header_container');
    await allureStep('Compare header element', async () => {
      const result = await snapshots.assertElementScreenshot(header, {
        name: 'header-bar',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });
});

test.describe('Visual Snapshots — Multiple Valid States @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Multi-Baseline',
      tags: ['visual', 'snapshot', 'multi-baseline'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('cart badge has multiple valid states', async ({ page, inventoryPage }) => {
    await page.waitForLoadState('networkidle');
    const cartArea = page.locator('[data-test="shopping-cart-link"]');

    // Save multiple valid states as baselines
    await allureStep('Save empty cart as baseline', async () => {
      await snapshots.assertElementScreenshot(cartArea, {
        name: 'cart-badge-states',
        testFilePath: __filename,
        updateBaseline: true,
      });
    });

    await allureStep('Save 1-item cart as baseline', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Backpack');
      await snapshots.assertElementScreenshot(cartArea, {
        name: 'cart-badge-states',
        testFilePath: __filename,
        updateBaseline: true,
      });
    });

    await allureStep('Save 2-item cart as baseline', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Bike Light');
      await snapshots.assertElementScreenshot(cartArea, {
        name: 'cart-badge-states',
        testFilePath: __filename,
        updateBaseline: true,
      });
    });

    // Verify current state matches one of the baselines
    await allureStep('Verify current state matches a baseline', async () => {
      const result = await snapshots.assertElementScreenshot(cartArea, {
        name: 'cart-badge-states',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
      expect(result.matchedBaselineIndex).toBeGreaterThanOrEqual(0);
      console.log(result.summary);
    });
  });
});

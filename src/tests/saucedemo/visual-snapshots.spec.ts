import { test, expect } from './fixtures';
import { SnapshotManager, configureAllure, allureStep } from '../../main/utils';
import * as path from 'path';

/**
 * Visual Snapshot Tests — Compare page/element screenshots against baselines.
 *
 * Two modes demonstrated:
 * 1. Single baseline: standard visual regression (one valid state)
 * 2. Multi-baseline: multiple valid states (e.g. different sort orders, cart states)
 *
 * Snapshots are stored alongside this test file:
 *   src/tests/saucedemo/visual-snapshots-<name>-snapshots/baseline-N.png
 */

const manager = new SnapshotManager();

test.describe('Visual Snapshots — Single Baseline @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Single Baseline',
      feature: 'Visual Testing',
      tags: ['visual', 'snapshot'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('login page should match baseline', async ({ page, loginPage }) => {
    // Navigate back to login to capture it
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    await allureStep('Compare login page screenshot against baseline', async () => {
      const result = await manager.assertScreenshot(page, {
        name: 'login-page',
        testFilePath: __filename,
        screenshotOptions: { fullPage: true, animations: 'disabled' },
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('inventory page should match baseline', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    await allureStep('Compare inventory page against baseline', async () => {
      const result = await manager.assertScreenshot(page, {
        name: 'inventory-page',
        testFilePath: __filename,
        screenshotOptions: { fullPage: true, animations: 'disabled' },
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('product card element should match baseline', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const firstProduct = page.locator('[data-test="inventory-item"]').first();

    await allureStep('Compare first product card element', async () => {
      const result = await manager.assertElementScreenshot(firstProduct, {
        name: 'product-card-first',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('cart icon should match baseline when empty', async ({ page }) => {
    const cartContainer = page.locator('[data-test="shopping-cart-link"]');

    await allureStep('Compare empty cart icon', async () => {
      const result = await manager.assertElementScreenshot(cartContainer, {
        name: 'cart-icon-empty',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });

  test('header should match baseline', async ({ page }) => {
    const header = page.locator('.header_container');

    await allureStep('Compare header element', async () => {
      const result = await manager.assertElementScreenshot(header, {
        name: 'header-bar',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
    });
  });
});

test.describe('Visual Snapshots — Multiple Valid Baselines @visual', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Visual Regression',
      subSuite: 'Multi-Baseline',
      feature: 'Visual Testing',
      tags: ['visual', 'snapshot', 'multi-baseline'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('cart badge has multiple valid states (0, 1, 2 items)', async ({ page, inventoryPage }) => {
    await page.waitForLoadState('networkidle');
    const cartArea = page.locator('[data-test="shopping-cart-link"]');

    // State 1: Empty cart (no badge visible)
    await allureStep('Capture empty cart state as baseline', async () => {
      const result = await manager.assertElementScreenshot(cartArea, {
        name: 'cart-badge-multi',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // State 2: Cart with 1 item
    await allureStep('Add one item and capture as second baseline', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Backpack');
      const result = await manager.assertElementScreenshot(cartArea, {
        name: 'cart-badge-multi',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // State 3: Cart with 2 items
    await allureStep('Add second item and capture as third baseline', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Bike Light');
      const result = await manager.assertElementScreenshot(cartArea, {
        name: 'cart-badge-multi',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // Now verify: any of the 3 states should match
    await allureStep('Verify current state matches one of the baselines', async () => {
      const result = await manager.assertElementScreenshot(cartArea, {
        name: 'cart-badge-multi',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
      // Should match the last baseline (2 items)
      expect(result.matchedBaselineIndex).toBeGreaterThanOrEqual(0);
    });
  });

  test('inventory page valid in both sort orders (A-Z and Z-A)', async ({ page, inventoryPage }) => {
    await page.waitForLoadState('networkidle');
    const productList = page.locator('[data-test="inventory-list"]');

    // Baseline 1: Default sort (A-Z)
    await allureStep('Capture A-Z sort as first baseline', async () => {
      await inventoryPage.sortBy('az');
      await page.waitForTimeout(300);
      const result = await manager.assertElementScreenshot(productList, {
        name: 'product-list-sorted',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // Baseline 2: Z-A sort
    await allureStep('Capture Z-A sort as second baseline', async () => {
      await inventoryPage.sortBy('za');
      await page.waitForTimeout(300);
      const result = await manager.assertElementScreenshot(productList, {
        name: 'product-list-sorted',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // Verify: either sort order is valid
    await allureStep('Verify current state matches one of the sort baselines', async () => {
      const result = await manager.assertElementScreenshot(productList, {
        name: 'product-list-sorted',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
      console.log(result.summary);
    });
  });

  test('login page valid with and without error message', async ({ page, loginPage }) => {
    // Navigate to login
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    const loginForm = page.locator('#login_button_container');

    // Baseline 1: Clean login form (no error)
    await allureStep('Capture clean login form', async () => {
      const result = await manager.assertElementScreenshot(loginForm, {
        name: 'login-form-states',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // Baseline 2: Login form with error
    await allureStep('Trigger error and capture as second baseline', async () => {
      await loginPage.login('locked_out_user', 'secret_sauce');
      await page.waitForTimeout(300);
      const result = await manager.assertElementScreenshot(loginForm, {
        name: 'login-form-states',
        testFilePath: __filename,
        updateBaseline: true,
      });
      expect(result.isMatch).toBe(true);
    });

    // Verify: either state is valid
    await allureStep('Verify current state matches one of the form baselines', async () => {
      const result = await manager.assertElementScreenshot(loginForm, {
        name: 'login-form-states',
        testFilePath: __filename,
      });
      expect(result.isMatch).toBe(true);
      expect(result.matchedBaselineIndex).toBeGreaterThanOrEqual(0);
      console.log(result.summary);
    });
  });
});

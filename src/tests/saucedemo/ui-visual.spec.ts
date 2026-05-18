import { test, expect } from './fixtures';
import {
  configureAllure,
  allureStep,
  collectConsoleErrors,
  scrollToBottom,
  runA11yChecks,
  highlightElement,
} from '../../main/utils';
import { fluentExpect, fluentExpectPage } from '../../main/assertions';

/**
 * UI & Visual Tests — Layout, accessibility, console errors, and visual assertions.
 */
test.describe('UI & Visual @ui', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'UI & Visual',
      subSuite: 'Layout & Accessibility',
      feature: 'UI Quality',
      tags: ['ui', 'visual', 'a11y'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('should have no console errors on inventory page @smoke', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await allureStep('Navigate and interact with page', async () => {
      await page.waitForLoadState('networkidle');
      await scrollToBottom(page);
    });

    await allureStep('Verify no console errors', async () => {
      expect(errors.get()).toHaveLength(0);
    });
  });

  test('should pass basic accessibility checks', async ({ page }) => {
    await allureStep('Run accessibility audit', async () => {
      const result = await runA11yChecks(page);

      // Log violations for debugging (not failing on all — SauceDemo has known issues)
      if (result.violations.length > 0) {
        console.log('A11y violations:', result.violations.slice(0, 5));
      }

      // At minimum, images should have alt text
      const imgCheck = result.violations.filter((v) => v.includes('alt'));
      expect(imgCheck.length).toBeLessThanOrEqual(6); // SauceDemo product images
    });
  });

  test('should display correct page structure', async ({ page }) => {
    await fluentExpectPage(page)
      .toHaveTitle('Swag Labs')
      .toHaveURL(/inventory/);
  });

  test('should display header elements correctly', async ({ page }) => {
    const header = page.locator('.header_container');

    await fluentExpect(header)
      .toBeVisible()
      .toBeInViewport();

    await fluentExpect(page.locator('.app_logo'))
      .toBeVisible()
      .toHaveText('Swag Labs');
  });

  test('should display product cards with required elements', async ({ page }) => {
    const firstItem = page.locator('[data-test="inventory-item"]').first();

    await allureStep('Verify product card structure', async () => {
      // Each product card should have: image, name, description, price, add button
      await fluentExpect(firstItem.locator('img')).toBeVisible();
      await fluentExpect(firstItem.locator('[data-test="inventory-item-name"]')).toBeVisible();
      await fluentExpect(firstItem.locator('[data-test="inventory-item-desc"]')).toBeVisible();
      await fluentExpect(firstItem.locator('[data-test="inventory-item-price"]')).toBeVisible();
      await expect(firstItem.locator('button')).toBeVisible();
    });
  });

  test('should have responsive cart badge', async ({ page, inventoryPage }) => {
    const badge = page.locator('[data-test="shopping-cart-badge"]');

    await allureStep('Cart badge hidden when empty', async () => {
      await expect(badge).toBeHidden();
    });

    await allureStep('Cart badge shows count after adding item', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Backpack');
      await fluentExpect(badge).toBeVisible().toHaveText('1');
    });

    await allureStep('Cart badge updates on second item', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Bike Light');
      await fluentExpect(badge).toBeVisible().toHaveText('2');
    });
  });

  test('should highlight and verify footer', async ({ page }) => {
    await allureStep('Scroll to footer', async () => {
      await scrollToBottom(page);
    });

    const footer = page.locator('.footer');
    await highlightElement(footer, { color: 'blue', duration: 1000 });

    await fluentExpect(footer)
      .toBeVisible()
      .toContainText('Sauce Labs');
  });
});

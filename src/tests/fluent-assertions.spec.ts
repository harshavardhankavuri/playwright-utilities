import { test, expect } from './saucedemo/fixtures';
import { configureAllure, allureStep, allureTagsFromTitle } from '../main/utils';
import { fluentExpect, fluentExpectPage } from '../main/assertions';

/**
 * Fluent Assertions + Home Page tests — using SauceDemo inventory page.
 */
test.describe('Fluent Assertions - Locator @smoke', () => {
  test.beforeEach(async ({ loginPage, inventoryPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Assertions',
      subSuite: 'Fluent Expect',
      tags: ['smoke', 'assertions'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('should chain visibility and text assertions', async ({ page }) => {
    await fluentExpect(page.locator('.app_logo'))
      .toBeVisible()
      .toContainText('Swag Labs');
  });

  test('should chain visibility, enabled, and clickable assertions', async ({ page }) => {
    const cartLink = page.locator('[data-test="shopping-cart-link"]');
    await fluentExpect(cartLink)
      .toBeVisible()
      .toBeEnabled()
      .toBeClickable();
  });

  test('should chain attribute assertions', async ({ page }) => {
    const sortDropdown = page.locator('[data-test="product-sort-container"]');
    await fluentExpect(sortDropdown)
      .toBeVisible()
      .toHaveAttribute('data-test', 'product-sort-container');
  });

  test('should support negation in chain', async ({ page }) => {
    const nonExistent = page.locator('#does-not-exist');
    await fluentExpect(nonExistent)
      .not.toBeVisible()
      .toBeHidden();
  });

  test('should support custom satisfies assertion', async ({ page }) => {
    const logo = page.locator('.app_logo');
    await fluentExpect(logo)
      .toBeVisible()
      .satisfies(async (locator) => {
        const box = await locator.boundingBox();
        if (!box) throw new Error('Element has no bounding box');
        if (box.width < 50) throw new Error('Element is too narrow');
      });
  });

  test('should assert element is in viewport', async ({ page }) => {
    await fluentExpect(page.locator('[data-test="title"]'))
      .toBeVisible()
      .toBeInViewport();
  });
});

test.describe('Fluent Assertions - Page @smoke', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Assertions',
      subSuite: 'Page Expect',
      tags: ['smoke', 'assertions'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('should chain page title and URL assertions', async ({ page }) => {
    await fluentExpectPage(page)
      .toHaveTitle('Swag Labs')
      .toHaveURL(/inventory/);
  });

  test('should support negation on page assertions', async ({ page }) => {
    await fluentExpectPage(page)
      .not.toHaveTitle('Wrong Title')
      .toHaveURL(/inventory/);
  });
});

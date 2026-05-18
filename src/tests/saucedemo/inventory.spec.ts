import { test, expect } from './fixtures';
import { configureAllure, allureStep, allureSeverity } from '../../main/utils';
import { fluentExpect } from '../../main/assertions';

/**
 * Inventory — Functional tests for product listing, sorting, and cart operations.
 */
test.describe('Inventory @functional', () => {
  test.beforeEach(async ({ loginPage, inventoryPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Products',
      subSuite: 'Inventory',
      feature: 'Product Listing',
      tags: ['functional', 'products'],
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('should display 6 products @smoke', async ({ inventoryPage }) => {
    await allureSeverity('critical');

    await allureStep('Verify product count', async () => {
      const count = await inventoryPage.getItemCount();
      expect(count).toBe(6);
    });
  });

  test('should display correct page title', async ({ inventoryPage }) => {
    const title = await inventoryPage.getPageTitle();
    expect(title).toBe('Products');
  });

  test('should add item to cart', async ({ inventoryPage }) => {
    await allureSeverity('critical');

    await allureStep('Add Sauce Labs Backpack to cart', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Backpack');
    });

    await allureStep('Verify cart badge shows 1', async () => {
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(1);
    });
  });

  test('should remove item from cart', async ({ inventoryPage }) => {
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    expect(await inventoryPage.getCartCount()).toBe(1);

    await allureStep('Remove item', async () => {
      await inventoryPage.removeItemFromCart('Sauce Labs Backpack');
    });

    await allureStep('Verify cart is empty', async () => {
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(0);
    });
  });

  test('should sort products A-Z', async ({ inventoryPage }) => {
    await allureStep('Sort by Name (A to Z)', async () => {
      await inventoryPage.sortBy('az');
    });

    await allureStep('Verify alphabetical order', async () => {
      const names = await inventoryPage.getItemNames();
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  test('should sort products Z-A', async ({ inventoryPage }) => {
    await inventoryPage.sortBy('za');

    const names = await inventoryPage.getItemNames();
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);
  });

  test('should sort products by price low to high', async ({ inventoryPage }) => {
    await inventoryPage.sortBy('lohi');

    const prices = await inventoryPage.getItemPrices();
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  test('should sort products by price high to low', async ({ inventoryPage }) => {
    await inventoryPage.sortBy('hilo');

    const prices = await inventoryPage.getItemPrices();
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices).toEqual(sorted);
  });
});

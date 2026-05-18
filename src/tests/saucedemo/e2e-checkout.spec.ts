import { test, expect } from './fixtures';
import { configureAllure, allureStep, allureSeverity } from '../../main/utils';

/**
 * E2E Checkout — Full end-to-end purchase flow.
 * Tests the complete user journey: login → browse → add to cart → checkout → confirm.
 */
test.describe('E2E Checkout @e2e @regression', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'E2E Flows',
      subSuite: 'Checkout',
      epic: 'Purchase Flow',
      feature: 'Checkout',
      story: 'Complete Purchase',
      tags: ['e2e', 'regression', 'checkout'],
      severity: 'critical',
    });
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('should complete full purchase flow @P1', async ({ page, inventoryPage, cartPage, checkoutPage }) => {
    await allureStep('Add items to cart', async () => {
      await inventoryPage.addItemToCart('Sauce Labs Backpack');
      await inventoryPage.addItemToCart('Sauce Labs Bike Light');
      expect(await inventoryPage.getCartCount()).toBe(2);
    });

    await allureStep('Navigate to cart', async () => {
      await inventoryPage.goToCart();
      await expect(page).toHaveURL(/cart/);
    });

    await allureStep('Verify cart contents', async () => {
      const items = await cartPage.getItemNames();
      expect(items).toContain('Sauce Labs Backpack');
      expect(items).toContain('Sauce Labs Bike Light');
      expect(await cartPage.getItemCount()).toBe(2);
    });

    await allureStep('Proceed to checkout', async () => {
      await cartPage.checkout();
      await expect(page).toHaveURL(/checkout-step-one/);
    });

    await allureStep('Fill shipping information', async () => {
      await checkoutPage.fillShippingInfo('John', 'Doe', '12345');
      await checkoutPage.continue();
      await expect(page).toHaveURL(/checkout-step-two/);
    });

    await allureStep('Verify order summary', async () => {
      const total = await checkoutPage.getTotal();
      expect(total).toContain('$');
    });

    await allureStep('Complete purchase', async () => {
      await checkoutPage.finish();
      await expect(page).toHaveURL(/checkout-complete/);
    });

    await allureStep('Verify order confirmation', async () => {
      const header = await checkoutPage.getCompleteHeader();
      expect(header).toContain('Thank you');
    });
  });

  test('should validate required checkout fields', async ({ page, inventoryPage, cartPage, checkoutPage }) => {
    await allureSeverity('normal');

    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();
    await cartPage.checkout();

    await allureStep('Submit empty form', async () => {
      await checkoutPage.continue();
    });

    await allureStep('Verify first name error', async () => {
      await expect(checkoutPage.errorMessage).toBeVisible();
      await expect(checkoutPage.errorMessage).toContainText('First Name is required');
    });
  });

  test('should allow removing items during checkout', async ({ page, inventoryPage, cartPage }) => {
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.addItemToCart('Sauce Labs Onesie');
    await inventoryPage.goToCart();

    await allureStep('Remove one item from cart', async () => {
      await cartPage.removeItem('Sauce Labs Onesie');
    });

    await allureStep('Verify only one item remains', async () => {
      expect(await cartPage.getItemCount()).toBe(1);
      const names = await cartPage.getItemNames();
      expect(names).toEqual(['Sauce Labs Backpack']);
    });
  });
});

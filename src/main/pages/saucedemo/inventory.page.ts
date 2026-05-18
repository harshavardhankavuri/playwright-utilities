import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * InventoryPage — SauceDemo products/inventory page.
 */
export class InventoryPage extends BasePage {
  readonly title: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;
  readonly sortDropdown: Locator;
  readonly inventoryItems: Locator;
  readonly burgerMenu: Locator;
  readonly logoutLink: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.locator('[data-test="title"]');
    this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');
    this.cartLink = page.locator('[data-test="shopping-cart-link"]');
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');
    this.inventoryItems = page.locator('[data-test="inventory-item"]');
    this.burgerMenu = page.getByRole('button', { name: 'Open Menu' });
    this.logoutLink = page.locator('#logout_sidebar_link');
  }

  async goto(): Promise<void> {
    await this.navigate('/inventory.html');
    await this.waitForPageLoad();

    await this.registerLocator('inventory-title', this.title);
    await this.registerLocator('inventory-cart', this.cartLink);
    await this.registerLocator('inventory-sort', this.sortDropdown);
  }

  async getPageTitle(): Promise<string> {
    return (await this.title.textContent()) || '';
  }

  async getItemCount(): Promise<number> {
    return this.inventoryItems.count();
  }

  async addItemToCart(itemName: string): Promise<void> {
    const item = this.page.locator('[data-test="inventory-item"]').filter({ hasText: itemName });
    await item.locator('button:has-text("Add to cart")').click();
  }

  async removeItemFromCart(itemName: string): Promise<void> {
    const item = this.page.locator('[data-test="inventory-item"]').filter({ hasText: itemName });
    await item.locator('button:has-text("Remove")').click();
  }

  async getCartCount(): Promise<number> {
    if (await this.cartBadge.isVisible()) {
      const text = await this.cartBadge.textContent();
      return parseInt(text || '0', 10);
    }
    return 0;
  }

  async goToCart(): Promise<void> {
    await this.cartLink.click();
  }

  async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo'): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }

  async getItemNames(): Promise<string[]> {
    const names = await this.page.locator('[data-test="inventory-item-name"]').allTextContents();
    return names;
  }

  async getItemPrices(): Promise<number[]> {
    const prices = await this.page.locator('[data-test="inventory-item-price"]').allTextContents();
    return prices.map((p) => parseFloat(p.replace('$', '')));
  }

  async logout(): Promise<void> {
    await this.burgerMenu.click();
    await this.logoutLink.click();
  }
}

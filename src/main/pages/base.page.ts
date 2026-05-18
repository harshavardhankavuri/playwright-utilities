import { type Locator, type Page } from '@playwright/test';
import { SmartLocator } from '../utils';

/**
 * BasePage - Abstract base class for all page objects.
 * Contains common methods shared across all pages.
 * Integrates SmartLocator for self-healing element resolution.
 */
export abstract class BasePage {
  readonly page: Page;
  readonly smart: SmartLocator;

  constructor(page: Page) {
    this.page = page;
    this.smart = new SmartLocator(page, { verbose: false });
  }

  /**
   * Navigate to a specific URL path relative to baseURL.
   */
  async navigate(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for the page to reach a specific load state.
   */
  async waitForPageLoad(
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
  ): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  /**
   * Get the current page title.
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get the current page URL.
   */
  getUrl(): string {
    return this.page.url();
  }

  /**
   * Click an element with optional force and timeout.
   */
  async click(locator: Locator, options?: { force?: boolean; timeout?: number }): Promise<void> {
    await locator.click(options);
  }

  /**
   * Fill a text input field.
   */
  async fill(locator: Locator, text: string): Promise<void> {
    await locator.fill(text);
  }

  /**
   * Get text content of an element.
   */
  async getText(locator: Locator): Promise<string | null> {
    return locator.textContent();
  }

  /**
   * Check if an element is visible.
   */
  async isVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  /**
   * Wait for an element to be visible.
   */
  async waitForElement(locator: Locator, timeout?: number): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Register locator(s) with SmartLocator for self-healing.
   * Accepts a single Locator, a UserLocatorEntry, or an array of weighted entries.
   */
  protected async registerLocator(
    name: string,
    locators: Locator | import('../utils').UserLocatorEntry | Array<import('../utils').UserLocatorEntry | Locator>,
  ): Promise<void> {
    try {
      await this.smart.register(name, locators);
    } catch {
      // Registration is best-effort — don't fail the test
    }
  }

  /**
   * Find an element using SmartLocator with auto-healing fallback.
   * If the primary locator breaks, tries alternative strategies.
   */
  protected async findSmart(name: string): Promise<Locator> {
    return this.smart.locate(name);
  }
}

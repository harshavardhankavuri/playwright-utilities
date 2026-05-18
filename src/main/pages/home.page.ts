import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * HomePage - Page object for the Playwright documentation home page.
 *
 * Uses SmartLocator for self-healing: if a primary locator breaks due to
 * UI changes, the framework automatically tries fallback strategies
 * (testId, role, label, text, CSS) to find the element.
 */
export class HomePage extends BasePage {
  // Primary locators (used for initial registration and direct access)
  readonly getStartedLink: Locator;
  readonly heading: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    super(page);
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });
    this.heading = page.getByRole('heading', { name: 'Playwright enables reliable' });
    this.searchButton = page.getByRole('button', { name: 'Search' });
  }

  /**
   * Navigate to the home page and register all elements with SmartLocator.
   * Registration scans each element's DOM attributes and stores multiple
   * locator strategies for self-healing.
   */
  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForPageLoad();

    // Register elements for self-healing (best-effort, non-blocking)
    await this.registerLocator('home-get-started', this.getStartedLink);
    await this.registerLocator('home-heading', this.heading);
    await this.registerLocator('home-search-button', this.searchButton);
  }

  /**
   * Click the "Get Started" link.
   * Uses SmartLocator — if the primary role locator breaks, falls back
   * to alternative strategies (text, CSS, href, etc.).
   */
  async clickGetStarted(): Promise<void> {
    const locator = await this.findSmart('home-get-started');
    await this.click(locator);
  }

  /**
   * Open the search dialog.
   */
  async openSearch(): Promise<void> {
    const locator = await this.findSmart('home-search-button');
    await this.click(locator);
  }

  /**
   * Check if the main heading is visible.
   */
  async isHeadingVisible(): Promise<boolean> {
    const locator = await this.findSmart('home-heading');
    return this.isVisible(locator);
  }
}

import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * HomePage - Page object for the Playwright documentation home page.
 * Demonstrates the POM pattern with locators and actions.
 */
export class HomePage extends BasePage {
  // Locators
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
   * Navigate to the home page.
   */
  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForPageLoad();
  }

  /**
   * Click the "Get Started" link.
   */
  async clickGetStarted(): Promise<void> {
    await this.click(this.getStartedLink);
  }

  /**
   * Open the search dialog.
   */
  async openSearch(): Promise<void> {
    await this.click(this.searchButton);
  }

  /**
   * Check if the main heading is visible.
   */
  async isHeadingVisible(): Promise<boolean> {
    return this.isVisible(this.heading);
  }
}

import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * HomePage - Page object for the Playwright documentation home page.
 *
 * Uses SmartLocator with weighted user locators:
 * - User-provided locators are tried first (highest weight wins)
 * - If all user locators fail, auto-extracted DOM strategies heal the locator
 */
export class HomePage extends BasePage {
  readonly getStartedLink: Locator;
  readonly heading: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    super(page);
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });
    this.heading = page.getByRole('heading', { name: 'Playwright enables reliable' });
    this.searchButton = page.getByRole('button', { name: 'Search' });
  }

  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForPageLoad();

    // Register with weighted user locators — highest weight tried first
    await this.registerLocator('home-get-started', [
      { locator: this.getStartedLink, weight: 200, description: 'role:link Get started' },
      { locator: this.page.locator('a[href="/docs/intro"]'), weight: 100, description: 'css:href' },
    ]);

    await this.registerLocator('home-heading', this.heading);

    await this.registerLocator('home-search-button', [
      { locator: this.searchButton, weight: 200, description: 'role:button Search' },
      { locator: this.page.locator('.DocSearch-Button'), weight: 100, description: 'css:class' },
    ]);
  }

  async clickGetStarted(): Promise<void> {
    const locator = await this.findSmart('home-get-started');
    await this.click(locator);
  }

  async openSearch(): Promise<void> {
    const locator = await this.findSmart('home-search-button');
    await this.click(locator);
  }

  async isHeadingVisible(): Promise<boolean> {
    const locator = await this.findSmart('home-heading');
    return this.isVisible(locator);
  }
}

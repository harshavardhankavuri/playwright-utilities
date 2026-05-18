import { test as base } from '@playwright/test';
import { HomePage } from '../pages';
import { fluentExpect, fluentExpectPage, fluentExpectResponse } from '../assertions';
import { VisualRegression } from '../utils';

/**
 * Custom test fixtures that provide page objects and utilities to tests.
 */
type PageFixtures = {
  homePage: HomePage;
  visual: VisualRegression;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },
  visual: async ({}, use) => {
    const visual = new VisualRegression();
    await use(visual);
  },
});

export { expect } from '@playwright/test';
export { fluentExpect as expect$, fluentExpect, fluentExpectPage, fluentExpectResponse };
export { VisualRegression };

import { test as base } from '@playwright/test';
import { HomePage } from '../pages';
import { fluentExpect, fluentExpectPage, fluentExpectResponse } from '../assertions';
import { VisualRegression, PerformanceCollector } from '../utils';

/**
 * Custom test fixtures that provide page objects and utilities to tests.
 */
type PageFixtures = {
  homePage: HomePage;
  visual: VisualRegression;
  /**
   * Performance collector fixture.
   *
   * Automatically starts collecting Web Vitals + Navigation Timing before
   * the test runs and attaches the full metrics report to both Allure and
   * the Playwright HTML report after the test completes.
   *
   * Usage in a test:
   *   test('my test', async ({ page, perf }) => {
   *     await page.goto('/dashboard');
   *     // Metrics are collected automatically on attach() in teardown.
   *     // Optionally snapshot mid-test:
   *     await perf.collectCurrentPage();
   *   });
   */
  perf: PerformanceCollector;
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

  perf: async ({ page }, use, testInfo) => {
    const collector = new PerformanceCollector(page);
    await collector.start();
    await use(collector);
    // Attach metrics to both Allure and Playwright HTML report after the test
    await collector.attach(testInfo);
  },
});

export { expect } from '@playwright/test';
export { fluentExpect as expect$, fluentExpect, fluentExpectPage, fluentExpectResponse };
export { VisualRegression };

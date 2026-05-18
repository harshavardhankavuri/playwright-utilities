import { test, expect } from '../main/fixtures';
import { configureAllure, allureStep, allureTagsFromTitle } from '../main/utils';

test.describe('Home Page', () => {
  test.beforeEach(async ({ homePage }, testInfo) => {
    // ─── Allure Report Organization ──────────────────────────────
    await configureAllure({
      parentSuite: 'Playwright Documentation',
      suite: 'Home Page',
      subSuite: 'Core Navigation',
      epic: 'Documentation Site',
      feature: 'Home Page',
      tags: ['smoke', 'navigation'],
      severity: 'critical',
      owner: 'QA Team',
    });

    // Auto-extract @tags from test title (e.g. @smoke, @regression)
    await allureTagsFromTitle(testInfo.title);

    await homePage.goto();
  });

  test('should display the main heading @smoke', async ({ homePage }) => {
    await allureStep('Verify heading is visible', async () => {
      const isVisible = await homePage.isHeadingVisible();
      expect(isVisible).toBeTruthy();
    });
  });

  test('should have correct page title @smoke @P1', async ({ homePage }) => {
    await allureStep('Get page title', async () => {
      const title = await homePage.getTitle();
      expect(title).toContain('Playwright');
    });
  });

  test('should navigate to Get Started page @regression', async ({ homePage, page }) => {
    await allureStep('Click Get Started link', async () => {
      await homePage.clickGetStarted();
    });

    await allureStep('Verify navigation to intro page', async () => {
      await expect(page).toHaveURL(/.*intro/);
    });
  });
});

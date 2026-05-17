import { test, expect } from '../main/fixtures';

test.describe('Home Page', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test('should display the main heading', async ({ homePage }) => {
    const isVisible = await homePage.isHeadingVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should have correct page title', async ({ homePage }) => {
    const title = await homePage.getTitle();
    expect(title).toContain('Playwright');
  });

  test('should navigate to Get Started page', async ({ homePage, page }) => {
    await homePage.clickGetStarted();
    await expect(page).toHaveURL(/.*intro/);
  });
});

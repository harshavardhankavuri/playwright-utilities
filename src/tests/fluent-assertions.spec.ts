import { test, expect$, fluentExpectPage } from '../main/fixtures';

test.describe('Fluent Assertions - Locator', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test('should chain visibility and text assertions', async ({ homePage }) => {
    await expect$(homePage.heading)
      .toBeVisible()
      .toContainText('Playwright');
  });

  test('should chain visibility, enabled, and clickable assertions', async ({ homePage }) => {
    await expect$(homePage.getStartedLink)
      .toBeVisible()
      .toBeEnabled()
      .toBeClickable()
      .toContainText('Get started');
  });

  test('should chain CSS and attribute assertions', async ({ homePage }) => {
    await expect$(homePage.getStartedLink)
      .toBeVisible()
      .toHaveAttribute('href')
      .toHaveCss('display', 'block');
  });

  test('should support negation in chain', async ({ page }) => {
    const nonExistent = page.locator('#does-not-exist');
    await expect$(nonExistent)
      .not.toBeVisible()
      .toBeHidden();
  });

  test('should support custom satisfies assertion', async ({ homePage }) => {
    await expect$(homePage.heading)
      .toBeVisible()
      .satisfies(async (locator) => {
        const box = await locator.boundingBox();
        if (!box) throw new Error('Element has no bounding box');
        if (box.width < 50) throw new Error('Element is too narrow');
      });
  });

  test('should assert element is in viewport', async ({ homePage }) => {
    await expect$(homePage.heading)
      .toBeVisible()
      .toBeInViewport();
  });

  test('should assert accessible name', async ({ homePage }) => {
    await expect$(homePage.getStartedLink)
      .toBeVisible()
      .toHaveAccessibleName('Get started');
  });
});

test.describe('Fluent Assertions - Page', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test('should chain page title and URL assertions', async ({ page }) => {
    await fluentExpectPage(page)
      .toHaveTitle(/Playwright/)
      .toHaveURL(/playwright\.dev/);
  });

  test('should support negation on page assertions', async ({ page }) => {
    await fluentExpectPage(page)
      .not.toHaveTitle('This is not the title')
      .toHaveURL(/playwright\.dev/);
  });
});

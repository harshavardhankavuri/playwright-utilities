import { test, expect } from '@playwright/test';
import { SoftAssert } from '../main/utils';

/**
 * Tests for the chainable SoftAssert utility.
 * Compares behavior with Playwright's built-in expect.soft().
 */
test.describe('SoftAssert — Chainable Soft Assertions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
  });

  test('chains multiple assertions in a single await', async ({ page }) => {
    const soft = new SoftAssert();
    const username = page.locator('[data-test="username"]');

    // Single await runs all five assertions; failures are collected.
    await soft.expect(username, 'username field')
      .toBeVisible()
      .toBeEnabled()
      .toBeEditable()
      .toHaveAttribute('placeholder', 'Username')
      .toHaveValue('');

    expect(soft.hasFailures()).toBe(false);
    expect(soft.getCounts().total).toBe(5);
    expect(soft.getCounts().passed).toBe(5);
  });

  test('chains page-level assertions', async ({ page }) => {
    const soft = new SoftAssert();

    await soft.expectPage(page)
      .toHaveTitle(/Swag Labs/)
      .toHaveURL(/saucedemo\.com/);

    expect(soft.hasFailures()).toBe(false);
    expect(soft.getCounts().total).toBe(2);
  });

  test('collects multiple failures across chained assertions', async ({ page }) => {
    const soft = new SoftAssert();
    const username = page.locator('[data-test="username"]');

    // First two assertions pass, last three fail.
    await soft.expect(username, 'username field')
      .toBeVisible()
      .toBeEnabled()
      .toHaveValue('admin')                          // FAIL: empty
      .toHaveAttribute('type', 'password')          // FAIL: type is 'text'
      .toHaveCSS('background-color', 'rgb(0, 0, 0)'); // FAIL

    expect(soft.hasFailures()).toBe(true);
    expect(soft.getCounts().failed).toBe(3);
    expect(soft.getCounts().passed).toBe(2);

    // assertAll throws a single grouped error
    expect(() => soft.assertAll()).toThrow(/3 of 5 soft assertion\(s\) failed/);
  });

  test('supports negation with .not in a chain', async ({ page }) => {
    const soft = new SoftAssert();
    const loginBtn = page.locator('[data-test="login-button"]');

    await soft.expect(loginBtn, 'login button')
      .toBeVisible()
      .not.toBeDisabled()
      .not.toHaveText('Logout');

    expect(soft.hasFailures()).toBe(false);
    expect(soft.getCounts().total).toBe(3);
  });

  test('supports custom predicate via satisfies()', async ({ page }) => {
    const soft = new SoftAssert();
    const username = page.locator('[data-test="username"]');

    await soft.expect(username)
      .toBeVisible()
      .satisfies(async (loc) => {
        const box = await loc.boundingBox();
        if (!box || box.width < 100) throw new Error('Field too narrow');
      }, 'width >= 100px');

    expect(soft.hasFailures()).toBe(false);
  });

  test('chains value assertions', async () => {
    const soft = new SoftAssert();

    await soft.expectValue(42, 'answer')
      .toBe(42)
      .toBeGreaterThan(10)
      .toBeLessThan(100)
      .not.toBe(0);

    expect(soft.hasFailures()).toBe(false);
    expect(soft.getCounts().total).toBe(4);
  });

  test('reset() clears all state', async ({ page }) => {
    const soft = new SoftAssert();
    const username = page.locator('[data-test="username"]');

    await soft.expect(username).toHaveValue('wrong');
    expect(soft.hasFailures()).toBe(true);

    soft.reset();
    expect(soft.hasFailures()).toBe(false);
    expect(soft.getCounts().total).toBe(0);
  });

  test('failure summary includes label and assertion details', async ({ page }) => {
    const soft = new SoftAssert();
    const username = page.locator('[data-test="username"]');

    await soft.expect(username, 'username').toHaveValue('expected-value');

    const failures = soft.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].label).toBe('username');
    expect(failures[0].assertion).toContain('toHaveValue');
    expect(failures[0].error).toBeTruthy();
  });
});

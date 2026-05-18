import { test, expect } from './fixtures';
import { configureAllure, allureStep, allureSeverity } from '../../main/utils';
import { fluentExpect } from '../../main/assertions';

/**
 * Login — Functional tests for authentication.
 */
test.describe('Login @smoke @functional', () => {
  test.beforeEach(async ({ loginPage }) => {
    await configureAllure({
      parentSuite: 'SauceDemo',
      suite: 'Authentication',
      subSuite: 'Login',
      feature: 'Login',
      tags: ['smoke', 'functional', 'auth'],
    });
    await loginPage.goto();
  });

  test('should login with valid credentials @P1', async ({ page, loginPage }) => {
    await allureSeverity('critical');

    await allureStep('Enter valid credentials', async () => {
      await loginPage.login('standard_user', 'secret_sauce');
    });

    await allureStep('Verify redirect to inventory', async () => {
      await expect(page).toHaveURL(/inventory/);
    });
  });

  test('should show error for locked out user', async ({ loginPage }) => {
    await allureSeverity('normal');

    await allureStep('Attempt login with locked user', async () => {
      await loginPage.login('locked_out_user', 'secret_sauce');
    });

    await allureStep('Verify error message', async () => {
      const error = await loginPage.getErrorMessage();
      expect(error).toContain('locked out');
    });
  });

  test('should show error for invalid password', async ({ loginPage }) => {
    await allureSeverity('normal');

    await allureStep('Attempt login with wrong password', async () => {
      await loginPage.login('standard_user', 'wrong_password');
    });

    await allureStep('Verify error is displayed', async () => {
      await fluentExpect(loginPage.errorMessage).toBeVisible().toContainText('do not match');
    });
  });

  test('should show error for empty username', async ({ loginPage }) => {
    await allureSeverity('minor');

    await loginPage.login('', 'secret_sauce');

    await fluentExpect(loginPage.errorMessage).toBeVisible().toContainText('Username is required');
  });

  test('should show error for empty password', async ({ loginPage }) => {
    await allureSeverity('minor');

    await loginPage.login('standard_user', '');

    await fluentExpect(loginPage.errorMessage).toBeVisible().toContainText('Password is required');
  });
});

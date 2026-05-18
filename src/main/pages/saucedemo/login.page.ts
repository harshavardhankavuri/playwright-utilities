import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * LoginPage — SauceDemo login page.
 * Demonstrates SmartLocator with weighted user locators.
 */
export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorMessage = page.locator('[data-test="error"]');
    this.logo = page.locator('.login_logo');
  }

  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForPageLoad();

    await this.registerLocator('login-username', [
      { locator: this.usernameInput, weight: 200, description: 'placeholder:Username' },
      { locator: this.page.locator('#user-name'), weight: 100, description: 'css:id' },
    ]);
    await this.registerLocator('login-password', [
      { locator: this.passwordInput, weight: 200, description: 'placeholder:Password' },
      { locator: this.page.locator('#password'), weight: 100, description: 'css:id' },
    ]);
    await this.registerLocator('login-submit', [
      { locator: this.loginButton, weight: 200, description: 'role:button Login' },
      { locator: this.page.locator('#login-button'), weight: 100, description: 'css:id' },
    ]);
  }

  async login(username: string, password: string): Promise<void> {
    const userField = await this.findSmart('login-username');
    const passField = await this.findSmart('login-password');
    const submitBtn = await this.findSmart('login-submit');

    await userField.fill(username);
    await passField.fill(password);
    await submitBtn.click();
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) || '';
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }
}

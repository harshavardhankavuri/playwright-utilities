import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * CheckoutPage — SauceDemo checkout flow (step one + step two + complete).
 */
export class CheckoutPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;
  readonly completeHeader: Locator;
  readonly completeText: Locator;
  readonly summaryTotal: Locator;
  readonly backHomeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('[data-test="firstName"]');
    this.lastNameInput = page.locator('[data-test="lastName"]');
    this.postalCodeInput = page.locator('[data-test="postalCode"]');
    this.continueButton = page.locator('[data-test="continue"]');
    this.finishButton = page.locator('[data-test="finish"]');
    this.cancelButton = page.locator('[data-test="cancel"]');
    this.errorMessage = page.locator('[data-test="error"]');
    this.completeHeader = page.locator('[data-test="complete-header"]');
    this.completeText = page.locator('[data-test="complete-text"]');
    this.summaryTotal = page.locator('[data-test="total-label"]');
    this.backHomeButton = page.locator('[data-test="back-to-products"]');
  }

  async fillShippingInfo(firstName: string, lastName: string, postalCode: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async getTotal(): Promise<string> {
    return (await this.summaryTotal.textContent()) || '';
  }

  async getCompleteHeader(): Promise<string> {
    return (await this.completeHeader.textContent()) || '';
  }

  async backToHome(): Promise<void> {
    await this.backHomeButton.click();
  }
}

import {
  type Locator,
  type Page,
  type APIResponse,
  expect as playwrightExpect,
} from '@playwright/test';

/**
 * Options for assertion timeout and custom message.
 */
interface AssertionOptions {
  timeout?: number;
  message?: string;
}

/**
 * A single assertion step to be executed.
 */
type AssertionStep = () => Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// LOCATOR FLUENT EXPECT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FluentLocatorExpect - Chainable assertions for Playwright Locators.
 *
 * Covers ALL auto-retrying locator assertions from Playwright docs:
 * https://playwright.dev/docs/test-assertions
 *
 * Usage:
 *   await fluentExpect(locator).toBeVisible().toHaveText('Hello').toHaveCss('color', 'red');
 */
export class FluentLocatorExpect implements PromiseLike<void> {
  private readonly locator: Locator;
  private readonly steps: AssertionStep[] = [];
  private readonly defaultTimeout: number;
  private readonly chainLabel: string | undefined;
  private negate = false;

  constructor(locator: Locator, options?: { timeout?: number; message?: string }) {
    this.locator = locator;
    this.defaultTimeout = options?.timeout ?? 5_000;
    this.chainLabel = options?.message;
  }

  /** Negate the next assertion. */
  get not(): this {
    this.negate = true;
    return this;
  }

  // ─── Helper ─────────────────────────────────────────────────────────────

  private consumeNegate(): boolean {
    const val = this.negate;
    this.negate = false;
    return val;
  }

  /** Combine the chain-level label with a per-call override. */
  private label(perCall?: string): string | undefined {
    return perCall ?? this.chainLabel;
  }

  private pw(message?: string) {
    return playwrightExpect(this.locator, this.label(message));
  }

  private pwMaybeNot(negated: boolean, message?: string) {
    return negated ? this.pw(message).not : this.pw(message);
  }

  // ─── Visibility & State ─────────────────────────────────────────────────

  /** Assert element is attached to the DOM. */
  toBeAttached(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeAttached({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is visible. */
  toBeVisible(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeVisible({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is hidden. */
  toBeHidden(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeHidden({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is enabled. */
  toBeEnabled(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeEnabled({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is disabled. */
  toBeDisabled(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeDisabled({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is editable. */
  toBeEditable(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeEditable({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element is focused. */
  toBeFocused(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeFocused({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert checkbox/radio is checked. */
  toBeChecked(options?: AssertionOptions & { checked?: boolean }): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeChecked({
        timeout: options?.timeout ?? this.defaultTimeout,
        checked: options?.checked,
      });
    });
    return this;
  }

  /** Assert element is empty (no children/text). */
  toBeEmpty(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeEmpty({
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element intersects the viewport. */
  toBeInViewport(options?: AssertionOptions & { ratio?: number }): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toBeInViewport({
        timeout: options?.timeout ?? this.defaultTimeout,
        ratio: options?.ratio,
      });
    });
    return this;
  }

  /**
   * Assert element is clickable (visible + enabled).
   * This is a composite assertion not native to Playwright.
   */
  toBeClickable(options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      const timeout = options?.timeout ?? this.defaultTimeout;
      if (neg) {
        const isVisible = await this.locator.isVisible();
        const isEnabled = isVisible ? await this.locator.isEnabled() : false;
        if (isVisible && isEnabled) {
          throw new Error(
            options?.message || 'Expected element not to be clickable, but it is visible and enabled',
          );
        }
      } else {
        await this.pw(options?.message).toBeVisible({ timeout });
        await this.pw(options?.message).toBeEnabled({ timeout });
      }
    });
    return this;
  }

  // ─── Text Assertions ────────────────────────────────────────────────────

  /** Assert element has exact or matching text. */
  toHaveText(
    expected: string | RegExp | (string | RegExp)[],
    options?: AssertionOptions & { useInnerText?: boolean; ignoreCase?: boolean },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveText(expected as string, {
        timeout: options?.timeout ?? this.defaultTimeout,
        useInnerText: options?.useInnerText,
        ignoreCase: options?.ignoreCase,
      });
    });
    return this;
  }

  /** Assert element contains text. */
  toContainText(
    expected: string | RegExp | (string | RegExp)[],
    options?: AssertionOptions & { useInnerText?: boolean; ignoreCase?: boolean },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toContainText(expected as string, {
        timeout: options?.timeout ?? this.defaultTimeout,
        useInnerText: options?.useInnerText,
        ignoreCase: options?.ignoreCase,
      });
    });
    return this;
  }

  /** Assert input/textarea has a value. */
  toHaveValue(expected: string | RegExp, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveValue(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert select has specific options selected. */
  toHaveValues(expected: (string | RegExp)[], options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveValues(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  // ─── Attribute, CSS & Class Assertions ──────────────────────────────────

  /** Assert element has a DOM attribute (optionally with value). */
  toHaveAttribute(
    name: string,
    value?: string | RegExp,
    options?: AssertionOptions,
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      const assertion = this.pwMaybeNot(neg, options?.message);
      if (value !== undefined) {
        await assertion.toHaveAttribute(name, value, {
          timeout: options?.timeout ?? this.defaultTimeout,
        });
      } else {
        await assertion.toHaveAttribute(name, /.*/,  {
          timeout: options?.timeout ?? this.defaultTimeout,
        });
      }
    });
    return this;
  }

  /** Assert element has a CSS property with value. */
  toHaveCss(property: string, value: string | RegExp, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveCSS(property, value, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element has specified CSS class(es). */
  toHaveClass(
    expected: string | RegExp | (string | RegExp)[],
    options?: AssertionOptions,
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveClass(expected as string, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element contains specified CSS classes. */
  toContainClass(
    expected: string | string[],
    options?: AssertionOptions,
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      // toContainClass was added in Playwright 1.44+
      await (this.pwMaybeNot(neg, options?.message) as any).toContainClass(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element has a specific ID. */
  toHaveId(id: string | RegExp, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveId(id, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert element has a JavaScript property with value. */
  toHaveJSProperty(name: string, value: unknown, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveJSProperty(name, value, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  // ─── Accessibility Assertions ───────────────────────────────────────────

  /** Assert element has a matching accessible name. */
  toHaveAccessibleName(
    expected: string | RegExp,
    options?: AssertionOptions & { ignoreCase?: boolean },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveAccessibleName(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
        ignoreCase: options?.ignoreCase,
      });
    });
    return this;
  }

  /** Assert element has a matching accessible description. */
  toHaveAccessibleDescription(
    expected: string | RegExp,
    options?: AssertionOptions & { ignoreCase?: boolean },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveAccessibleDescription(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
        ignoreCase: options?.ignoreCase,
      });
    });
    return this;
  }

  /** Assert element has a specific ARIA role. */
  toHaveRole(expected: string, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await (this.pwMaybeNot(neg, options?.message) as any).toHaveRole(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  // ─── Count ──────────────────────────────────────────────────────────────

  /** Assert locator resolves to a specific number of elements. */
  toHaveCount(count: number, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveCount(count, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  // ─── Screenshot & Aria Snapshot ─────────────────────────────────────────

  /** Assert element matches a screenshot (visual regression). */
  toHaveScreenshot(
    name?: string | string[],
    options?: {
      timeout?: number;
      maxDiffPixels?: number;
      maxDiffPixelRatio?: number;
      threshold?: number;
      animations?: 'disabled' | 'allow';
      caret?: 'hide' | 'initial';
      mask?: Locator[];
      omitBackground?: boolean;
      scale?: 'css' | 'device';
    },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      if (neg) throw new Error('Cannot negate toHaveScreenshot');
      await playwrightExpect(this.locator).toHaveScreenshot(name as string, {
        timeout: options?.timeout ?? this.defaultTimeout,
        ...options,
      });
    });
    return this;
  }

  /** Assert element matches an ARIA snapshot. */
  toMatchAriaSnapshot(expected: string, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await (this.pwMaybeNot(neg, options?.message) as any).toMatchAriaSnapshot(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  // ─── Custom Assertion ───────────────────────────────────────────────────

  /**
   * Add a custom assertion function to the chain.
   *
   * Usage:
   *   await fluentExpect(locator)
   *     .toBeVisible()
   *     .satisfies(async (loc) => {
   *       const box = await loc.boundingBox();
   *       if (!box || box.width < 100) throw new Error('Too narrow');
   *     });
   */
  satisfies(fn: (locator: Locator) => Promise<void>): this {
    const loc = this.locator;
    this.steps.push(async () => {
      await fn(loc);
    });
    return this;
  }

  // ─── Execution (PromiseLike) ────────────────────────────────────────────

  private async execute(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE FLUENT EXPECT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FluentPageExpect - Chainable assertions for Playwright Page.
 *
 * Covers: toHaveTitle, toHaveURL, toHaveScreenshot, toMatchAriaSnapshot
 *
 * Usage:
 *   await fluentExpectPage(page).toHaveTitle('Home').toHaveURL(/.*home/);
 */
export class FluentPageExpect implements PromiseLike<void> {
  private readonly page: Page;
  private readonly steps: AssertionStep[] = [];
  private readonly defaultTimeout: number;
  private readonly chainLabel: string | undefined;
  private negate = false;

  constructor(page: Page, options?: { timeout?: number; message?: string }) {
    this.page = page;
    this.defaultTimeout = options?.timeout ?? 5_000;
    this.chainLabel = options?.message;
  }

  get not(): this {
    this.negate = true;
    return this;
  }

  private consumeNegate(): boolean {
    const val = this.negate;
    this.negate = false;
    return val;
  }

  private pw(message?: string) {
    return playwrightExpect(this.page, message ?? this.chainLabel);
  }

  private pwMaybeNot(negated: boolean, message?: string) {
    return negated ? this.pw(message).not : this.pw(message);
  }

  /** Assert page has a matching title. */
  toHaveTitle(expected: string | RegExp, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveTitle(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert page has a matching URL. */
  toHaveURL(expected: string | RegExp, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await this.pwMaybeNot(neg, options?.message).toHaveURL(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Assert page matches a screenshot. */
  toHaveScreenshot(
    name?: string | string[],
    options?: {
      timeout?: number;
      maxDiffPixels?: number;
      maxDiffPixelRatio?: number;
      threshold?: number;
      animations?: 'disabled' | 'allow';
      caret?: 'hide' | 'initial';
      mask?: Locator[];
      omitBackground?: boolean;
      scale?: 'css' | 'device';
      fullPage?: boolean;
    },
  ): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      if (neg) throw new Error('Cannot negate toHaveScreenshot');
      await playwrightExpect(this.page).toHaveScreenshot(name as string, {
        timeout: options?.timeout ?? this.defaultTimeout,
        ...options,
      });
    });
    return this;
  }

  /** Assert page matches an ARIA snapshot. */
  toMatchAriaSnapshot(expected: string, options?: AssertionOptions): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      await (this.pwMaybeNot(neg, options?.message) as any).toMatchAriaSnapshot(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
      });
    });
    return this;
  }

  /** Add a custom assertion. */
  satisfies(fn: (page: Page) => Promise<void>): this {
    const p = this.page;
    this.steps.push(async () => {
      await fn(p);
    });
    return this;
  }

  private async execute(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE FLUENT EXPECT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FluentResponseExpect - Chainable assertions for Playwright APIResponse.
 *
 * Covers: toBeOK
 *
 * Usage:
 *   await fluentExpectResponse(response).toBeOK();
 */
export class FluentResponseExpect implements PromiseLike<void> {
  private readonly response: APIResponse;
  private readonly steps: AssertionStep[] = [];
  private negate = false;

  constructor(response: APIResponse) {
    this.response = response;
  }

  get not(): this {
    this.negate = true;
    return this;
  }

  private consumeNegate(): boolean {
    const val = this.negate;
    this.negate = false;
    return val;
  }

  /** Assert response has an OK status (200-299). */
  toBeOK(options?: { message?: string }): this {
    const neg = this.consumeNegate();
    this.steps.push(async () => {
      const assertion = neg
        ? playwrightExpect(this.response, options?.message).not
        : playwrightExpect(this.response, options?.message);
      await assertion.toBeOK();
    });
    return this;
  }

  /** Add a custom assertion. */
  satisfies(fn: (response: APIResponse) => Promise<void>): this {
    const r = this.response;
    this.steps.push(async () => {
      await fn(r);
    });
    return this;
  }

  private async execute(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a chainable fluent assertion for a Locator.
 *
 * The second argument can be either:
 *  - A descriptive label string (matches Playwright's `expect(value, message)` shape)
 *  - An options object `{ timeout, message }`
 *
 * Usage:
 *   await fluentExpect(locator).toBeVisible().toHaveText('Hello');
 *   await fluentExpect(input, 'username field').toBeVisible().toBeEnabled();
 *   await fluentExpect(input, { timeout: 10_000, message: 'username field' }).toBeVisible();
 */
export function fluentExpect(
  locator: Locator,
  labelOrOptions?: string | { timeout?: number; message?: string },
): FluentLocatorExpect {
  const options = typeof labelOrOptions === 'string'
    ? { message: labelOrOptions }
    : labelOrOptions;
  return new FluentLocatorExpect(locator, options);
}

/**
 * Create a chainable fluent assertion for a Page.
 *
 * Usage:
 *   await fluentExpectPage(page).toHaveTitle('Home').toHaveURL(/home/);
 *   await fluentExpectPage(page, 'login page').toHaveURL(/\/login$/);
 */
export function fluentExpectPage(
  page: Page,
  labelOrOptions?: string | { timeout?: number; message?: string },
): FluentPageExpect {
  const options = typeof labelOrOptions === 'string'
    ? { message: labelOrOptions }
    : labelOrOptions;
  return new FluentPageExpect(page, options);
}

/**
 * Create a chainable fluent assertion for an APIResponse.
 *
 * Usage:
 *   await fluentExpectResponse(response).toBeOK();
 */
export function fluentExpectResponse(response: APIResponse): FluentResponseExpect {
  return new FluentResponseExpect(response);
}

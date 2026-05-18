import {
  type Locator,
  type Page,
  type APIResponse,
  expect as playwrightExpect,
} from '@playwright/test';

/**
 * Soft Assertions — Collect all failures without stopping the test, with
 * full chaining support (multiple assertions on a single await).
 *
 * Differences vs Playwright's built-in `expect.soft()`:
 *
 *   Playwright (no chaining):
 *     await expect.soft(input).toBeVisible();
 *     await expect.soft(input).toHaveValue('foo');
 *     await expect.soft(input).toHaveCSS('color', 'red');
 *
 *   Ours (chained, single await):
 *     await soft.expect(input)
 *       .toBeVisible()
 *       .toHaveValue('foo')
 *       .toHaveCSS('color', 'red');
 *
 * Both approaches collect failures without stopping the test. We add:
 *   - Full chaining of multiple assertions on one locator/page/value
 *   - Negation via `.not.toBe...()` for any assertion
 *   - `satisfies(fn)` for custom predicates inside a chain
 *   - `assertAll()` to throw a single grouped error at the end
 *   - `attachToTest()` to auto-fail the current test on cleanup
 *
 * Usage:
 *   const soft = new SoftAssert();
 *
 *   await soft.expect(input, 'username field')
 *     .toBeVisible()
 *     .toBeEnabled()
 *     .toHaveValue('admin');
 *
 *   await soft.expectPage(page).toHaveTitle('Login').toHaveURL(/\/login$/);
 *
 *   soft.assertAll(); // Throws with ALL failures if any
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SoftFailure {
  /** Description of what was being asserted */
  assertion: string;
  /** Optional label/message provided when creating the chain */
  label?: string;
  /** Error message from the failed assertion */
  error: string;
  /** Index of this assertion across the entire SoftAssert */
  index: number;
}

interface SoftStep {
  name: string;
  run: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT ASSERT (collector)
// ─────────────────────────────────────────────────────────────────────────────

export class SoftAssert {
  private failures: SoftFailure[] = [];
  private assertionCount = 0;

  /** Soft assertion chain for a Locator. */
  expect(locator: Locator, message?: string): SoftLocatorAssert {
    return new SoftLocatorAssert(locator, this, message);
  }

  /** Soft assertion chain for a Page. */
  expectPage(page: Page, message?: string): SoftPageAssert {
    return new SoftPageAssert(page, this, message);
  }

  /** Soft assertion chain for an APIResponse. */
  expectResponse(response: APIResponse, message?: string): SoftResponseAssert {
    return new SoftResponseAssert(response, this, message);
  }

  /** Soft assertion chain for a plain JS value. */
  expectValue(actual: unknown, message?: string): SoftValueAssert {
    return new SoftValueAssert(actual, this, message);
  }

  /** Record a failure (called by chain proxies). */
  recordFailure(assertion: string, error: string, label?: string): void {
    this.failures.push({
      assertion,
      label,
      error,
      index: this.assertionCount,
    });
  }

  /** Increment the assertion counter (called by chain proxies). */
  incrementCount(): void {
    this.assertionCount++;
  }

  /**
   * Throw an error if any soft assertions failed. Call at end of test.
   * Returns void on success so it can be used in chain.
   */
  assertAll(): void {
    if (this.failures.length === 0) return;
    throw new Error(this.formatFailures());
  }

  /** True if any failure was recorded. */
  hasFailures(): boolean {
    return this.failures.length > 0;
  }

  /** Return all collected failures (defensive copy). */
  getFailures(): SoftFailure[] {
    return [...this.failures];
  }

  /** Get total/passed/failed counts. */
  getCounts(): { total: number; passed: number; failed: number } {
    return {
      total: this.assertionCount,
      passed: this.assertionCount - this.failures.length,
      failed: this.failures.length,
    };
  }

  /** Reset all state. */
  reset(): void {
    this.failures = [];
    this.assertionCount = 0;
  }

  /** Build a human-readable failure summary. */
  private formatFailures(): string {
    const lines = [
      `\n❌ ${this.failures.length} of ${this.assertionCount} soft assertion(s) failed:\n`,
    ];
    for (const f of this.failures) {
      const label = f.label ? ` [${f.label}]` : '';
      lines.push(`  [${f.index + 1}]${label} ${f.assertion}`);
      lines.push(`      → ${f.error}\n`);
    }
    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE CHAINABLE PROXY
// ─────────────────────────────────────────────────────────────────────────────

abstract class SoftChainBase implements PromiseLike<void> {
  protected readonly steps: SoftStep[] = [];
  protected readonly collector: SoftAssert;
  protected readonly label?: string;
  protected negate = false;

  constructor(collector: SoftAssert, label?: string) {
    this.collector = collector;
    this.label = label;
  }

  /** Negate the next assertion in the chain. */
  get not(): this {
    this.negate = true;
    return this;
  }

  protected consumeNegate(): boolean {
    const v = this.negate;
    this.negate = false;
    return v;
  }

  /** Queue a step that records its failure into the collector. */
  protected push(name: string, run: () => Promise<void>): this {
    this.steps.push({ name, run });
    return this;
  }

  /** Run all queued steps; each failure is recorded but does NOT throw. */
  protected async execute(): Promise<void> {
    for (const step of this.steps) {
      this.collector.incrementCount();
      try {
        await step.run();
      } catch (err) {
        const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
        this.collector.recordFailure(step.name, msg, this.label);
      }
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
// SOFT LOCATOR ASSERT — chainable Playwright Locator assertions
// ─────────────────────────────────────────────────────────────────────────────

export class SoftLocatorAssert extends SoftChainBase {
  private readonly locator: Locator;
  private readonly defaultTimeout = 5000;

  constructor(locator: Locator, collector: SoftAssert, label?: string) {
    super(collector, label);
    this.locator = locator;
  }

  private pw(neg: boolean) {
    return neg ? playwrightExpect(this.locator).not : playwrightExpect(this.locator);
  }

  // ─── Visibility / DOM ─────────────────────────────────────────────────

  toBeAttached(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeAttached()`, async () => {
      await this.pw(neg).toBeAttached({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeVisible(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeVisible()`, async () => {
      await this.pw(neg).toBeVisible({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeHidden(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeHidden()`, async () => {
      await this.pw(neg).toBeHidden({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeInViewport(options?: { timeout?: number; ratio?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeInViewport()`, async () => {
      await this.pw(neg).toBeInViewport({
        timeout: options?.timeout ?? this.defaultTimeout,
        ratio: options?.ratio,
      });
    });
  }

  // ─── State ────────────────────────────────────────────────────────────

  toBeEnabled(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeEnabled()`, async () => {
      await this.pw(neg).toBeEnabled({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeDisabled(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeDisabled()`, async () => {
      await this.pw(neg).toBeDisabled({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeEditable(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeEditable()`, async () => {
      await this.pw(neg).toBeEditable({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeChecked(options?: { timeout?: number; checked?: boolean }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeChecked()`, async () => {
      await this.pw(neg).toBeChecked({
        timeout: options?.timeout ?? this.defaultTimeout,
        checked: options?.checked,
      });
    });
  }

  toBeFocused(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeFocused()`, async () => {
      await this.pw(neg).toBeFocused({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toBeEmpty(options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeEmpty()`, async () => {
      await this.pw(neg).toBeEmpty({ timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  // ─── Text / Value ─────────────────────────────────────────────────────

  toHaveText(expected: string | RegExp | Array<string | RegExp>, options?: { timeout?: number; useInnerText?: boolean; ignoreCase?: boolean }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveText(${stringify(expected)})`, async () => {
      await this.pw(neg).toHaveText(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
        useInnerText: options?.useInnerText,
        ignoreCase: options?.ignoreCase,
      });
    });
  }

  toContainText(expected: string | RegExp | Array<string | RegExp>, options?: { timeout?: number; useInnerText?: boolean; ignoreCase?: boolean }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toContainText(${stringify(expected)})`, async () => {
      await this.pw(neg).toContainText(expected, {
        timeout: options?.timeout ?? this.defaultTimeout,
        useInnerText: options?.useInnerText,
        ignoreCase: options?.ignoreCase,
      });
    });
  }

  toHaveValue(expected: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveValue(${stringify(expected)})`, async () => {
      await this.pw(neg).toHaveValue(expected, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveValues(expected: Array<string | RegExp>, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveValues(${stringify(expected)})`, async () => {
      await this.pw(neg).toHaveValues(expected, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  // ─── Attributes / CSS / Class ─────────────────────────────────────────

  toHaveAttribute(name: string, value?: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveAttribute(${name}, ${stringify(value)})`, async () => {
      await this.pw(neg).toHaveAttribute(name, value ?? /.*/, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveClass(expected: string | RegExp | Array<string | RegExp>, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveClass(${stringify(expected)})`, async () => {
      await this.pw(neg).toHaveClass(expected, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveCSS(name: string, value: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveCSS(${name}, ${stringify(value)})`, async () => {
      await this.pw(neg).toHaveCSS(name, value, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveId(id: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveId(${stringify(id)})`, async () => {
      await this.pw(neg).toHaveId(id, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveCount(count: number, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveCount(${count})`, async () => {
      await this.pw(neg).toHaveCount(count, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  // ─── Custom predicate ─────────────────────────────────────────────────

  /** Run a custom predicate against the locator. Throw to fail. */
  satisfies(fn: (locator: Locator) => Promise<void>, description = 'satisfies(fn)'): this {
    const loc = this.locator;
    return this.push(description, async () => {
      await fn(loc);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT PAGE ASSERT
// ─────────────────────────────────────────────────────────────────────────────

export class SoftPageAssert extends SoftChainBase {
  private readonly page: Page;
  private readonly defaultTimeout = 5000;

  constructor(page: Page, collector: SoftAssert, label?: string) {
    super(collector, label);
    this.page = page;
  }

  private pw(neg: boolean) {
    return neg ? playwrightExpect(this.page).not : playwrightExpect(this.page);
  }

  toHaveTitle(title: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveTitle(${stringify(title)})`, async () => {
      await this.pw(neg).toHaveTitle(title, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  toHaveURL(url: string | RegExp, options?: { timeout?: number }): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveURL(${stringify(url)})`, async () => {
      await this.pw(neg).toHaveURL(url, { timeout: options?.timeout ?? this.defaultTimeout });
    });
  }

  satisfies(fn: (page: Page) => Promise<void>, description = 'satisfies(fn)'): this {
    const page = this.page;
    return this.push(description, async () => {
      await fn(page);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT RESPONSE ASSERT
// ─────────────────────────────────────────────────────────────────────────────

export class SoftResponseAssert extends SoftChainBase {
  private readonly response: APIResponse;

  constructor(response: APIResponse, collector: SoftAssert, label?: string) {
    super(collector, label);
    this.response = response;
  }

  private pw(neg: boolean) {
    return neg ? playwrightExpect(this.response).not : playwrightExpect(this.response);
  }

  toBeOK(): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeOK()`, async () => {
      await this.pw(neg).toBeOK();
    });
  }

  toHaveStatus(status: number): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toHaveStatus(${status})`, async () => {
      const actual = this.response.status();
      const matches = actual === status;
      if (neg ? matches : !matches) {
        throw new Error(`Expected status ${neg ? 'not ' : ''}${status}, got ${actual}`);
      }
    });
  }

  satisfies(fn: (response: APIResponse) => Promise<void>, description = 'satisfies(fn)'): this {
    const r = this.response;
    return this.push(description, async () => {
      await fn(r);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT VALUE ASSERT
// ─────────────────────────────────────────────────────────────────────────────

export class SoftValueAssert extends SoftChainBase {
  private readonly actual: unknown;

  constructor(actual: unknown, collector: SoftAssert, label?: string) {
    super(collector, label);
    this.actual = actual;
  }

  toBe(expected: unknown): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBe(${stringify(expected)})`, async () => {
      const equal = this.actual === expected;
      if (neg ? equal : !equal) {
        throw new Error(`Expected ${neg ? 'not ' : ''}${stringify(expected)}, got ${stringify(this.actual)}`);
      }
    });
  }

  toEqual(expected: unknown): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toEqual(${stringify(expected)})`, async () => {
      const equal = JSON.stringify(this.actual) === JSON.stringify(expected);
      if (neg ? equal : !equal) {
        throw new Error(`Expected ${neg ? 'not ' : ''}${stringify(expected)}, got ${stringify(this.actual)}`);
      }
    });
  }

  toBeTruthy(): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeTruthy()`, async () => {
      const truthy = !!this.actual;
      if (neg ? truthy : !truthy) {
        throw new Error(`Expected ${neg ? 'falsy' : 'truthy'}, got ${stringify(this.actual)}`);
      }
    });
  }

  toBeFalsy(): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeFalsy()`, async () => {
      const falsy = !this.actual;
      if (neg ? falsy : !falsy) {
        throw new Error(`Expected ${neg ? 'truthy' : 'falsy'}, got ${stringify(this.actual)}`);
      }
    });
  }

  toContain(expected: unknown): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toContain(${stringify(expected)})`, async () => {
      const str = String(this.actual);
      const contains = str.includes(String(expected));
      if (neg ? contains : !contains) {
        throw new Error(`"${str}" ${neg ? 'should not contain' : 'does not contain'} "${expected}"`);
      }
    });
  }

  toBeGreaterThan(n: number): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeGreaterThan(${n})`, async () => {
      const greater = typeof this.actual === 'number' && this.actual > n;
      if (neg ? greater : !greater) {
        throw new Error(`Expected ${neg ? 'not > ' : '> '}${n}, got ${this.actual}`);
      }
    });
  }

  toBeLessThan(n: number): this {
    const neg = this.consumeNegate();
    return this.push(`${neg ? 'not.' : ''}toBeLessThan(${n})`, async () => {
      const less = typeof this.actual === 'number' && this.actual < n;
      if (neg ? less : !less) {
        throw new Error(`Expected ${neg ? 'not < ' : '< '}${n}, got ${this.actual}`);
      }
    });
  }

  satisfies(fn: (value: unknown) => void | Promise<void>, description = 'satisfies(fn)'): this {
    const v = this.actual;
    return this.push(description, async () => {
      await fn(v);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function stringify(v: unknown): string {
  if (v instanceof RegExp) return v.toString();
  if (typeof v === 'string') return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

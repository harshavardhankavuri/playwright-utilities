import { type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single locator strategy with metadata.
 */
export interface LocatorStrategy {
  /** Strategy type identifier */
  type:
    | 'role'
    | 'text'
    | 'label'
    | 'placeholder'
    | 'testId'
    | 'css'
    | 'xpath'
    | 'id'
    | 'name'
    | 'title'
    | 'altText'
    | 'custom';
  /** The selector/value for this strategy */
  value: string;
  /** Additional options (e.g. { exact: true } for text) */
  options?: Record<string, unknown>;
  /**
   * Weight/priority. Higher = tried first.
   * - User-provided locators: 100+ (always tried before auto strategies)
   * - Auto-extracted strategies: 0-95 based on stability (testId=95, role=90, etc.)
   */
  weight: number;
  /** Source of this strategy: user-provided (default) or auto-extracted (healing) */
  source: 'user' | 'auto';
}

/**
 * A user-provided locator entry. Can be a Locator directly or with weight metadata.
 */
export interface UserLocatorEntry {
  /** The Playwright Locator (must already be constructed) */
  locator: Locator;
  /**
   * Weight (higher = tried first). Default: 100.
   * Use higher values to prefer one locator over another within user-provided ones.
   * Example: primary={ locator: ..., weight: 200 }, fallback={ locator: ..., weight: 100 }
   */
  weight?: number;
  /** Optional human-readable description (used in logs) */
  description?: string;
}

/**
 * A stored element fingerprint with multiple locator strategies.
 */
export interface ElementFingerprint {
  /** Unique name for this element (e.g. 'login-submit-button') */
  name: string;
  /** All known strategies to locate this element, ordered by weight (desc) */
  strategies: LocatorStrategy[];
  /** When this fingerprint was last updated */
  updatedAt: number;
  /** Page URL pattern where this element exists */
  pagePattern?: string;
}

/**
 * Result of a locator healing attempt.
 */
export interface HealingResult {
  /** Whether the element was found */
  found: boolean;
  /** The Playwright Locator that worked */
  locator?: Locator;
  /** Which strategy succeeded */
  usedStrategy?: LocatorStrategy;
  /** Index of the strategy that worked (0 = highest priority) */
  strategyIndex: number;
  /** Whether healing was needed (a non-user strategy was used) */
  healed: boolean;
  /** All strategies that were tried */
  triedStrategies: string[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Options for the SmartLocator.
 */
export interface SmartLocatorOptions {
  /** Directory to store element fingerprints. Default: '.locators' */
  storeDir?: string;
  /** Timeout for each strategy attempt (ms). Default: 3000 */
  strategyTimeout?: number;
  /** Whether to auto-update fingerprints when healing succeeds. Default: true */
  autoUpdate?: boolean;
  /** Whether to log healing activity. Default: true */
  verbose?: boolean;
  /**
   * Whether to extract auto-healing fallback strategies on register().
   * When true, the framework scans the element's DOM attributes and stores
   * additional strategies that are only used if user-provided locators fail.
   * Default: true
   */
  enableAutoHealing?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART LOCATOR
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<SmartLocatorOptions> = {
  storeDir: path.resolve('.locators'),
  strategyTimeout: 3_000,
  autoUpdate: true,
  verbose: true,
  enableAutoHealing: true,
};

/** Default weight for user-provided locators (above all auto strategies). */
const DEFAULT_USER_WEIGHT = 100;

/**
 * SmartLocator — Self-healing locator utility for Playwright.
 *
 * BEHAVIOR:
 * 1. User-provided locators (passed to register) are tried FIRST, in weight order.
 * 2. If ALL user locators fail, auto-extracted DOM fingerprints are tried as
 *    healing fallbacks (testId > role > label > placeholder > id > text > CSS > xpath).
 * 3. When healing succeeds, logs which strategy worked and optionally promotes it.
 *
 * USER-PROVIDED LOCATORS:
 *   Single locator (default weight):
 *     await smart.register('submit-btn', page.getByRole('button', { name: 'Submit' }));
 *
 *   Multiple weighted locators (highest weight tried first):
 *     await smart.register('submit-btn', [
 *       { locator: page.getByTestId('submit'), weight: 300 },
 *       { locator: page.getByRole('button', { name: 'Submit' }), weight: 200 },
 *       { locator: page.locator('#submit-btn'), weight: 100 },
 *     ]);
 *
 *   Disable auto-healing fallbacks (use only user locators):
 *     const smart = new SmartLocator(page, { enableAutoHealing: false });
 */
export class SmartLocator {
  private readonly page: Page;
  private readonly options: Required<SmartLocatorOptions>;
  private fingerprints: Map<string, ElementFingerprint> = new Map();
  /** Live Locator instances for user-provided strategies (not serializable) */
  private liveLocators: Map<string, Locator[]> = new Map();

  constructor(page: Page, options?: SmartLocatorOptions) {
    this.page = page;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadStore();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Register an element with one or more user-provided locators.
   * User locators are tried FIRST in weight order.
   * If autoHealing is enabled, also extracts auto-fallback strategies from the
   * primary (highest-weight) user locator's live element.
   *
   * @param name - Unique identifier for this element
   * @param locators - Single Locator OR array of weighted UserLocatorEntry
   */
  async register(
    name: string,
    locators: Locator | UserLocatorEntry | Array<UserLocatorEntry | Locator>,
  ): Promise<ElementFingerprint> {
    const entries = this.normalizeUserLocators(locators);

    if (entries.length === 0) {
      throw new Error(`[SmartLocator] register("${name}") requires at least one locator`);
    }

    // Sort user entries by weight (highest first)
    entries.sort((a, b) => (b.weight ?? DEFAULT_USER_WEIGHT) - (a.weight ?? DEFAULT_USER_WEIGHT));

    // Build user strategies (live Locators are kept in liveLocators map for direct use)
    const userStrategies: LocatorStrategy[] = entries.map((e, i) => ({
      type: 'custom',
      value: e.description || `user-locator-${i}`,
      weight: e.weight ?? DEFAULT_USER_WEIGHT,
      source: 'user',
    }));

    // Cache the live Locator instances for runtime use
    this.liveLocators.set(name, entries.map((e) => e.locator));

    // Optionally extract auto-healing strategies from the primary locator
    let autoStrategies: LocatorStrategy[] = [];
    if (this.options.enableAutoHealing) {
      try {
        const primary = entries[0].locator;
        await primary.waitFor({ state: 'attached', timeout: this.options.strategyTimeout });
        autoStrategies = await this.extractStrategies(primary);
      } catch (err) {
        if (this.options.verbose) {
          console.warn(
            `[SmartLocator] Could not extract auto-healing strategies for "${name}": ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }
    }

    const fingerprint: ElementFingerprint = {
      name,
      strategies: [...userStrategies, ...autoStrategies].sort((a, b) => b.weight - a.weight),
      updatedAt: Date.now(),
      pagePattern: this.page.url(),
    };

    this.fingerprints.set(name, fingerprint);
    this.saveStore();

    if (this.options.verbose) {
      console.log(
        `[SmartLocator] Registered "${name}": ${userStrategies.length} user locator(s), ${autoStrategies.length} auto fallback(s)`,
      );
    }

    return fingerprint;
  }

  /**
   * Find an element using stored strategies.
   * Tries user-provided locators first (in weight order), then auto-healing
   * fallbacks if all user locators fail.
   */
  async find(name: string): Promise<HealingResult> {
    const fingerprint = this.fingerprints.get(name);
    if (!fingerprint) {
      return {
        found: false,
        strategyIndex: -1,
        healed: false,
        triedStrategies: [],
        summary: `[SmartLocator] No fingerprint stored for "${name}". Call register() first.`,
      };
    }

    const triedStrategies: string[] = [];
    const userLocators = this.liveLocators.get(name) ?? [];
    let userLocatorIdx = 0;

    for (let i = 0; i < fingerprint.strategies.length; i++) {
      const strategy = fingerprint.strategies[i];
      const isUserStrategy = strategy.source === 'user';

      // Get the locator: user strategies use the live cached Locator; auto strategies are reconstructed
      let locator: Locator;
      if (isUserStrategy) {
        if (userLocatorIdx >= userLocators.length) {
          // User strategies in fingerprint exceed cached live locators (e.g. cross-run)
          // Skip — these can't be reconstructed without re-registration
          continue;
        }
        locator = userLocators[userLocatorIdx++];
      } else {
        locator = this.strategyToLocator(strategy);
      }

      triedStrategies.push(`${strategy.source}:${strategy.type}:${strategy.value}`);

      try {
        await locator.waitFor({ state: 'attached', timeout: this.options.strategyTimeout });
        const count = await locator.count();

        if (count >= 1) {
          // Healing means: a non-user strategy was used (user locators all failed)
          const healed = !isUserStrategy;
          const summary = healed
            ? `[SmartLocator] ⚠️ HEALED "${name}": all user locator(s) failed. Used auto fallback "${strategy.type}:${strategy.value}" (weight ${strategy.weight})`
            : `[SmartLocator] ✅ "${name}" found with user locator (weight ${strategy.weight})`;

          if (healed && this.options.verbose) {
            console.warn(summary);
          }

          // Auto-update: promote the working auto strategy when healing succeeded
          if (healed && this.options.autoUpdate) {
            this.promoteStrategy(fingerprint, i);
            this.saveStore();
          }

          return {
            found: true,
            locator,
            usedStrategy: strategy,
            strategyIndex: i,
            healed,
            triedStrategies,
            summary,
          };
        }
      } catch {
        // Strategy failed, try next
      }
    }

    return {
      found: false,
      strategyIndex: -1,
      healed: false,
      triedStrategies,
      summary: `[SmartLocator] ❌ "${name}" not found. Tried ${triedStrategies.length} strategies: ${triedStrategies.join(', ')}`,
    };
  }

  /**
   * Shorthand: find and return the Locator directly. Throws if not found.
   */
  async locate(name: string): Promise<Locator> {
    const result = await this.find(name);
    if (!result.found || !result.locator) {
      throw new Error(result.summary);
    }
    return result.locator;
  }

  /**
   * Re-register an element with new locators (refreshes both user and auto strategies).
   */
  async refresh(
    name: string,
    locators: Locator | UserLocatorEntry | Array<UserLocatorEntry | Locator>,
  ): Promise<ElementFingerprint> {
    return this.register(name, locators);
  }

  /**
   * Get the stored fingerprint for an element.
   */
  getFingerprint(name: string): ElementFingerprint | undefined {
    return this.fingerprints.get(name);
  }

  /**
   * List all registered element names.
   */
  listRegistered(): string[] {
    return Array.from(this.fingerprints.keys());
  }

  // ─── Internal: Normalize User Input ─────────────────────────────────────

  /**
   * Convert any of the accepted input shapes into a uniform UserLocatorEntry array.
   */
  private normalizeUserLocators(
    input: Locator | UserLocatorEntry | Array<UserLocatorEntry | Locator>,
  ): UserLocatorEntry[] {
    // Array input
    if (Array.isArray(input)) {
      return input.map((item) =>
        this.isLocator(item)
          ? { locator: item, weight: DEFAULT_USER_WEIGHT }
          : item,
      );
    }

    // Single Locator
    if (this.isLocator(input)) {
      return [{ locator: input, weight: DEFAULT_USER_WEIGHT }];
    }

    // Single UserLocatorEntry
    return [input];
  }

  /**
   * Type guard: is the value a Playwright Locator?
   */
  private isLocator(value: unknown): value is Locator {
    return (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as Locator).waitFor === 'function' &&
      typeof (value as Locator).click === 'function'
    );
  }

  // ─── Internal: Auto Strategy Extraction ─────────────────────────────────

  /**
   * Extract auto-healing fallback strategies from a live element.
   * Scans the element's DOM attributes to build alternative locators.
   * These are only used when ALL user-provided locators fail.
   */
  private async extractStrategies(locator: Locator): Promise<LocatorStrategy[]> {
    const strategies: LocatorStrategy[] = [];

    const attrs = await locator.evaluate((el) => {
      const htmlEl = el as HTMLElement;
      return {
        id: htmlEl.id || null,
        name: htmlEl.getAttribute('name'),
        role: htmlEl.getAttribute('role') || htmlEl.tagName.toLowerCase(),
        ariaLabel: htmlEl.getAttribute('aria-label'),
        placeholder: htmlEl.getAttribute('placeholder'),
        title: htmlEl.getAttribute('title'),
        alt: htmlEl.getAttribute('alt'),
        testId:
          htmlEl.getAttribute('data-testid') ||
          htmlEl.getAttribute('data-test-id') ||
          htmlEl.getAttribute('data-cy'),
        innerText: htmlEl.innerText?.trim().slice(0, 100) || null,
        tagName: htmlEl.tagName.toLowerCase(),
        cssPath: getCssPath(htmlEl),
        xpath: getXPath(htmlEl),
      };

      function getCssPath(el: Element): string {
        const parts: string[] = [];
        let current: Element | null = el;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.id) {
            selector = `#${current.id}`;
            parts.unshift(selector);
            break;
          }
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              (c) => c.tagName === current!.tagName,
            );
            if (siblings.length > 1) {
              const idx = siblings.indexOf(current) + 1;
              selector += `:nth-of-type(${idx})`;
            }
          }
          parts.unshift(selector);
          current = parent;
        }
        return parts.join(' > ');
      }

      function getXPath(el: Element): string {
        const parts: string[] = [];
        let current: Element | null = el;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let idx = 1;
          let sibling: Element | null = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) idx++;
            sibling = sibling.previousElementSibling;
          }
          const tag = current.tagName.toLowerCase();
          parts.unshift(`${tag}[${idx}]`);
          current = current.parentElement;
        }
        return '/' + parts.join('/');
      }
    });

    // Build auto strategies — weight 0-95 (always below user weight=100)
    if (attrs.testId) {
      strategies.push({ type: 'testId', value: attrs.testId, weight: 95, source: 'auto' });
    }
    if (attrs.ariaLabel) {
      strategies.push({
        type: 'role',
        value: attrs.role,
        options: { name: attrs.ariaLabel },
        weight: 90,
        source: 'auto',
      });
      strategies.push({ type: 'label', value: attrs.ariaLabel, weight: 88, source: 'auto' });
    }
    if (attrs.placeholder) {
      strategies.push({ type: 'placeholder', value: attrs.placeholder, weight: 85, source: 'auto' });
    }
    if (attrs.id && !this.looksAutoGenerated(attrs.id)) {
      strategies.push({ type: 'id', value: attrs.id, weight: 85, source: 'auto' });
    } else if (attrs.id) {
      strategies.push({ type: 'id', value: attrs.id, weight: 40, source: 'auto' });
    }
    if (attrs.title) {
      strategies.push({ type: 'title', value: attrs.title, weight: 80, source: 'auto' });
    }
    if (attrs.alt) {
      strategies.push({ type: 'altText', value: attrs.alt, weight: 80, source: 'auto' });
    }
    if (attrs.name) {
      strategies.push({ type: 'name', value: attrs.name, weight: 75, source: 'auto' });
    }
    if (attrs.innerText && attrs.innerText.length <= 50) {
      strategies.push({ type: 'text', value: attrs.innerText, weight: 70, source: 'auto' });
      const buttonRoles = ['button', 'link', 'a', 'menuitem', 'tab'];
      if (
        !attrs.ariaLabel &&
        (buttonRoles.includes(attrs.role) || buttonRoles.includes(attrs.tagName))
      ) {
        strategies.push({
          type: 'role',
          value: attrs.tagName === 'a' ? 'link' : attrs.role,
          options: { name: attrs.innerText },
          weight: 72,
          source: 'auto',
        });
      }
    }
    if (attrs.cssPath) {
      strategies.push({ type: 'css', value: attrs.cssPath, weight: 30, source: 'auto' });
    }
    if (attrs.xpath) {
      strategies.push({ type: 'xpath', value: attrs.xpath, weight: 20, source: 'auto' });
    }

    return strategies;
  }

  // ─── Internal: Strategy to Locator ──────────────────────────────────────

  private strategyToLocator(strategy: LocatorStrategy): Locator {
    switch (strategy.type) {
      case 'testId':
        return this.page.getByTestId(strategy.value);
      case 'role':
        return this.page.getByRole(strategy.value as any, strategy.options as any);
      case 'label':
        return this.page.getByLabel(strategy.value);
      case 'placeholder':
        return this.page.getByPlaceholder(strategy.value);
      case 'text':
        return this.page.getByText(strategy.value, { exact: true });
      case 'title':
        return this.page.getByTitle(strategy.value);
      case 'altText':
        return this.page.getByAltText(strategy.value);
      case 'id':
        return this.page.locator(`#${strategy.value}`);
      case 'name':
        return this.page.locator(`[name="${strategy.value}"]`);
      case 'css':
        return this.page.locator(strategy.value);
      case 'xpath':
        return this.page.locator(`xpath=${strategy.value}`);
      default:
        return this.page.locator(strategy.value);
    }
  }

  // ─── Internal: Persistence ──────────────────────────────────────────────

  private loadStore(): void {
    const storePath = path.join(this.options.storeDir, 'locators.json');
    if (!fs.existsSync(storePath)) return;

    try {
      const content = fs.readFileSync(storePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, ElementFingerprint>;
      this.fingerprints = new Map(Object.entries(data));
    } catch {
      this.fingerprints = new Map();
    }
  }

  private saveStore(): void {
    if (!fs.existsSync(this.options.storeDir)) {
      fs.mkdirSync(this.options.storeDir, { recursive: true });
    }
    const storePath = path.join(this.options.storeDir, 'locators.json');
    const data = Object.fromEntries(this.fingerprints);
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  }

  // ─── Internal: Helpers ──────────────────────────────────────────────────

  private promoteStrategy(fingerprint: ElementFingerprint, workingIndex: number): void {
    const working = fingerprint.strategies[workingIndex];
    working.weight = Math.min(99, working.weight + 5);
    fingerprint.strategies.sort((a, b) => b.weight - a.weight);
    fingerprint.updatedAt = Date.now();
  }

  private looksAutoGenerated(id: string): boolean {
    if (/[a-f0-9]{8,}/i.test(id)) return true;
    if (/[a-f0-9]{4}-[a-f0-9]{4}/i.test(id)) return true;
    if (/^(react|ng|ember|vue|svelte|radix|mui|chakra)[-_]?\d+/i.test(id)) return true;
    if (/[:_-]\w?\d{2,}$/.test(id)) return true;
    if (/^[a-z]{1,2}\d{3,}$/i.test(id)) return true;
    return false;
  }
}

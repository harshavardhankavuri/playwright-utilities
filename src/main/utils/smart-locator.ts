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
  type: 'role' | 'text' | 'label' | 'placeholder' | 'testId' | 'css' | 'xpath' | 'id' | 'name' | 'title' | 'altText';
  /** The selector/value for this strategy */
  value: string;
  /** Additional options (e.g. { exact: true } for text) */
  options?: Record<string, unknown>;
  /** Confidence score (0-1). Higher = more reliable/stable */
  confidence: number;
}

/**
 * A stored element fingerprint with multiple locator strategies.
 */
export interface ElementFingerprint {
  /** Unique name for this element (e.g. 'login-submit-button') */
  name: string;
  /** All known strategies to locate this element, ordered by confidence */
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
  /** Index of the strategy that worked (0 = primary) */
  strategyIndex: number;
  /** Whether healing was needed (primary failed) */
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
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART LOCATOR
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<SmartLocatorOptions> = {
  storeDir: path.resolve('.locators'),
  strategyTimeout: 3_000,
  autoUpdate: true,
  verbose: true,
};

/**
 * SmartLocator — Self-healing locator utility for Playwright.
 *
 * Records multiple locator strategies for each element. When the primary
 * locator breaks (element not found), automatically tries fallback strategies
 * to find the element. No AI — uses deterministic DOM attribute analysis.
 *
 * How it works:
 * 1. On first use, scans the element and records ALL possible locator strategies
 *    (role, text, label, testId, CSS, id, name, etc.)
 * 2. Ranks strategies by stability confidence (role > testId > text > CSS > xpath)
 * 3. On subsequent uses, tries the primary strategy first
 * 4. If primary fails, tries each fallback in confidence order
 * 5. When a fallback succeeds, logs the healing and optionally updates the store
 *
 * Usage:
 *   const smart = new SmartLocator(page);
 *
 *   // Register an element (scans and stores all strategies)
 *   await smart.register('submit-btn', page.getByRole('button', { name: 'Submit' }));
 *
 *   // Later, find with auto-healing
 *   const btn = await smart.find('submit-btn');
 *   await btn.click();
 *
 *   // Or use the locate() shorthand that returns a Locator directly
 *   await (await smart.locate('submit-btn')).click();
 */
export class SmartLocator {
  private readonly page: Page;
  private readonly options: Required<SmartLocatorOptions>;
  private fingerprints: Map<string, ElementFingerprint> = new Map();

  constructor(page: Page, options?: SmartLocatorOptions) {
    this.page = page;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadStore();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Register an element by scanning it and storing all possible locator strategies.
   * Call this when you know the element is present and correct.
   */
  async register(name: string, locator: Locator): Promise<ElementFingerprint> {
    // Ensure element exists
    await locator.waitFor({ state: 'attached', timeout: this.options.strategyTimeout });

    // Extract all possible strategies from the element
    const strategies = await this.extractStrategies(locator);

    const fingerprint: ElementFingerprint = {
      name,
      strategies: strategies.sort((a, b) => b.confidence - a.confidence),
      updatedAt: Date.now(),
      pagePattern: this.page.url(),
    };

    this.fingerprints.set(name, fingerprint);
    this.saveStore();

    if (this.options.verbose) {
      console.log(`[SmartLocator] Registered "${name}" with ${strategies.length} strategies`);
    }

    return fingerprint;
  }

  /**
   * Find an element using stored strategies with auto-healing.
   * Tries primary strategy first, falls back to alternatives if it fails.
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

    for (let i = 0; i < fingerprint.strategies.length; i++) {
      const strategy = fingerprint.strategies[i];
      const locator = this.strategyToLocator(strategy);
      triedStrategies.push(`${strategy.type}:${strategy.value}`);

      try {
        await locator.waitFor({ state: 'attached', timeout: this.options.strategyTimeout });
        const count = await locator.count();

        if (count === 1) {
          const healed = i > 0;
          const summary = healed
            ? `[SmartLocator] ⚠️ HEALED "${name}": primary "${fingerprint.strategies[0].type}:${fingerprint.strategies[0].value}" failed. Used fallback "${strategy.type}:${strategy.value}" (strategy #${i + 1})`
            : `[SmartLocator] ✅ "${name}" found with primary strategy`;

          if (healed && this.options.verbose) {
            console.warn(summary);
          }

          // Auto-update: promote the working strategy to higher confidence
          if (healed && this.options.autoUpdate) {
            this.promoteStrategy(fingerprint, i);
            this.saveStore();
          }

          return { found: true, locator, usedStrategy: strategy, strategyIndex: i, healed, triedStrategies, summary };
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
   * Re-scan an element and update its stored strategies.
   * Use after intentional UI changes to refresh the fingerprint.
   */
  async refresh(name: string, locator: Locator): Promise<ElementFingerprint> {
    return this.register(name, locator);
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

  // ─── Strategy Extraction ────────────────────────────────────────────────

  /**
   * Extract all possible locator strategies from a live element.
   * Scans the element's attributes, text, role, and position in the DOM.
   */
  private async extractStrategies(locator: Locator): Promise<LocatorStrategy[]> {
    const strategies: LocatorStrategy[] = [];

    const attrs = await locator.evaluate((el) => {
      const htmlEl = el as HTMLElement;
      return {
        id: htmlEl.id || null,
        name: htmlEl.getAttribute('name'),
        type: htmlEl.getAttribute('type'),
        role: htmlEl.getAttribute('role') || htmlEl.tagName.toLowerCase(),
        ariaLabel: htmlEl.getAttribute('aria-label'),
        ariaLabelledBy: htmlEl.getAttribute('aria-labelledby'),
        placeholder: htmlEl.getAttribute('placeholder'),
        title: htmlEl.getAttribute('title'),
        alt: htmlEl.getAttribute('alt'),
        testId: htmlEl.getAttribute('data-testid') || htmlEl.getAttribute('data-test-id') || htmlEl.getAttribute('data-cy'),
        text: htmlEl.textContent?.trim().slice(0, 100) || null,
        innerText: htmlEl.innerText?.trim().slice(0, 100) || null,
        tagName: htmlEl.tagName.toLowerCase(),
        className: htmlEl.className || null,
        href: htmlEl.getAttribute('href'),
        value: (htmlEl as HTMLInputElement).value || null,
        // Generate a CSS path
        cssPath: getCssPath(htmlEl),
        // Generate an XPath
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

    // Build strategies ordered by reliability

    // 1. data-testid (most stable — explicitly set for testing)
    if (attrs.testId) {
      strategies.push({ type: 'testId', value: attrs.testId, confidence: 0.95 });
    }

    // 2. Role + accessible name (semantic, resilient to DOM changes)
    if (attrs.ariaLabel) {
      strategies.push({
        type: 'role',
        value: attrs.role,
        options: { name: attrs.ariaLabel },
        confidence: 0.90,
      });
    }

    // 3. Label (for form inputs)
    if (attrs.ariaLabel) {
      strategies.push({ type: 'label', value: attrs.ariaLabel, confidence: 0.88 });
    }

    // 4. Placeholder
    if (attrs.placeholder) {
      strategies.push({ type: 'placeholder', value: attrs.placeholder, confidence: 0.85 });
    }

    // 5. ID (stable if not auto-generated)
    if (attrs.id && !this.looksAutoGenerated(attrs.id)) {
      strategies.push({ type: 'id', value: attrs.id, confidence: 0.85 });
    } else if (attrs.id) {
      strategies.push({ type: 'id', value: attrs.id, confidence: 0.40 });
    }

    // 6. Title attribute
    if (attrs.title) {
      strategies.push({ type: 'title', value: attrs.title, confidence: 0.80 });
    }

    // 7. Alt text (for images)
    if (attrs.alt) {
      strategies.push({ type: 'altText', value: attrs.alt, confidence: 0.80 });
    }

    // 8. Name attribute (for form elements)
    if (attrs.name) {
      strategies.push({ type: 'name', value: attrs.name, confidence: 0.75 });
    }

    // 9. Text content (visible text — can change with i18n)
    if (attrs.innerText && attrs.innerText.length <= 50) {
      strategies.push({ type: 'text', value: attrs.innerText, confidence: 0.70 });
    }

    // 10. Role + text (for buttons/links without aria-label)
    if (!attrs.ariaLabel && attrs.innerText && attrs.innerText.length <= 50) {
      const buttonRoles = ['button', 'link', 'a', 'menuitem', 'tab'];
      if (buttonRoles.includes(attrs.role) || buttonRoles.includes(attrs.tagName)) {
        strategies.push({
          type: 'role',
          value: attrs.tagName === 'a' ? 'link' : attrs.role,
          options: { name: attrs.innerText },
          confidence: 0.72,
        });
      }
    }

    // 11. CSS selector (fragile but always available)
    if (attrs.cssPath) {
      strategies.push({ type: 'css', value: attrs.cssPath, confidence: 0.30 });
    }

    // 12. XPath (most fragile — last resort)
    if (attrs.xpath) {
      strategies.push({ type: 'xpath', value: attrs.xpath, confidence: 0.20 });
    }

    return strategies;
  }

  // ─── Strategy to Locator Conversion ─────────────────────────────────────

  /**
   * Convert a stored strategy back into a Playwright Locator.
   */
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

  // ─── Store Persistence ──────────────────────────────────────────────────

  /**
   * Load stored fingerprints from disk.
   */
  private loadStore(): void {
    const storePath = path.join(this.options.storeDir, 'locators.json');
    if (!fs.existsSync(storePath)) return;

    try {
      const content = fs.readFileSync(storePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, ElementFingerprint>;
      this.fingerprints = new Map(Object.entries(data));
    } catch {
      // Corrupted store — start fresh
      this.fingerprints = new Map();
    }
  }

  /**
   * Save fingerprints to disk.
   */
  private saveStore(): void {
    if (!fs.existsSync(this.options.storeDir)) {
      fs.mkdirSync(this.options.storeDir, { recursive: true });
    }

    const storePath = path.join(this.options.storeDir, 'locators.json');
    const data = Object.fromEntries(this.fingerprints);
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Promote a working fallback strategy by boosting its confidence.
   * This makes the healed strategy more likely to be tried first next time.
   */
  private promoteStrategy(fingerprint: ElementFingerprint, workingIndex: number): void {
    const working = fingerprint.strategies[workingIndex];
    // Boost confidence of the working strategy slightly
    working.confidence = Math.min(1.0, working.confidence + 0.05);
    // Re-sort by confidence
    fingerprint.strategies.sort((a, b) => b.confidence - a.confidence);
    fingerprint.updatedAt = Date.now();
  }

  /**
   * Detect if an ID looks auto-generated (contains random hashes, UUIDs, etc.).
   * Auto-generated IDs are unreliable locators.
   */
  private looksAutoGenerated(id: string): boolean {
    // Contains long hex sequences (e.g. "el-a3f2b1c4")
    if (/[a-f0-9]{8,}/i.test(id)) return true;
    // Contains UUID-like patterns
    if (/[a-f0-9]{4}-[a-f0-9]{4}/i.test(id)) return true;
    // Starts with common framework prefixes + numbers (e.g. "react-123", "ng-45")
    if (/^(react|ng|ember|vue|svelte|radix|mui|chakra)[-_]?\d+/i.test(id)) return true;
    // Contains only numbers after a colon or dash (e.g. ":r1:", "el-42")
    if (/[:_-]\w?\d{2,}$/.test(id)) return true;
    // Very short random-looking IDs
    if (/^[a-z]{1,2}\d{3,}$/i.test(id)) return true;
    return false;
  }
}

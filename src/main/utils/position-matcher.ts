import { type Locator, type Page, expect as playwrightExpect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bounding box information for an element
 */
export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  centerX: number;
  centerY: number;
}

/**
 * Viewport dimensions
 */
export interface ViewportInfo {
  width: number;
  height: number;
}

/**
 * Relative position between two elements
 */
export type RelativePosition = 'above' | 'below' | 'left' | 'right' | 'overlapping' | 'none';

/**
 * Options for position matching
 */
export interface PositionMatchOptions {
  /**
   * Tolerance in pixels for position comparisons
   * Default: 0
   */
  tolerance?: number;
  
  /**
   * Wait for elements to be visible before checking
   * Default: true
   */
  waitForVisible?: boolean;
  
  /**
   * Timeout for waiting (in milliseconds)
   * Default: 5000
   */
  timeout?: number;
}

/**
 * Result of a position check
 */
export interface PositionMatchResult {
  /** Whether the position check passed */
  passed: boolean;
  /** Element bounds used in the check */
  elementBounds: ElementBounds;
  /** Reference element bounds (if applicable) */
  referenceBounds?: ElementBounds;
  /** Actual relationship found */
  actualRelation: string;
  /** Expected relationship */
  expectedRelation: string;
  /** Human-readable summary */
  summary: string;
  /** Additional details */
  details?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSITION MATCHER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PositionMatcher - Validate element positions, layouts, and spatial relationships.
 *
 * Features:
 * - Relative positioning (above, below, left, right)
 * - Overlap detection
 * - Z-index comparison
 * - Viewport position checks (left edge, right edge, top, bottom, center)
 * - Alignment checks (horizontally/vertically aligned)
 * - Distance measurements
 * - Visibility and containment checks
 *
 * Usage:
 *   const matcher = new PositionMatcher(page);
 *
 *   // Check if element is above another
 *   await matcher.expectAbove(header, mainContent);
 *
 *   // Check if element is at the left edge of viewport
 *   await matcher.expectAtLeftEdge(sidebar);
 *
 *   // Check z-index ordering
 *   await matcher.expectHigherZIndex(modal, backdrop);
 *
 *   // Check overlap
 *   await matcher.expectOverlapping(tooltip, button);
 *
 *   // Check alignment
 *   await matcher.expectHorizontallyAligned(button1, button2);
 */
export class PositionMatcher {
  constructor(private readonly page: Page) {}

  // ─── Relative Position Checks ────────────────────────────────────────────

  /**
   * Assert that element is above reference element.
   */
  async expectAbove(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const result = await this.checkRelativePosition(element, reference, 'above', options);
    if (!result.passed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Assert that element is below reference element.
   */
  async expectBelow(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const result = await this.checkRelativePosition(element, reference, 'below', options);
    if (!result.passed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Assert that element is to the left of reference element.
   */
  async expectLeftOf(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const result = await this.checkRelativePosition(element, reference, 'left', options);
    if (!result.passed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Assert that element is to the right of reference element.
   */
  async expectRightOf(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const result = await this.checkRelativePosition(element, reference, 'right', options);
    if (!result.passed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Assert that elements are overlapping.
   */
  async expectOverlapping(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const result = await this.checkRelativePosition(element, reference, 'overlapping', options);
    if (!result.passed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Assert that elements are NOT overlapping.
   */
  async expectNotOverlapping(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    const elementBounds = await this.getBounds(element, opts);
    const referenceBounds = await this.getBounds(reference, opts);

    const overlapping = this.doOverlap(elementBounds, referenceBounds);

    if (overlapping) {
      throw new Error(
        `❌ Expected elements NOT to overlap, but they do.\n` +
        `Element: (${elementBounds.left}, ${elementBounds.top}) to (${elementBounds.right}, ${elementBounds.bottom})\n` +
        `Reference: (${referenceBounds.left}, ${referenceBounds.top}) to (${referenceBounds.right}, ${referenceBounds.bottom})`,
      );
    }
  }

  // ─── Z-Index Checks ──────────────────────────────────────────────────────

  /**
   * Assert that element has higher z-index than reference element.
   */
  async expectHigherZIndex(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    
    if (opts.waitForVisible) {
      await element.waitFor({ state: 'visible', timeout: opts.timeout });
      await reference.waitFor({ state: 'visible', timeout: opts.timeout });
    }

    const elementZ = await this.getZIndex(element);
    const referenceZ = await this.getZIndex(reference);

    if (elementZ <= referenceZ) {
      throw new Error(
        `❌ Expected element z-index (${elementZ}) to be higher than reference (${referenceZ})`,
      );
    }
  }

  /**
   * Assert that element has lower z-index than reference element.
   */
  async expectLowerZIndex(
    element: Locator,
    reference: Locator,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    
    if (opts.waitForVisible) {
      await element.waitFor({ state: 'visible', timeout: opts.timeout });
      await reference.waitFor({ state: 'visible', timeout: opts.timeout });
    }

    const elementZ = await this.getZIndex(element);
    const referenceZ = await this.getZIndex(reference);

    if (elementZ >= referenceZ) {
      throw new Error(
        `❌ Expected element z-index (${elementZ}) to be lower than reference (${referenceZ})`,
      );
    }
  }

  // ─── Viewport Position Checks ────────────────────────────────────────────

  /**
   * Assert that element is at the left edge of the viewport.
   */
  async expectAtLeftEdge(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);

    if (Math.abs(bounds.left) > opts.tolerance) {
      throw new Error(
        `❌ Expected element at left edge (0px), but found at ${bounds.left}px ` +
        `(tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is at the right edge of the viewport.
   */
  async expectAtRightEdge(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);
    const viewport = await this.getViewportSize();

    const distanceFromEdge = Math.abs(bounds.right - viewport.width);
    if (distanceFromEdge > opts.tolerance) {
      throw new Error(
        `❌ Expected element at right edge (${viewport.width}px), ` +
        `but found at ${bounds.right}px (tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is at the top of the viewport.
   */
  async expectAtTop(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);

    if (Math.abs(bounds.top) > opts.tolerance) {
      throw new Error(
        `❌ Expected element at top (0px), but found at ${bounds.top}px ` +
        `(tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is at the bottom of the viewport.
   */
  async expectAtBottom(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);
    const viewport = await this.getViewportSize();

    const distanceFromBottom = Math.abs(bounds.bottom - viewport.height);
    if (distanceFromBottom > opts.tolerance) {
      throw new Error(
        `❌ Expected element at bottom (${viewport.height}px), ` +
        `but found at ${bounds.bottom}px (tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is centered horizontally in viewport.
   */
  async expectCenteredHorizontally(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);
    const viewport = await this.getViewportSize();

    const viewportCenter = viewport.width / 2;
    const elementCenter = bounds.centerX;
    const diff = Math.abs(viewportCenter - elementCenter);

    if (diff > opts.tolerance) {
      throw new Error(
        `❌ Expected element centered horizontally (${viewportCenter}px), ` +
        `but found at ${elementCenter}px (diff: ${diff}px, tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is centered vertically in viewport.
   */
  async expectCenteredVertically(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);
    const viewport = await this.getViewportSize();

    const viewportCenter = viewport.height / 2;
    const elementCenter = bounds.centerY;
    const diff = Math.abs(viewportCenter - elementCenter);

    if (diff > opts.tolerance) {
      throw new Error(
        `❌ Expected element centered vertically (${viewportCenter}px), ` +
        `but found at ${elementCenter}px (diff: ${diff}px, tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that element is within viewport (fully visible).
   */
  async expectInViewport(element: Locator, options?: PositionMatchOptions): Promise<void> {
    const opts = this.normalizeOptions(options);
    const bounds = await this.getBounds(element, opts);
    const viewport = await this.getViewportSize();

    const violations: string[] = [];

    if (bounds.left < 0) violations.push(`left edge outside (${bounds.left}px < 0)`);
    if (bounds.right > viewport.width) {
      violations.push(`right edge outside (${bounds.right}px > ${viewport.width}px)`);
    }
    if (bounds.top < 0) violations.push(`top edge outside (${bounds.top}px < 0)`);
    if (bounds.bottom > viewport.height) {
      violations.push(`bottom edge outside (${bounds.bottom}px > ${viewport.height}px)`);
    }

    if (violations.length > 0) {
      throw new Error(`❌ Element is not fully within viewport:\n  • ${violations.join('\n  • ')}`);
    }
  }

  // ─── Alignment Checks ────────────────────────────────────────────────────

  /**
   * Assert that elements are horizontally aligned (same vertical position).
   */
  async expectHorizontallyAligned(
    element: Locator,
    reference: Locator,
    alignment: 'top' | 'center' | 'bottom' = 'center',
    options?: PositionMatchOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    const elementBounds = await this.getBounds(element, opts);
    const referenceBounds = await this.getBounds(reference, opts);

    let elementY: number;
    let referenceY: number;

    switch (alignment) {
      case 'top':
        elementY = elementBounds.top;
        referenceY = referenceBounds.top;
        break;
      case 'bottom':
        elementY = elementBounds.bottom;
        referenceY = referenceBounds.bottom;
        break;
      case 'center':
      default:
        elementY = elementBounds.centerY;
        referenceY = referenceBounds.centerY;
        break;
    }

    const diff = Math.abs(elementY - referenceY);
    if (diff > opts.tolerance) {
      throw new Error(
        `❌ Expected elements horizontally aligned at ${alignment} ` +
        `(element: ${elementY}px, reference: ${referenceY}px, diff: ${diff}px, tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  /**
   * Assert that elements are vertically aligned (same horizontal position).
   */
  async expectVerticallyAligned(
    element: Locator,
    reference: Locator,
    alignment: 'left' | 'center' | 'right' = 'center',
    options?: PositionMatchOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    const elementBounds = await this.getBounds(element, opts);
    const referenceBounds = await this.getBounds(reference, opts);

    let elementX: number;
    let referenceX: number;

    switch (alignment) {
      case 'left':
        elementX = elementBounds.left;
        referenceX = referenceBounds.left;
        break;
      case 'right':
        elementX = elementBounds.right;
        referenceX = referenceBounds.right;
        break;
      case 'center':
      default:
        elementX = elementBounds.centerX;
        referenceX = referenceBounds.centerX;
        break;
    }

    const diff = Math.abs(elementX - referenceX);
    if (diff > opts.tolerance) {
      throw new Error(
        `❌ Expected elements vertically aligned at ${alignment} ` +
        `(element: ${elementX}px, reference: ${referenceX}px, diff: ${diff}px, tolerance: ${opts.tolerance}px)`,
      );
    }
  }

  // ─── Distance Checks ─────────────────────────────────────────────────────

  /**
   * Get the distance between two elements (center to center).
   */
  async getDistance(element: Locator, reference: Locator): Promise<number> {
    const elementBounds = await this.getBounds(element, { waitForVisible: true, timeout: 5000, tolerance: 0 });
    const referenceBounds = await this.getBounds(reference, { waitForVisible: true, timeout: 5000, tolerance: 0 });

    const dx = elementBounds.centerX - referenceBounds.centerX;
    const dy = elementBounds.centerY - referenceBounds.centerY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Assert minimum distance between elements.
   */
  async expectMinDistance(
    element: Locator,
    reference: Locator,
    minDistance: number,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const distance = await this.getDistance(element, reference);

    if (distance < minDistance) {
      throw new Error(
        `❌ Expected minimum distance of ${minDistance}px, but found ${distance.toFixed(2)}px`,
      );
    }
  }

  /**
   * Assert maximum distance between elements.
   */
  async expectMaxDistance(
    element: Locator,
    reference: Locator,
    maxDistance: number,
    options?: PositionMatchOptions,
  ): Promise<void> {
    const distance = await this.getDistance(element, reference);

    if (distance > maxDistance) {
      throw new Error(
        `❌ Expected maximum distance of ${maxDistance}px, but found ${distance.toFixed(2)}px`,
      );
    }
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────

  /**
   * Check relative position between two elements.
   */
  private async checkRelativePosition(
    element: Locator,
    reference: Locator,
    expected: RelativePosition,
    options?: PositionMatchOptions,
  ): Promise<PositionMatchResult> {
    const opts = this.normalizeOptions(options);
    const elementBounds = await this.getBounds(element, opts);
    const referenceBounds = await this.getBounds(reference, opts);

    const actual = this.determineRelativePosition(elementBounds, referenceBounds, opts.tolerance);
    const passed = actual === expected;

    const summary = passed
      ? `✅ Element is ${expected} reference element`
      : `❌ Expected element ${expected} reference, but it is ${actual}\n` +
        `Element: (${elementBounds.left}, ${elementBounds.top}) to (${elementBounds.right}, ${elementBounds.bottom})\n` +
        `Reference: (${referenceBounds.left}, ${referenceBounds.top}) to (${referenceBounds.right}, ${referenceBounds.bottom})`;

    return {
      passed,
      elementBounds,
      referenceBounds,
      actualRelation: actual,
      expectedRelation: expected,
      summary,
    };
  }

  /**
   * Determine relative position between two bounding boxes.
   */
  private determineRelativePosition(
    element: ElementBounds,
    reference: ElementBounds,
    tolerance: number,
  ): RelativePosition {
    // Check for overlap
    if (this.doOverlap(element, reference)) {
      return 'overlapping';
    }

    // Check vertical positioning (with tolerance)
    if (element.bottom <= reference.top + tolerance) {
      return 'above';
    }
    if (element.top >= reference.bottom - tolerance) {
      return 'below';
    }

    // Check horizontal positioning (with tolerance)
    if (element.right <= reference.left + tolerance) {
      return 'left';
    }
    if (element.left >= reference.right - tolerance) {
      return 'right';
    }

    return 'none';
  }

  /**
   * Check if two bounding boxes overlap.
   */
  private doOverlap(a: ElementBounds, b: ElementBounds): boolean {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }

  /**
   * Get element bounding box with calculated properties.
   */
  private async getBounds(locator: Locator, options: Required<PositionMatchOptions>): Promise<ElementBounds> {
    if (options.waitForVisible) {
      await locator.waitFor({ state: 'visible', timeout: options.timeout });
    }

    const box = await locator.boundingBox();
    if (!box) {
      throw new Error('Could not get bounding box for element (element may not be visible)');
    }

    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      top: box.y,
      right: box.x + box.width,
      bottom: box.y + box.height,
      left: box.x,
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
    };
  }

  /**
   * Get z-index of an element.
   */
  private async getZIndex(locator: Locator): Promise<number> {
    const zIndex = await locator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const z = style.zIndex;
      return z === 'auto' ? 0 : parseInt(z, 10) || 0;
    });
    return zIndex;
  }

  /**
   * Get viewport size.
   */
  private async getViewportSize(): Promise<ViewportInfo> {
    const viewport = this.page.viewportSize();
    if (!viewport) {
      throw new Error('Could not get viewport size');
    }
    return viewport;
  }

  /**
   * Normalize options with defaults.
   */
  private normalizeOptions(options?: PositionMatchOptions): Required<PositionMatchOptions> {
    return {
      tolerance: options?.tolerance ?? 0,
      waitForVisible: options?.waitForVisible ?? true,
      timeout: options?.timeout ?? 5000,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a position matcher instance (convenience function).
 */
export function createPositionMatcher(page: Page): PositionMatcher {
  return new PositionMatcher(page);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT CUSTOM MATCHER TYPES
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      /**
       * Assert that element is positioned above the reference element.
       * @example await expect(header).toBeAbove(mainContent);
       */
      toBeAbove(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is positioned below the reference element.
       * @example await expect(footer).toBeBelow(mainContent);
       */
      toBeBelow(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is positioned to the left of the reference element.
       * @example await expect(sidebar).toBeLeftOf(mainContent);
       */
      toBeLeftOf(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is positioned to the right of the reference element.
       * @example await expect(aside).toBeRightOf(mainContent);
       */
      toBeRightOf(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is overlapping with the reference element.
       * @example await expect(tooltip).toBeOverlapping(button);
       */
      toBeOverlapping(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element has higher z-index than reference element.
       * @example await expect(modal).toHaveHigherZIndex(backdrop);
       */
      toHaveHigherZIndex(reference: Locator, options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is at the left edge of the viewport.
       * @example await expect(sidebar).toBeAtLeftEdge({ tolerance: 10 });
       */
      toBeAtLeftEdge(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is at the right edge of the viewport.
       * @example await expect(scrollbar).toBeAtRightEdge();
       */
      toBeAtRightEdge(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is at the top of the viewport.
       * @example await expect(header).toBeAtTop();
       */
      toBeAtTop(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is at the bottom of the viewport.
       * @example await expect(footer).toBeAtBottom();
       */
      toBeAtBottom(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is centered horizontally in the viewport.
       * @example await expect(modal).toBeCenteredHorizontally();
       */
      toBeCenteredHorizontally(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is centered vertically in the viewport.
       * @example await expect(dialog).toBeCenteredVertically();
       */
      toBeCenteredVertically(options?: PositionMatchOptions): R;
      
      /**
       * Assert that element is fully within the viewport.
       * @example await expect(banner).toBeInViewport();
       */
      toBeInViewport(options?: PositionMatchOptions): R;
      
      /**
       * Assert that elements are horizontally aligned.
       * @example await expect(button1).toBeHorizontallyAlignedWith(button2, 'center');
       */
      toBeHorizontallyAlignedWith(
        reference: Locator,
        alignment?: 'top' | 'center' | 'bottom',
        options?: PositionMatchOptions
      ): R;
      
      /**
       * Assert that elements are vertically aligned.
       * @example await expect(card1).toBeVerticallyAlignedWith(card2, 'left');
       */
      toBeVerticallyAlignedWith(
        reference: Locator,
        alignment?: 'left' | 'center' | 'right',
        options?: PositionMatchOptions
      ): R;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT CUSTOM MATCHER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register position matchers with Playwright's expect.
 * Call this in your test setup file or it's auto-registered on import.
 */
export function registerPositionMatchers(page: Page): void {
  const createMatcher = (locator: Locator) => new PositionMatcher(page);

  playwrightExpect.extend({
    async toBeAbove(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectAbove(locator, reference, options);
        pass = true;
        message = `Expected element NOT to be above reference`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeAbove', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeBelow(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectBelow(locator, reference, options);
        pass = true;
        message = `Expected element NOT to be below reference`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeBelow', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeLeftOf(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectLeftOf(locator, reference, options);
        pass = true;
        message = `Expected element NOT to be left of reference`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeLeftOf', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeRightOf(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectRightOf(locator, reference, options);
        pass = true;
        message = `Expected element NOT to be right of reference`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeRightOf', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeOverlapping(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectOverlapping(locator, reference, options);
        pass = true;
        message = `Expected elements NOT to be overlapping`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeOverlapping', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toHaveHigherZIndex(locator: Locator, reference: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectHigherZIndex(locator, reference, options);
        pass = true;
        message = `Expected element NOT to have higher z-index than reference`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toHaveHigherZIndex', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeAtLeftEdge(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectAtLeftEdge(locator, options);
        pass = true;
        message = `Expected element NOT to be at left edge`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeAtLeftEdge', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeAtRightEdge(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectAtRightEdge(locator, options);
        pass = true;
        message = `Expected element NOT to be at right edge`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeAtRightEdge', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeAtTop(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectAtTop(locator, options);
        pass = true;
        message = `Expected element NOT to be at top`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeAtTop', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeAtBottom(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectAtBottom(locator, options);
        pass = true;
        message = `Expected element NOT to be at bottom`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeAtBottom', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeCenteredHorizontally(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectCenteredHorizontally(locator, options);
        pass = true;
        message = `Expected element NOT to be centered horizontally`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeCenteredHorizontally', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeCenteredVertically(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectCenteredVertically(locator, options);
        pass = true;
        message = `Expected element NOT to be centered vertically`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeCenteredVertically', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeInViewport(locator: Locator, options?: PositionMatchOptions) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectInViewport(locator, options);
        pass = true;
        message = `Expected element NOT to be in viewport`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeInViewport', 'locator', '', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeHorizontallyAlignedWith(
      locator: Locator,
      reference: Locator,
      alignment: 'top' | 'center' | 'bottom' = 'center',
      options?: PositionMatchOptions
    ) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectHorizontallyAligned(locator, reference, alignment, options);
        pass = true;
        message = `Expected elements NOT to be horizontally aligned at ${alignment}`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeHorizontallyAlignedWith', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },

    async toBeVerticallyAlignedWith(
      locator: Locator,
      reference: Locator,
      alignment: 'left' | 'center' | 'right' = 'center',
      options?: PositionMatchOptions
    ) {
      const matcher = createMatcher(locator);
      let pass = false;
      let message = '';

      try {
        await matcher.expectVerticallyAligned(locator, reference, alignment, options);
        pass = true;
        message = `Expected elements NOT to be vertically aligned at ${alignment}`;
      } catch (err: any) {
        pass = false;
        message = err.message;
      }

      return {
        pass,
        message: () => this.utils.matcherHint('toBeVerticallyAlignedWith', 'locator', 'reference', { isNot: this.isNot }) + '\n\n' + message,
      };
    },
  });
}

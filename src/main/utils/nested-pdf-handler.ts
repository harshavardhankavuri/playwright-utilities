import * as fs from 'fs';
import * as path from 'path';
import { type Page, type Locator, type FrameLocator } from '@playwright/test';
import { PdfComparator, type PdfMask, type PdfRegionMask, type PdfComparisonResult } from './pdf-comparator';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for navigating through nested iframes to reach the PDF embed.
 */
export interface IframeNavigationPath {
  /** Selector for the iframe at this level */
  selector: string;
  /** Optional: wait for this element to be visible before proceeding to next level */
  waitFor?: string;
  /** Optional: timeout for waiting (ms). Default: 10000 */
  timeout?: number;
}

/**
 * Options for the nested PDF handler.
 */
export interface NestedPdfHandlerOptions {
  /** Path through nested iframes to reach the PDF embed */
  iframePath: IframeNavigationPath[];
  /** Selector for the PDF embed element (within the innermost iframe) */
  embedSelector: string;
  /** Directory to save downloaded PDFs. Default: 'test-results/pdf-downloads' */
  downloadDir?: string;
  /** Directory to store baseline PDFs. Default: '__pdf-baselines__' */
  baselinesDir?: string;
  /** Timeout for PDF download operations (ms). Default: 30000 */
  downloadTimeout?: number;
  /** Masks to apply before comparison */
  masks?: PdfMask[];
  /** Region-based masks */
  regionMasks?: PdfRegionMask[];
}

/**
 * Options for visual icon detection and clicking.
 */
export interface VisualIconClickOptions {
  /** Path to the icon template image to search for */
  iconTemplatePath?: string;
  /** Base64-encoded icon template image */
  iconTemplateBase64?: string;
  /** Confidence threshold for template matching (0-1). Default: 0.8 */
  matchThreshold?: number;
  /** Search region within the embed (relative coordinates 0-1) */
  searchRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Offset from matched icon center to click (pixels). Default: {x: 0, y: 0} */
  clickOffset?: { x: number; y: number };
  /** Timeout for waiting after click (ms). Default: 2000 */
  waitAfterClick?: number;
}

/**
 * Result of visual icon detection.
 */
export interface IconMatchResult {
  /** Whether the icon was found */
  found: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Position of the matched icon (center point) */
  position?: { x: number; y: number };
  /** Bounding box of the matched region */
  boundingBox?: { x: number; y: number; width: number; height: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// NESTED PDF HANDLER
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  downloadDir: path.resolve('test-results', 'pdf-downloads'),
  baselinesDir: path.resolve('__pdf-baselines__'),
  downloadTimeout: 30_000,
  masks: [],
  regionMasks: [],
};

/**
 * NestedPdfHandler - Download and compare PDFs from deeply nested iframe structures.
 *
 * Features:
 * - Navigate through multiple nested iframes
 * - Multiple download strategies:
 *   1. Extract PDF URL from embed src attribute
 *   2. Intercept network response for PDF
 *   3. Visual icon detection and coordinate-based clicking
 *   4. Button/link clicking with download event handling
 * - Screen-size agnostic visual detection
 * - Integration with PdfComparator for baseline comparison
 *
 * Usage:
 *   const handler = new NestedPdfHandler({
 *     iframePath: [
 *       { selector: 'iframe#user-details', waitFor: '.user-info' },
 *       { selector: 'iframe.pdf-modal' },
 *     ],
 *     embedSelector: 'embed[type="application/pdf"]',
 *     masks: [PdfMasks.DATE_US, PdfMasks.TIME],
 *   });
 *
 *   // Download using embed src
 *   const buffer = await handler.downloadFromEmbedSrc(page, 'invoice-123');
 *
 *   // Download by clicking download icon visually
 *   const buffer = await handler.downloadViaVisualIconClick(page, 'invoice-123', {
 *     iconTemplatePath: './test-data/download-icon.png',
 *     matchThreshold: 0.85,
 *   });
 *
 *   // Compare with baseline
 *   const result = await handler.compareWithBaseline(page, 'invoice-123');
 */
export class NestedPdfHandler {
  private readonly options: Required<NestedPdfHandlerOptions>;
  private readonly pdfComparator: PdfComparator;

  constructor(options: NestedPdfHandlerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<NestedPdfHandlerOptions>;
    this.pdfComparator = new PdfComparator({
      downloadDir: this.options.downloadDir,
      baselinesDir: this.options.baselinesDir,
      masks: this.options.masks,
      regionMasks: this.options.regionMasks,
      responseTimeout: this.options.downloadTimeout,
    });
  }

  // ─── Public API: Navigation ─────────────────────────────────────────────

  /**
   * Navigate through nested iframes to reach the innermost frame containing the PDF embed.
   * Returns a FrameLocator for the final iframe.
   *
   * Usage:
   *   const frameLocator = await handler.navigateToNestedFrame(page);
   *   const embed = frameLocator.locator('embed[type="application/pdf"]');
   */
  async navigateToNestedFrame(page: Page): Promise<FrameLocator> {
    let currentFrame: FrameLocator | null = null;

    for (let i = 0; i < this.options.iframePath.length; i++) {
      const pathItem = this.options.iframePath[i];
      const timeout = pathItem.timeout || 10_000;

      // Navigate to the next iframe level
      if (currentFrame === null) {
        // First level: start from page
        currentFrame = page.frameLocator(pathItem.selector);
      } else {
        // Nested level: navigate from current frame
        currentFrame = currentFrame.frameLocator(pathItem.selector);
      }

      // Wait for a specific element if specified
      if (pathItem.waitFor) {
        await currentFrame.locator(pathItem.waitFor).waitFor({ state: 'visible', timeout });
      } else {
        // Wait for the iframe itself to be attached
        await page.waitForTimeout(500); // Small delay to ensure iframe is loaded
      }
    }

    if (!currentFrame) {
      throw new Error('No iframe path specified. At least one iframe must be in the path.');
    }

    return currentFrame;
  }

  /**
   * Get the embed locator within the nested iframe structure.
   */
  async getEmbedLocator(page: Page): Promise<Locator> {
    const frameLocator = await this.navigateToNestedFrame(page);
    return frameLocator.locator(this.options.embedSelector);
  }

  // ─── Public API: Download Methods ───────────────────────────────────────

  /**
   * Method 1: Download PDF by extracting the src attribute from the embed element.
   * This is the simplest and most reliable method when the PDF URL is directly accessible.
   *
   * Usage:
   *   const buffer = await handler.downloadFromEmbedSrc(page, 'invoice-123');
   */
  async downloadFromEmbedSrc(page: Page, name?: string): Promise<Buffer> {
    const embedLocator = await this.getEmbedLocator(page);

    // Wait for embed to be visible
    await embedLocator.waitFor({ state: 'visible', timeout: this.options.downloadTimeout });

    // Extract the PDF URL from the embed element
    const pdfUrl = await embedLocator.evaluate((el) => {
      const embed = el as HTMLEmbedElement;
      return embed.src || embed.getAttribute('src') || embed.getAttribute('data') || '';
    });

    if (!pdfUrl) {
      throw new Error(
        `Could not extract PDF URL from embed element. Ensure the element has a 'src' or 'data' attribute.`,
      );
    }

    // Download using page's request context (preserves auth/cookies)
    const absoluteUrl = new URL(pdfUrl, page.url()).href;
    const response = await page.request.get(absoluteUrl);

    if (!response.ok()) {
      throw new Error(`Failed to download PDF from ${absoluteUrl}: ${response.status()}`);
    }

    const buffer = Buffer.from(await response.body());

    // Save to download directory
    if (name) {
      this.saveToDownloadDir(buffer, name);
    }

    return buffer;
  }

  /**
   * Method 2: Download PDF by intercepting the network response.
   * Useful when the PDF is loaded dynamically or when you want to capture it without
   * extracting the URL.
   *
   * Usage:
   *   const buffer = await handler.downloadViaNetworkIntercept(page, 'invoice-123', {
   *     urlPattern: /\.pdf$/i,
   *     triggerAction: async () => {
   *       // Optional: perform action that triggers PDF load
   *       await page.click('button#load-pdf');
   *     },
   *   });
   */
  async downloadViaNetworkIntercept(
    page: Page,
    name?: string,
    options?: {
      /** URL pattern to match the PDF response */
      urlPattern?: string | RegExp;
      /** Content-Type pattern to match */
      contentType?: string | RegExp;
      /** Optional action to trigger PDF load (e.g., clicking a button) */
      triggerAction?: () => Promise<void>;
      /** Timeout for waiting for response */
      timeout?: number;
    },
  ): Promise<Buffer> {
    const urlPattern = options?.urlPattern || /\.pdf/i;
    const contentTypePattern = options?.contentType || /application\/pdf/i;
    const timeout = options?.timeout || this.options.downloadTimeout;

    // Set up response listener
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        const urlMatches =
          typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);

        const ctMatches =
          typeof contentTypePattern === 'string'
            ? contentType.includes(contentTypePattern)
            : contentTypePattern.test(contentType);

        return (urlMatches || ctMatches) && response.status() === 200;
      },
      { timeout },
    );

    // Trigger action if provided
    if (options?.triggerAction) {
      await options.triggerAction();
    }

    // Wait for the PDF response
    const response = await responsePromise;
    const buffer = Buffer.from(await response.body());

    // Save to download directory
    if (name) {
      this.saveToDownloadDir(buffer, name);
    }

    return buffer;
  }

  /**
   * Method 3: Download PDF by visually detecting a download icon and clicking it.
   * This method uses template matching to find the download button/icon within the PDF viewer,
   * making it screen-size agnostic.
   *
   * The icon template should be a small PNG image of the download icon you want to find.
   * You can capture it once from your PDF viewer and reuse it across different screen sizes.
   *
   * Usage:
   *   const buffer = await handler.downloadViaVisualIconClick(page, 'invoice-123', {
   *     iconTemplatePath: './test-data/download-icon.png',
   *     matchThreshold: 0.85,
   *     searchRegion: { x: 0.7, y: 0, width: 0.3, height: 0.2 }, // Top-right corner
   *   });
   */
  async downloadViaVisualIconClick(
    page: Page,
    name: string,
    options: VisualIconClickOptions,
  ): Promise<Buffer> {
    const embedLocator = await this.getEmbedLocator(page);

    // Wait for embed to be visible
    await embedLocator.waitFor({ state: 'visible', timeout: this.options.downloadTimeout });

    // Take a screenshot of the embed area
    const embedScreenshot = await embedLocator.screenshot();

    // Load the icon template
    let iconTemplate: Buffer;
    if (options.iconTemplatePath) {
      iconTemplate = fs.readFileSync(options.iconTemplatePath);
    } else if (options.iconTemplateBase64) {
      iconTemplate = Buffer.from(options.iconTemplateBase64, 'base64');
    } else {
      throw new Error('Either iconTemplatePath or iconTemplateBase64 must be provided');
    }

    // Find the icon in the screenshot
    const matchResult = await this.findIconInImage(
      embedScreenshot,
      iconTemplate,
      options.matchThreshold || 0.8,
      options.searchRegion,
    );

    if (!matchResult.found || !matchResult.position) {
      throw new Error(
        `Download icon not found in PDF viewer. Confidence: ${matchResult.confidence.toFixed(2)}. ` +
          `Try lowering matchThreshold or providing a better icon template.`,
      );
    }

    // Get the embed's bounding box to calculate absolute coordinates
    const embedBox = await embedLocator.boundingBox();
    if (!embedBox) {
      throw new Error('Could not get bounding box of embed element');
    }

    // Calculate absolute click coordinates
    const clickOffset = options.clickOffset || { x: 0, y: 0 };
    const absoluteX = embedBox.x + matchResult.position.x + clickOffset.x;
    const absoluteY = embedBox.y + matchResult.position.y + clickOffset.y;

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', {
      timeout: this.options.downloadTimeout,
    });

    // Click at the detected icon position
    await page.mouse.click(absoluteX, absoluteY);

    // Wait for download to complete
    const download = await downloadPromise;
    const downloadPath = path.join(
      this.options.downloadDir,
      `${this.sanitizeName(name)}.pdf`,
    );
    this.ensureDir(this.options.downloadDir);
    await download.saveAs(downloadPath);

    // Wait a bit after click if specified
    if (options.waitAfterClick) {
      await page.waitForTimeout(options.waitAfterClick);
    }

    // Read and return the buffer
    const buffer = fs.readFileSync(downloadPath);
    return buffer;
  }

  /**
   * Method 4: Download PDF by clicking a download button/link within the nested iframe.
   * This method locates a button or link by selector or text and clicks it to trigger download.
   *
   * Usage:
   *   const buffer = await handler.downloadViaButtonClick(page, 'invoice-123', {
   *     buttonSelector: 'button.download-pdf',
   *     // OR
   *     buttonText: 'Download',
   *   });
   */
  async downloadViaButtonClick(
    page: Page,
    name: string,
    options: {
      /** Selector for the download button (within the nested iframe) */
      buttonSelector?: string;
      /** Text content of the download button */
      buttonText?: string;
      /** Whether to search relative to the embed element. Default: true */
      relativeToEmbed?: boolean;
      /** Timeout for waiting for download */
      timeout?: number;
    },
  ): Promise<Buffer> {
    const timeout = options.timeout || this.options.downloadTimeout;
    let buttonLocator: Locator;

    if (options.relativeToEmbed !== false) {
      // Search within the nested iframe
      const frameLocator = await this.navigateToNestedFrame(page);

      if (options.buttonSelector) {
        buttonLocator = frameLocator.locator(options.buttonSelector);
      } else if (options.buttonText) {
        buttonLocator = frameLocator.getByText(options.buttonText, { exact: false });
      } else {
        throw new Error('Either buttonSelector or buttonText must be provided');
      }
    } else {
      // Search in the main page
      if (options.buttonSelector) {
        buttonLocator = page.locator(options.buttonSelector);
      } else if (options.buttonText) {
        buttonLocator = page.getByText(options.buttonText, { exact: false });
      } else {
        throw new Error('Either buttonSelector or buttonText must be provided');
      }
    }

    // Wait for button to be visible
    await buttonLocator.waitFor({ state: 'visible', timeout });

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout });

    // Click the button
    await buttonLocator.click();

    // Wait for download to complete
    const download = await downloadPromise;
    const downloadPath = path.join(
      this.options.downloadDir,
      `${this.sanitizeName(name)}.pdf`,
    );
    this.ensureDir(this.options.downloadDir);
    await download.saveAs(downloadPath);

    // Read and return the buffer
    const buffer = fs.readFileSync(downloadPath);
    return buffer;
  }

  // ─── Public API: Compare Methods ────────────────────────────────────────

  /**
   * Download PDF from embed src and compare with baseline.
   *
   * Usage:
   *   const result = await handler.compareFromEmbedSrc(page, 'invoice-123', {
   *     updateBaseline: false,
   *   });
   */
  async compareFromEmbedSrc(
    page: Page,
    name: string,
    options?: {
      masks?: PdfMask[];
      regionMasks?: PdfRegionMask[];
      updateBaseline?: boolean;
    },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadFromEmbedSrc(page, name);
    return this.pdfComparator.compareWithBaseline(buffer, name, options);
  }

  /**
   * Download PDF via network intercept and compare with baseline.
   */
  async compareViaNetworkIntercept(
    page: Page,
    name: string,
    options?: {
      urlPattern?: string | RegExp;
      contentType?: string | RegExp;
      triggerAction?: () => Promise<void>;
      timeout?: number;
      masks?: PdfMask[];
      regionMasks?: PdfRegionMask[];
      updateBaseline?: boolean;
    },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadViaNetworkIntercept(page, name, {
      urlPattern: options?.urlPattern,
      contentType: options?.contentType,
      triggerAction: options?.triggerAction,
      timeout: options?.timeout,
    });
    return this.pdfComparator.compareWithBaseline(buffer, name, {
      masks: options?.masks,
      regionMasks: options?.regionMasks,
      updateBaseline: options?.updateBaseline,
    });
  }

  /**
   * Download PDF via visual icon click and compare with baseline.
   */
  async compareViaVisualIconClick(
    page: Page,
    name: string,
    visualOptions: VisualIconClickOptions,
    compareOptions?: {
      masks?: PdfMask[];
      regionMasks?: PdfRegionMask[];
      updateBaseline?: boolean;
    },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadViaVisualIconClick(page, name, visualOptions);
    return this.pdfComparator.compareWithBaseline(buffer, name, compareOptions);
  }

  /**
   * Download PDF via button click and compare with baseline.
   */
  async compareViaButtonClick(
    page: Page,
    name: string,
    buttonOptions: {
      buttonSelector?: string;
      buttonText?: string;
      relativeToEmbed?: boolean;
      timeout?: number;
    },
    compareOptions?: {
      masks?: PdfMask[];
      regionMasks?: PdfRegionMask[];
      updateBaseline?: boolean;
    },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadViaButtonClick(page, name, buttonOptions);
    return this.pdfComparator.compareWithBaseline(buffer, name, compareOptions);
  }

  // ─── Public API: Baseline Management ────────────────────────────────────

  /**
   * Check if a baseline exists for the given name.
   */
  hasBaseline(name: string): boolean {
    return this.pdfComparator.hasBaseline(name);
  }

  /**
   * Remove a baseline.
   */
  removeBaseline(name: string): boolean {
    return this.pdfComparator.removeBaseline(name);
  }

  /**
   * Save a PDF buffer as a baseline.
   */
  saveBaseline(name: string, buffer: Buffer): string {
    return this.pdfComparator.saveBaseline(name, buffer);
  }

  // ─── Internal: Visual Detection ─────────────────────────────────────────

  /**
   * Find an icon template within a larger screenshot using template matching.
   * Uses a simple pixel-based correlation approach.
   *
   * For production use, consider integrating with OpenCV or a similar library
   * for more robust template matching.
   */
  private async findIconInImage(
    screenshot: Buffer,
    iconTemplate: Buffer,
    threshold: number,
    searchRegion?: { x: number; y: number; width: number; height: number },
  ): Promise<IconMatchResult> {
    // This is a simplified implementation. For production use, integrate with
    // a proper image processing library like sharp + template matching algorithm.
    //
    // Here's a basic approach using sharp for image processing:

    try {
      const sharp = await this.loadSharp();

      // Load images
      const screenshotImg = sharp(screenshot);
      const templateImg = sharp(iconTemplate);

      // Get metadata
      const screenshotMeta = await screenshotImg.metadata();
      const templateMeta = await templateImg.metadata();

      if (
        !screenshotMeta.width ||
        !screenshotMeta.height ||
        !templateMeta.width ||
        !templateMeta.height
      ) {
        throw new Error('Could not read image dimensions');
      }

      // Define search region
      let searchX = 0;
      let searchY = 0;
      let searchWidth = screenshotMeta.width;
      let searchHeight = screenshotMeta.height;

      if (searchRegion) {
        searchX = Math.floor(screenshotMeta.width * searchRegion.x);
        searchY = Math.floor(screenshotMeta.height * searchRegion.y);
        searchWidth = Math.floor(screenshotMeta.width * searchRegion.width);
        searchHeight = Math.floor(screenshotMeta.height * searchRegion.height);
      }

      // Extract search region from screenshot
      const searchImg = await screenshotImg
        .extract({
          left: searchX,
          top: searchY,
          width: searchWidth,
          height: searchHeight,
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const templateRaw = await templateImg.raw().toBuffer({ resolveWithObject: true });

      // Perform simple template matching (normalized cross-correlation)
      const matchResult = this.templateMatch(
        searchImg.data,
        searchImg.info.width,
        searchImg.info.height,
        searchImg.info.channels,
        templateRaw.data,
        templateMeta.width,
        templateMeta.height,
        templateRaw.info.channels,
        threshold,
      );

      if (matchResult.found && matchResult.position) {
        // Adjust position to account for search region offset
        matchResult.position.x += searchX;
        matchResult.position.y += searchY;

        if (matchResult.boundingBox) {
          matchResult.boundingBox.x += searchX;
          matchResult.boundingBox.y += searchY;
        }
      }

      return matchResult;
    } catch (error) {
      // Fallback: return not found
      console.warn('Visual icon detection failed:', error);
      return {
        found: false,
        confidence: 0,
      };
    }
  }

  /**
   * Simple template matching using normalized cross-correlation.
   * This is a basic implementation - for production, use OpenCV or similar.
   */
  private templateMatch(
    searchData: Buffer,
    searchWidth: number,
    searchHeight: number,
    searchChannels: number,
    templateData: Buffer,
    templateWidth: number,
    templateHeight: number,
    templateChannels: number,
    threshold: number,
  ): IconMatchResult {
    let maxCorrelation = 0;
    let maxX = 0;
    let maxY = 0;

    // Slide template over search image
    for (let y = 0; y <= searchHeight - templateHeight; y += 2) {
      // Step by 2 for performance
      for (let x = 0; x <= searchWidth - templateWidth; x += 2) {
        const correlation = this.calculateCorrelation(
          searchData,
          searchWidth,
          searchHeight,
          searchChannels,
          templateData,
          templateWidth,
          templateHeight,
          templateChannels,
          x,
          y,
        );

        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          maxX = x;
          maxY = y;
        }
      }
    }

    const found = maxCorrelation >= threshold;

    return {
      found,
      confidence: maxCorrelation,
      position: found
        ? {
            x: maxX + Math.floor(templateWidth / 2),
            y: maxY + Math.floor(templateHeight / 2),
          }
        : undefined,
      boundingBox: found
        ? {
            x: maxX,
            y: maxY,
            width: templateWidth,
            height: templateHeight,
          }
        : undefined,
    };
  }

  /**
   * Calculate normalized cross-correlation between template and a region in the search image.
   */
  private calculateCorrelation(
    searchData: Buffer,
    searchWidth: number,
    searchHeight: number,
    searchChannels: number,
    templateData: Buffer,
    templateWidth: number,
    templateHeight: number,
    templateChannels: number,
    offsetX: number,
    offsetY: number,
  ): number {
    let sum = 0;
    let searchSum = 0;
    let templateSum = 0;
    let count = 0;

    const channels = Math.min(searchChannels, templateChannels);

    for (let ty = 0; ty < templateHeight; ty++) {
      for (let tx = 0; tx < templateWidth; tx++) {
        const sx = offsetX + tx;
        const sy = offsetY + ty;

        if (sx >= searchWidth || sy >= searchHeight) continue;

        for (let c = 0; c < channels; c++) {
          const searchIdx = (sy * searchWidth + sx) * searchChannels + c;
          const templateIdx = (ty * templateWidth + tx) * templateChannels + c;

          const searchVal = searchData[searchIdx];
          const templateVal = templateData[templateIdx];

          sum += searchVal * templateVal;
          searchSum += searchVal * searchVal;
          templateSum += templateVal * templateVal;
          count++;
        }
      }
    }

    if (count === 0 || searchSum === 0 || templateSum === 0) return 0;

    // Normalized cross-correlation
    return sum / Math.sqrt(searchSum * templateSum);
  }

  /**
   * Load sharp library dynamically.
   */
  private async loadSharp(): Promise<any> {
    try {
      return require('sharp');
    } catch {
      throw new Error(
        'sharp library is required for visual icon detection. Install it with: npm install sharp',
      );
    }
  }

  // ─── Internal: Utilities ────────────────────────────────────────────────

  private saveToDownloadDir(buffer: Buffer, name: string): void {
    this.ensureDir(this.options.downloadDir);
    const filePath = path.join(this.options.downloadDir, `${this.sanitizeName(name)}.pdf`);
    fs.writeFileSync(filePath, buffer);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { type Page, type Locator } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A mask rule to ignore dynamic content during comparison.
 * Supports regex patterns, literal strings, line-based masks, and region masks.
 */
export interface PdfMask {
  /**
   * Regex pattern to match and replace with a placeholder.
   * E.g. /\d{2}\/\d{2}\/\d{4}/ to mask dates like 01/15/2025
   */
  pattern?: RegExp;
  /**
   * Literal string to replace.
   */
  literal?: string;
  /**
   * Replacement placeholder text. Default: '[MASKED]'
   */
  replacement?: string;
  /**
   * Description of what this mask covers (for reporting).
   */
  description?: string;
}

/**
 * A region-based mask that ignores content at a specific location in the PDF.
 * Specify page number and line range to mask entire lines or character ranges.
 */
export interface PdfRegionMask {
  /** Page number (1-indexed). Use 0 or undefined to apply to all pages. */
  page?: number;
  /** Start line (1-indexed, inclusive). */
  startLine: number;
  /** End line (1-indexed, inclusive). If omitted, masks only startLine. */
  endLine?: number;
  /** Start character position within the line (0-indexed). If omitted, masks entire line. */
  startChar?: number;
  /** End character position within the line (0-indexed, exclusive). If omitted, masks to end of line. */
  endChar?: number;
  /** Replacement placeholder text. Default: '[MASKED_REGION]' */
  replacement?: string;
  /** Description of what this region contains (for reporting). */
  description?: string;
}

/**
 * Common pre-built masks for typical dynamic content.
 */
export const PdfMasks = {
  /** Matches dates like 01/15/2025, 1/5/2025, 12-31-2024 */
  DATE_US: {
    pattern: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
    replacement: '[DATE]',
    description: 'US date format (MM/DD/YYYY)',
  },
  /** Matches dates like 2025-01-15 */
  DATE_ISO: {
    pattern: /\d{4}-\d{2}-\d{2}/g,
    replacement: '[DATE]',
    description: 'ISO date format (YYYY-MM-DD)',
  },
  /** Matches dates like 15 January 2025, Jan 15, 2025 */
  DATE_LONG: {
    pattern: /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{2,4}/gi,
    replacement: '[DATE]',
    description: 'Long date format (Month DD, YYYY)',
  },
  /** Matches time like 10:30:45, 2:15 PM, 14:30 */
  TIME: {
    pattern: /\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?/g,
    replacement: '[TIME]',
    description: 'Time format (HH:MM:SS AM/PM)',
  },
  /** Matches datetime like 2025-01-15T10:30:45Z */
  DATETIME_ISO: {
    pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    replacement: '[DATETIME]',
    description: 'ISO datetime format',
  },
  /** Matches UUIDs like 550e8400-e29b-41d4-a716-446655440000 */
  UUID: {
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    replacement: '[UUID]',
    description: 'UUID',
  },
  /** Matches email addresses */
  EMAIL: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
    description: 'Email address',
  },
  /** Matches phone numbers (various formats) */
  PHONE: {
    pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[PHONE]',
    description: 'Phone number',
  },
  /** Matches monetary amounts like $1,234.56 or €99.99 */
  CURRENCY: {
    pattern: /[$€£¥]\s?\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{2})?/g,
    replacement: '[AMOUNT]',
    description: 'Currency amount',
  },
  /** Matches page numbers like "Page 1 of 5", "Page 3" */
  PAGE_NUMBER: {
    pattern: /[Pp]age\s+\d+(?:\s+of\s+\d+)?/g,
    replacement: '[PAGE]',
    description: 'Page number',
  },
  /** Matches reference/invoice numbers (alphanumeric, 6+ chars) */
  REFERENCE_NUMBER: {
    pattern: /(?:REF|INV|ORD|TXN|ID)[#:\s-]*[A-Z0-9]{6,}/gi,
    replacement: '[REF]',
    description: 'Reference/Invoice number',
  },
} as const satisfies Record<string, PdfMask>;

/**
 * A single text difference found between PDFs.
 */
export interface PdfTextDiff {
  /** Page number where the diff was found (1-indexed) */
  page: number;
  /** Type of difference */
  type: 'added' | 'removed' | 'changed';
  /** The expected text (from baseline) */
  expected?: string;
  /** The actual text (from downloaded PDF) */
  actual?: string;
  /** Line number within the page text */
  line: number;
}

/**
 * Result of a PDF comparison.
 */
export interface PdfComparisonResult {
  /** Whether the PDFs match (after masking) */
  isMatch: boolean;
  /** Human-readable summary */
  summary: string;
  /** Number of pages in baseline */
  baselinePageCount: number;
  /** Number of pages in actual */
  actualPageCount: number;
  /** Whether page counts match */
  pageCountMatch: boolean;
  /** Text differences found (after masking) */
  diffs: PdfTextDiff[];
  /** Full masked text of baseline (for debugging) */
  baselineMaskedText?: string;
  /** Full masked text of actual (for debugging) */
  actualMaskedText?: string;
  /** Metadata comparison */
  metadata: {
    baselineInfo: Record<string, unknown>;
    actualInfo: Record<string, unknown>;
  };
}

/**
 * Options for the PDF comparator.
 */
export interface PdfComparatorOptions {
  /** Masks to apply before comparison */
  masks?: PdfMask[];
  /** Region-based masks to ignore content at specific locations */
  regionMasks?: PdfRegionMask[];
  /** Whether to include full masked text in the result (for debugging). Default: false */
  includeFullText?: boolean;
  /** Whether to trim whitespace and normalize spaces. Default: true */
  normalizeWhitespace?: boolean;
  /** Whether to ignore case differences. Default: false */
  ignoreCase?: boolean;
  /** Maximum number of diffs to report. Default: 50 */
  maxDiffs?: number;
  /** Directory to save downloaded PDFs. Default: 'test-results/pdf-downloads' */
  downloadDir?: string;
  /** Directory to store baseline PDFs. Default: '__pdf-baselines__' */
  baselinesDir?: string;
  /** Timeout for waiting for PDF response (ms). Default: 30000 */
  responseTimeout?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF COMPARATOR
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PDF_OPTIONS: Required<PdfComparatorOptions> = {
  masks: [],
  regionMasks: [],
  includeFullText: false,
  normalizeWhitespace: true,
  ignoreCase: false,
  maxDiffs: 50,
  downloadDir: path.resolve('test-results', 'pdf-downloads'),
  baselinesDir: path.resolve('__pdf-baselines__'),
  responseTimeout: 30_000,
};

/**
 * PdfComparator - Download PDFs from embedded elements and compare against baselines.
 *
 * Features:
 * - Download PDF from <embed>, <iframe>, or <object> elements
 * - Download PDF from direct URL
 * - Extract text content per page
 * - Apply masks to ignore dynamic content (dates, times, IDs, etc.)
 * - Line-by-line comparison with diff reporting
 * - Store and manage baseline PDFs
 *
 * Usage:
 *   const comparator = new PdfComparator({
 *     masks: [PdfMasks.DATE_US, PdfMasks.TIME, PdfMasks.UUID],
 *   });
 *
 *   // Download from embed element and compare
 *   const result = await comparator.compareFromEmbed(page, 'embed#pdf-viewer', 'invoice');
 *
 *   // Or compare two buffers directly
 *   const result = await comparator.compare(baselineBuffer, actualBuffer);
 */
export class PdfComparator {
  private readonly options: Required<PdfComparatorOptions>;

  constructor(options?: PdfComparatorOptions) {
    this.options = { ...DEFAULT_PDF_OPTIONS, ...options };
  }

  // ─── Public API: Download ───────────────────────────────────────────────

  /**
   * Download PDF from an <embed>, <iframe>, or <object> element on the page.
   * Extracts the `src` attribute and fetches the PDF.
   */
  async downloadFromEmbed(
    page: Page,
    selector: string | Locator,
    name?: string,
  ): Promise<Buffer> {
    const locator = typeof selector === 'string' ? page.locator(selector) : selector;

    // Get the PDF URL from the element's src/data attribute
    const pdfUrl = await locator.evaluate((el) => {
      const embed = el as HTMLEmbedElement | HTMLIFrameElement | HTMLObjectElement;
      return (embed as HTMLEmbedElement).src ||
             (embed as HTMLObjectElement).data ||
             embed.getAttribute('src') ||
             embed.getAttribute('data') ||
             '';
    });

    if (!pdfUrl) {
      throw new Error(
        `Could not extract PDF URL from element. Ensure the element has a 'src' or 'data' attribute.`,
      );
    }

    return this.downloadFromUrl(page, pdfUrl, name);
  }

  /**
   * Download PDF from a direct URL using the page's request context
   * (preserves cookies/auth).
   */
  async downloadFromUrl(page: Page, url: string, name?: string): Promise<Buffer> {
    // Resolve relative URLs
    const absoluteUrl = new URL(url, page.url()).href;

    // Use page's request context to preserve auth/cookies
    const response = await page.request.get(absoluteUrl);

    if (!response.ok()) {
      throw new Error(`Failed to download PDF from ${absoluteUrl}: ${response.status()}`);
    }

    const buffer = Buffer.from(await response.body());

    // Save to download dir
    if (name) {
      this.ensureDir(this.options.downloadDir);
      const filePath = path.join(this.options.downloadDir, `${this.sanitizeName(name)}.pdf`);
      fs.writeFileSync(filePath, buffer);
    }

    return buffer;
  }

  /**
   * Download PDF by intercepting a navigation/download triggered by a click.
   * Useful when the PDF is generated on-the-fly and served as a download.
   */
  async downloadFromClick(
    page: Page,
    clickTarget: string | Locator,
    name?: string,
  ): Promise<Buffer> {
    const locator = typeof clickTarget === 'string' ? page.locator(clickTarget) : clickTarget;

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      locator.click(),
    ]);

    const filePath = path.join(
      this.options.downloadDir,
      `${this.sanitizeName(name || 'download')}.pdf`,
    );
    this.ensureDir(this.options.downloadDir);
    await download.saveAs(filePath);

    return fs.readFileSync(filePath);
  }

  /**
   * Click a button (e.g. "Generate PDF"), wait for a network response whose URL
   * contains '.pdf' (or a custom pattern), then download the PDF from that response.
   *
   * This is ideal for server-generated PDFs where clicking a button triggers an
   * API call that returns the PDF.
   *
   * Usage:
   *   const buffer = await comparator.downloadFromResponse(
   *     page,
   *     'button#generate-pdf',
   *     { urlPattern: /\.pdf/i, name: 'invoice' }
   *   );
   *
   * @param page - Playwright Page
   * @param clickTarget - Selector or Locator for the button to click
   * @param options - Configuration for response matching
   */
  async downloadFromResponse(
    page: Page,
    clickTarget: string | Locator,
    options?: {
      /** URL pattern to match the PDF response. Default: /\.pdf/i */
      urlPattern?: string | RegExp;
      /** Content-Type to match. Default: matches 'application/pdf' */
      contentType?: string | RegExp;
      /** Timeout in ms to wait for the response. Default: from options.responseTimeout */
      timeout?: number;
      /** Name for saving the downloaded file */
      name?: string;
    },
  ): Promise<Buffer> {
    const locator = typeof clickTarget === 'string' ? page.locator(clickTarget) : clickTarget;
    const urlPattern = options?.urlPattern || /\.pdf/i;
    const contentTypePattern = options?.contentType || /application\/pdf/i;
    const timeout = options?.timeout || this.options.responseTimeout;

    // Set up response listener before clicking
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        const urlMatches = typeof urlPattern === 'string'
          ? url.includes(urlPattern)
          : urlPattern.test(url);

        const ctMatches = typeof contentTypePattern === 'string'
          ? contentType.includes(contentTypePattern)
          : contentTypePattern.test(contentType);

        return (urlMatches || ctMatches) && response.status() === 200;
      },
      { timeout },
    );

    // Click the button
    await locator.click();

    // Wait for the PDF response
    const response = await responsePromise;
    const buffer = Buffer.from(await response.body());

    // Save to download dir
    if (options?.name) {
      this.ensureDir(this.options.downloadDir);
      const filePath = path.join(
        this.options.downloadDir,
        `${this.sanitizeName(options.name)}.pdf`,
      );
      fs.writeFileSync(filePath, buffer);
    }

    return buffer;
  }

  /**
   * Click a button, wait for PDF response, download and compare against baseline.
   * Combines downloadFromResponse + compareWithBaseline in one call.
   *
   * Usage:
   *   const result = await comparator.compareFromResponse(
   *     page,
   *     'button#generate-pdf',
   *     'monthly-invoice',
   *     {
   *       masks: [PdfMasks.DATE_US, PdfMasks.TIME],
   *       regionMasks: [{ page: 1, startLine: 3, endLine: 5, description: 'Header timestamps' }],
   *     }
   *   );
   */
  async compareFromResponse(
    page: Page,
    clickTarget: string | Locator,
    name: string,
    options?: {
      urlPattern?: string | RegExp;
      contentType?: string | RegExp;
      timeout?: number;
      masks?: PdfMask[];
      regionMasks?: PdfRegionMask[];
      updateBaseline?: boolean;
    },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadFromResponse(page, clickTarget, {
      urlPattern: options?.urlPattern,
      contentType: options?.contentType,
      timeout: options?.timeout,
      name,
    });

    return this.compareWithBaseline(buffer, name, {
      masks: options?.masks,
      regionMasks: options?.regionMasks,
      updateBaseline: options?.updateBaseline,
    });
  }

  // ─── Public API: Compare ────────────────────────────────────────────────

  /**
   * Compare a downloaded PDF buffer against a stored baseline.
   * If no baseline exists, saves the actual as the first baseline.
   */
  async compareWithBaseline(
    actualBuffer: Buffer,
    name: string,
    options?: { masks?: PdfMask[]; regionMasks?: PdfRegionMask[]; updateBaseline?: boolean },
  ): Promise<PdfComparisonResult> {
    const safeName = this.sanitizeName(name);
    const baselinePath = path.join(this.options.baselinesDir, `${safeName}.pdf`);
    const shouldUpdate = options?.updateBaseline || process.env.UPDATE_PDF_BASELINES === 'true';

    // Update mode: save and return success
    if (shouldUpdate) {
      this.ensureDir(this.options.baselinesDir);
      fs.writeFileSync(baselinePath, actualBuffer);
      const parsed = await this.parsePdf(actualBuffer);
      return {
        isMatch: true,
        summary: `📄 Saved PDF baseline: ${baselinePath}`,
        baselinePageCount: parsed.pageCount,
        actualPageCount: parsed.pageCount,
        pageCountMatch: true,
        diffs: [],
        metadata: { baselineInfo: parsed.metadata, actualInfo: parsed.metadata },
      };
    }

    // No baseline exists: save first one
    if (!fs.existsSync(baselinePath)) {
      this.ensureDir(this.options.baselinesDir);
      fs.writeFileSync(baselinePath, actualBuffer);
      const parsed = await this.parsePdf(actualBuffer);
      return {
        isMatch: true,
        summary: `📄 No baseline found. Saved first baseline: ${baselinePath}`,
        baselinePageCount: parsed.pageCount,
        actualPageCount: parsed.pageCount,
        pageCountMatch: true,
        diffs: [],
        metadata: { baselineInfo: parsed.metadata, actualInfo: parsed.metadata },
      };
    }

    // Compare against baseline
    const baselineBuffer = fs.readFileSync(baselinePath);
    const masks = options?.masks || this.options.masks;
    const regionMasks = options?.regionMasks || this.options.regionMasks;
    return this.compare(baselineBuffer, actualBuffer, masks, regionMasks);
  }

  /**
   * Download from embed and compare against stored baseline in one call.
   */
  async compareFromEmbed(
    page: Page,
    selector: string | Locator,
    name: string,
    options?: { masks?: PdfMask[]; regionMasks?: PdfRegionMask[]; updateBaseline?: boolean },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadFromEmbed(page, selector, name);
    return this.compareWithBaseline(buffer, name, options);
  }

  /**
   * Download from URL and compare against stored baseline.
   */
  async compareFromUrl(
    page: Page,
    url: string,
    name: string,
    options?: { masks?: PdfMask[]; regionMasks?: PdfRegionMask[]; updateBaseline?: boolean },
  ): Promise<PdfComparisonResult> {
    const buffer = await this.downloadFromUrl(page, url, name);
    return this.compareWithBaseline(buffer, name, options);
  }

  /**
   * Compare two PDF buffers directly.
   */
  async compare(
    baselineBuffer: Buffer,
    actualBuffer: Buffer,
    masks?: PdfMask[],
    regionMasks?: PdfRegionMask[],
  ): Promise<PdfComparisonResult> {
    const effectiveMasks = masks || this.options.masks;
    const effectiveRegionMasks = regionMasks || this.options.regionMasks;

    const baseline = await this.parsePdf(baselineBuffer);
    const actual = await this.parsePdf(actualBuffer);

    const pageCountMatch = baseline.pageCount === actual.pageCount;

    // Apply text masks and normalize, then apply region masks per page
    const baselinePages = baseline.pages.map((text, i) => {
      let masked = this.applyMasks(text, effectiveMasks);
      masked = this.applyRegionMasks(masked, i + 1, effectiveRegionMasks);
      return masked;
    });
    const actualPages = actual.pages.map((text, i) => {
      let masked = this.applyMasks(text, effectiveMasks);
      masked = this.applyRegionMasks(masked, i + 1, effectiveRegionMasks);
      return masked;
    });

    // Compare page by page
    const diffs: PdfTextDiff[] = [];
    const maxPages = Math.max(baselinePages.length, actualPages.length);

    for (let i = 0; i < maxPages && diffs.length < this.options.maxDiffs; i++) {
      const baseText = baselinePages[i] || '';
      const actText = actualPages[i] || '';

      if (i >= baselinePages.length) {
        diffs.push({ page: i + 1, type: 'added', actual: actText, line: 1 });
        continue;
      }
      if (i >= actualPages.length) {
        diffs.push({ page: i + 1, type: 'removed', expected: baseText, line: 1 });
        continue;
      }

      // Line-by-line diff within the page
      const pageDiffs = this.diffPageText(baseText, actText, i + 1);
      diffs.push(...pageDiffs.slice(0, this.options.maxDiffs - diffs.length));
    }

    const isMatch = diffs.length === 0 && pageCountMatch;
    const summary = this.buildPdfSummary(isMatch, baseline, actual, diffs, pageCountMatch);

    const result: PdfComparisonResult = {
      isMatch,
      summary,
      baselinePageCount: baseline.pageCount,
      actualPageCount: actual.pageCount,
      pageCountMatch,
      diffs,
      metadata: {
        baselineInfo: baseline.metadata,
        actualInfo: actual.metadata,
      },
    };

    if (this.options.includeFullText) {
      result.baselineMaskedText = baselinePages.join('\n--- PAGE BREAK ---\n');
      result.actualMaskedText = actualPages.join('\n--- PAGE BREAK ---\n');
    }

    return result;
  }

  // ─── Public API: Baseline Management ────────────────────────────────────

  /**
   * Save a PDF buffer as a baseline.
   */
  saveBaseline(name: string, buffer: Buffer): string {
    const safeName = this.sanitizeName(name);
    const filePath = path.join(this.options.baselinesDir, `${safeName}.pdf`);
    this.ensureDir(this.options.baselinesDir);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * Check if a baseline exists for the given name.
   */
  hasBaseline(name: string): boolean {
    const safeName = this.sanitizeName(name);
    return fs.existsSync(path.join(this.options.baselinesDir, `${safeName}.pdf`));
  }

  /**
   * Remove a baseline.
   */
  removeBaseline(name: string): boolean {
    const safeName = this.sanitizeName(name);
    const filePath = path.join(this.options.baselinesDir, `${safeName}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Extract and return the masked text from a PDF buffer (useful for debugging).
   */
  async extractMaskedText(buffer: Buffer, masks?: PdfMask[]): Promise<string[]> {
    const parsed = await this.parsePdf(buffer);
    const effectiveMasks = masks || this.options.masks;
    return parsed.pages.map((text) => this.applyMasks(text, effectiveMasks));
  }

  // ─── Internal: PDF Parsing ──────────────────────────────────────────────

  private async parsePdf(buffer: Buffer): Promise<{
    pageCount: number;
    pages: string[];
    fullText: string;
    metadata: Record<string, unknown>;
  }> {
    // pdf-parse v2 is ESM, use dynamic import
    const pdfParse = await this.loadPdfParse();
    const result = await pdfParse(buffer);

    // pdf-parse returns text per page separated by form-feed or we split by page
    const pages = this.splitIntoPages(result.text, result.numpages);

    return {
      pageCount: result.numpages,
      pages,
      fullText: result.text,
      metadata: result.info || {},
    };
  }

  private async loadPdfParse(): Promise<(buffer: Buffer) => Promise<any>> {
    try {
      // Try CommonJS require first (pdf-parse v1.x)
      const pdfParse = require('pdf-parse');
      return pdfParse;
    } catch {
      // Fallback to dynamic import (pdf-parse v2.x ESM)
      const mod = await (eval('import("pdf-parse")') as Promise<any>);
      return mod.default || mod;
    }
  }

  /**
   * Split full text into pages. pdf-parse uses form-feed (\f) as page separator
   * in some versions, or we approximate by dividing evenly.
   */
  private splitIntoPages(fullText: string, pageCount: number): string[] {
    // Try form-feed split first
    const ffPages = fullText.split('\f');
    if (ffPages.length === pageCount) {
      return ffPages.map((p) => p.trim());
    }

    // If form-feed doesn't work, try double-newline heuristic
    if (pageCount === 1) {
      return [fullText.trim()];
    }

    // Fallback: return full text as single "page" array
    return ffPages.length > 1
      ? ffPages.map((p) => p.trim()).filter((p) => p.length > 0)
      : [fullText.trim()];
  }

  // ─── Internal: Masking ──────────────────────────────────────────────────

  /**
   * Apply all mask rules to a text string.
   */
  private applyMasks(text: string, masks: PdfMask[]): string {
    let result = text;

    // Normalize whitespace first if configured
    if (this.options.normalizeWhitespace) {
      result = result.replace(/[ \t]+/g, ' ');
      result = result.replace(/\r\n/g, '\n');
      result = result.replace(/\n{3,}/g, '\n\n');
      result = result.split('\n').map((line) => line.trim()).join('\n');
    }

    // Apply each mask
    for (const mask of masks) {
      const replacement = mask.replacement || '[MASKED]';

      if (mask.pattern) {
        // Clone regex to ensure global flag and reset lastIndex
        const flags = mask.pattern.flags.includes('g')
          ? mask.pattern.flags
          : mask.pattern.flags + 'g';
        const regex = new RegExp(mask.pattern.source, flags);
        result = result.replace(regex, replacement);
      }

      if (mask.literal) {
        // Replace all occurrences of the literal string
        result = result.split(mask.literal).join(replacement);
      }
    }

    // Apply case normalization if configured
    if (this.options.ignoreCase) {
      result = result.toLowerCase();
    }

    return result.trim();
  }

  // ─── Internal: Diffing ──────────────────────────────────────────────────

  /**
   * Apply region-based masks to a page's text.
   * Replaces specified line ranges (or character ranges within lines) with placeholders.
   */
  private applyRegionMasks(
    pageText: string,
    pageNumber: number,
    regionMasks: PdfRegionMask[],
  ): string {
    if (regionMasks.length === 0) return pageText;

    const lines = pageText.split('\n');

    for (const region of regionMasks) {
      // Check if this mask applies to this page
      if (region.page && region.page !== pageNumber) continue;

      const startLine = region.startLine - 1; // Convert to 0-indexed
      const endLine = (region.endLine || region.startLine) - 1;
      const replacement = region.replacement || '[MASKED_REGION]';

      for (let i = startLine; i <= endLine && i < lines.length; i++) {
        if (i < 0) continue;

        if (region.startChar !== undefined) {
          // Mask a character range within the line
          const line = lines[i];
          const start = region.startChar;
          const end = region.endChar !== undefined ? region.endChar : line.length;
          lines[i] = line.slice(0, start) + replacement + line.slice(end);
        } else {
          // Mask the entire line
          lines[i] = replacement;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Line-by-line diff between two page texts.
   */
  private diffPageText(baseText: string, actText: string, pageNum: number): PdfTextDiff[] {
    const baseLines = baseText.split('\n');
    const actLines = actText.split('\n');
    const diffs: PdfTextDiff[] = [];

    const maxLines = Math.max(baseLines.length, actLines.length);

    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i];
      const actLine = actLines[i];

      if (baseLine === undefined && actLine !== undefined) {
        diffs.push({
          page: pageNum,
          type: 'added',
          actual: actLine,
          line: i + 1,
        });
      } else if (actLine === undefined && baseLine !== undefined) {
        diffs.push({
          page: pageNum,
          type: 'removed',
          expected: baseLine,
          line: i + 1,
        });
      } else if (baseLine !== actLine) {
        diffs.push({
          page: pageNum,
          type: 'changed',
          expected: baseLine,
          actual: actLine,
          line: i + 1,
        });
      }
    }

    return diffs;
  }

  // ─── Internal: Summary ──────────────────────────────────────────────────

  private buildPdfSummary(
    isMatch: boolean,
    baseline: { pageCount: number },
    actual: { pageCount: number },
    diffs: PdfTextDiff[],
    pageCountMatch: boolean,
  ): string {
    const lines: string[] = [];

    if (isMatch) {
      lines.push('✅ PASS: PDF content matches baseline (after masking).');
      lines.push(`   Pages: ${actual.pageCount}`);
    } else {
      lines.push('❌ FAIL: PDF content differs from baseline.');

      if (!pageCountMatch) {
        lines.push(`   ⚠️  Page count mismatch: baseline=${baseline.pageCount}, actual=${actual.pageCount}`);
      }

      lines.push(`   Differences found: ${diffs.length}`);
      lines.push('');

      // Group diffs by page
      const byPage = new Map<number, PdfTextDiff[]>();
      for (const d of diffs) {
        if (!byPage.has(d.page)) byPage.set(d.page, []);
        byPage.get(d.page)!.push(d);
      }

      for (const [page, pageDiffs] of byPage) {
        lines.push(`   Page ${page}: ${pageDiffs.length} difference(s)`);
        for (const d of pageDiffs.slice(0, 5)) {
          switch (d.type) {
            case 'added':
              lines.push(`     + Line ${d.line}: "${this.truncate(d.actual!, 80)}"`);
              break;
            case 'removed':
              lines.push(`     - Line ${d.line}: "${this.truncate(d.expected!, 80)}"`);
              break;
            case 'changed':
              lines.push(`     ~ Line ${d.line}:`);
              lines.push(`       Expected: "${this.truncate(d.expected!, 70)}"`);
              lines.push(`       Actual:   "${this.truncate(d.actual!, 70)}"`);
              break;
          }
        }
        if (pageDiffs.length > 5) {
          lines.push(`     ... and ${pageDiffs.length - 5} more`);
        }
      }

      if (this.options.masks.length > 0) {
        lines.push('');
        lines.push(`   Applied masks: ${this.options.masks.map((m) => m.description || 'custom').join(', ')}`);
      }

      lines.push('');
      lines.push('   💡 If dynamic content is causing failures, add masks for those patterns.');
      lines.push('   💡 To update baseline: set UPDATE_PDF_BASELINES=true');
    }

    return lines.join('\n');
  }

  // ─── Internal: Helpers ──────────────────────────────────────────────────

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  }
}

# PDF Comparator

**File:** `src/main/utils/pdf-comparator.ts`

## Overview

PdfComparator downloads PDFs from various sources (embedded elements, URLs, click-triggered downloads, API responses) and compares their text content against stored baselines. It supports regex-based and region-based masking to ignore dynamic content like dates, IDs, and timestamps. Uses `pdf-parse` for text extraction — no visual/pixel comparison, purely text-based.

## How It Works

1. **Download** — Fetches the PDF buffer from an embed element's `src`, a direct URL, a download event, or an API response triggered by a click.
2. **Parse** — Extracts text content per page using `pdf-parse`.
3. **Mask** — Applies regex masks (dates, UUIDs, etc.) and region masks (specific line/character ranges) to both baseline and actual text.
4. **Normalize** — Optionally trims whitespace, normalizes spaces, and lowercases.
5. **Diff** — Performs line-by-line comparison per page, reporting added/removed/changed lines.
6. **Baseline management** — First run saves the baseline automatically. Subsequent runs compare against it.

## Configuration

```typescript
const comparator = new PdfComparator({
  masks: [PdfMasks.DATE_US, PdfMasks.TIME, PdfMasks.UUID],
  regionMasks: [
    { page: 1, startLine: 1, endLine: 3, description: 'Header with timestamp' },
  ],
  includeFullText: false,       // Include full masked text in result (debugging)
  normalizeWhitespace: true,    // Trim and normalize spaces
  ignoreCase: false,            // Case-insensitive comparison
  maxDiffs: 50,                 // Max diffs to report
  downloadDir: 'test-results/pdf-downloads',
  baselinesDir: '__pdf-baselines__',
  responseTimeout: 30_000,      // Timeout waiting for PDF response
});
```

### Pre-built masks

| Mask | Pattern | Replacement |
|------|---------|-------------|
| `PdfMasks.DATE_US` | `01/15/2025`, `1-5-2025` | `[DATE]` |
| `PdfMasks.DATE_ISO` | `2025-01-15` | `[DATE]` |
| `PdfMasks.DATE_LONG` | `January 15, 2025` | `[DATE]` |
| `PdfMasks.TIME` | `10:30:45 PM` | `[TIME]` |
| `PdfMasks.DATETIME_ISO` | `2025-01-15T10:30:45Z` | `[DATETIME]` |
| `PdfMasks.UUID` | `550e8400-e29b-...` | `[UUID]` |
| `PdfMasks.EMAIL` | `user@example.com` | `[EMAIL]` |
| `PdfMasks.PHONE` | `(555) 234-8901` | `[PHONE]` |
| `PdfMasks.CURRENCY` | `$1,234.56` | `[AMOUNT]` |
| `PdfMasks.PAGE_NUMBER` | `Page 1 of 5` | `[PAGE]` |
| `PdfMasks.REFERENCE_NUMBER` | `REF-ABC123456` | `[REF]` |

## Usage Examples

### Download from embed and compare

```typescript
const comparator = new PdfComparator({
  masks: [PdfMasks.DATE_US, PdfMasks.TIME],
});

const result = await comparator.compareFromEmbed(page, 'embed#pdf-viewer', 'invoice');
expect(result.isMatch).toBe(true);
```

### Download from URL

```typescript
const result = await comparator.compareFromUrl(
  page,
  '/api/reports/monthly.pdf',
  'monthly-report',
);
```

### Download from click (file download)

```typescript
const buffer = await comparator.downloadFromClick(page, 'button#export-pdf', 'export');
const result = await comparator.compareWithBaseline(buffer, 'export');
```

### Download from API response triggered by click

```typescript
const result = await comparator.compareFromResponse(
  page,
  'button#generate-invoice',
  'monthly-invoice',
  {
    urlPattern: /\.pdf/i,
    masks: [PdfMasks.DATE_US, PdfMasks.CURRENCY],
    regionMasks: [{ page: 1, startLine: 5, endLine: 7, description: 'Dynamic totals' }],
  },
);
expect(result.isMatch).toBe(true);
```

### Region masks (ignore specific lines)

```typescript
const comparator = new PdfComparator({
  regionMasks: [
    { page: 1, startLine: 1, endLine: 2, description: 'Generated timestamp header' },
    { page: 0, startLine: 50, endLine: 50, startChar: 10, endChar: 30, description: 'Ref number' },
  ],
});
```

### Update baselines

```bash
UPDATE_PDF_BASELINES=true npx playwright test
```

## Tips & Best Practices

- Start with pre-built masks (`PdfMasks.DATE_US`, `PdfMasks.UUID`, etc.) and add custom regex masks only for app-specific dynamic content.
- Use region masks for content that's structurally dynamic (e.g. a "generated at" line that changes format).
- Set `includeFullText: true` temporarily when debugging comparison failures — it shows the full masked text in the result.
- Store `__pdf-baselines__/` in version control so the team shares baselines.
- The comparator preserves page cookies/auth when downloading, so it works with authenticated PDF endpoints.

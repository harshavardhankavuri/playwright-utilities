import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Table/Grid Helpers — Utilities for interacting with and asserting on
 * HTML tables, data grids (AG Grid, Material Table, etc.), and list views.
 *
 * Covers:
 * - Reading table data into structured objects
 * - Sorting, filtering, and pagination assertions
 * - Row/cell selection and interaction
 * - Column header operations
 * - Search within tables
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A parsed table row as a key-value map (header → cell value).
 */
export type TableRow = Record<string, string>;

/**
 * Configuration for locating table elements.
 * Supports standard HTML tables and custom grid components.
 */
export interface TableConfig {
  /** Root selector for the table/grid container */
  rootSelector: string;
  /** Selector for header cells (relative to root). Default: 'thead th, [role="columnheader"]' */
  headerSelector?: string;
  /** Selector for body rows (relative to root). Default: 'tbody tr, [role="row"]' */
  rowSelector?: string;
  /** Selector for cells within a row (relative to row). Default: 'td, [role="gridcell"], [role="cell"]' */
  cellSelector?: string;
  /** Whether the first row in rowSelector is actually a header row. Default: false */
  firstRowIsHeader?: boolean;
}

/**
 * Sort direction for column sorting assertions.
 */
export type SortDirection = 'asc' | 'desc' | 'none';

const DEFAULT_TABLE_CONFIG: Required<TableConfig> = {
  rootSelector: 'table',
  headerSelector: 'thead th, thead td, [role="columnheader"]',
  rowSelector: 'tbody tr, [role="row"]:not(:first-child)',
  cellSelector: 'td, [role="gridcell"], [role="cell"]',
  firstRowIsHeader: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// TABLE HELPER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TableHelper — Interact with and assert on tables/grids in Playwright tests.
 *
 * Usage:
 *   const table = new TableHelper(page, { rootSelector: '#users-table' });
 *
 *   // Read all data
 *   const rows = await table.getAllRows();
 *   expect(rows[0]['Name']).toBe('Alice');
 *
 *   // Assert row count
 *   await table.expectRowCount(10);
 *
 *   // Find a row by column value
 *   const row = await table.findRow('Email', 'alice@test.com');
 *   expect(row?.['Status']).toBe('Active');
 *
 *   // Sort and verify
 *   await table.clickHeader('Name');
 *   await table.expectColumnSorted('Name', 'asc');
 */
export class TableHelper {
  private readonly page: Page;
  private readonly config: Required<TableConfig>;
  private readonly root: Locator;

  constructor(page: Page, config?: TableConfig) {
    this.page = page;
    this.config = { ...DEFAULT_TABLE_CONFIG, ...config };
    this.root = page.locator(this.config.rootSelector);
  }

  // ─── Data Reading ───────────────────────────────────────────────────────

  /**
   * Get all column headers as an array of strings.
   */
  async getHeaders(): Promise<string[]> {
    const headers = this.root.locator(this.config.headerSelector);
    const count = await headers.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      result.push(text?.trim() || `Column ${i}`);
    }
    return result;
  }

  /**
   * Get all visible rows as an array of key-value objects.
   * Keys are the column headers, values are the cell text content.
   */
  async getAllRows(): Promise<TableRow[]> {
    const headers = await this.getHeaders();
    const rows = this.root.locator(this.config.rowSelector);
    const rowCount = await rows.count();
    const result: TableRow[] = [];

    const startIdx = this.config.firstRowIsHeader ? 1 : 0;

    for (let i = startIdx; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator(this.config.cellSelector);
      const cellCount = await cells.count();
      const rowData: TableRow = {};

      for (let j = 0; j < Math.min(cellCount, headers.length); j++) {
        const text = await cells.nth(j).textContent();
        rowData[headers[j]] = text?.trim() || '';
      }

      result.push(rowData);
    }

    return result;
  }

  /**
   * Get a specific row by index (0-based).
   */
  async getRow(index: number): Promise<TableRow> {
    const rows = await this.getAllRows();
    if (index < 0 || index >= rows.length) {
      throw new Error(`Row index ${index} out of bounds (${rows.length} rows)`);
    }
    return rows[index];
  }

  /**
   * Get all values in a specific column.
   */
  async getColumnValues(headerName: string): Promise<string[]> {
    const rows = await this.getAllRows();
    return rows.map((row) => row[headerName] || '');
  }

  /**
   * Get the total number of visible rows.
   */
  async getRowCount(): Promise<number> {
    const rows = this.root.locator(this.config.rowSelector);
    const count = await rows.count();
    return this.config.firstRowIsHeader ? count - 1 : count;
  }

  /**
   * Get a specific cell's text by row index and column name.
   */
  async getCellText(rowIndex: number, columnName: string): Promise<string> {
    const row = await this.getRow(rowIndex);
    return row[columnName] || '';
  }

  /**
   * Get the Locator for a specific cell (for clicking, assertions, etc.).
   */
  getCellLocator(rowIndex: number, columnIndex: number): Locator {
    const adjustedRow = this.config.firstRowIsHeader ? rowIndex + 1 : rowIndex;
    return this.root
      .locator(this.config.rowSelector)
      .nth(adjustedRow)
      .locator(this.config.cellSelector)
      .nth(columnIndex);
  }

  /**
   * Get the Locator for a specific row.
   */
  getRowLocator(rowIndex: number): Locator {
    const adjustedRow = this.config.firstRowIsHeader ? rowIndex + 1 : rowIndex;
    return this.root.locator(this.config.rowSelector).nth(adjustedRow);
  }

  // ─── Search & Filter ────────────────────────────────────────────────────

  /**
   * Find the first row where a column matches a value.
   */
  async findRow(columnName: string, value: string | RegExp): Promise<TableRow | undefined> {
    const rows = await this.getAllRows();
    return rows.find((row) => {
      const cellValue = row[columnName] || '';
      return typeof value === 'string' ? cellValue === value : value.test(cellValue);
    });
  }

  /**
   * Find all rows where a column matches a value.
   */
  async findRows(columnName: string, value: string | RegExp): Promise<TableRow[]> {
    const rows = await this.getAllRows();
    return rows.filter((row) => {
      const cellValue = row[columnName] || '';
      return typeof value === 'string' ? cellValue === value : value.test(cellValue);
    });
  }

  /**
   * Find the row index where a column matches a value.
   * Returns -1 if not found.
   */
  async findRowIndex(columnName: string, value: string | RegExp): Promise<number> {
    const rows = await this.getAllRows();
    return rows.findIndex((row) => {
      const cellValue = row[columnName] || '';
      return typeof value === 'string' ? cellValue === value : value.test(cellValue);
    });
  }

  /**
   * Check if a row with the given column value exists.
   */
  async hasRow(columnName: string, value: string | RegExp): Promise<boolean> {
    return (await this.findRowIndex(columnName, value)) >= 0;
  }

  // ─── Column Interactions ────────────────────────────────────────────────

  /**
   * Click a column header (typically to sort).
   */
  async clickHeader(headerName: string): Promise<void> {
    const headers = this.root.locator(this.config.headerSelector);
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.trim() === headerName) {
        await headers.nth(i).click();
        return;
      }
    }
    throw new Error(`Header "${headerName}" not found`);
  }

  /**
   * Get the column index for a given header name.
   */
  async getColumnIndex(headerName: string): Promise<number> {
    const headers = await this.getHeaders();
    const idx = headers.indexOf(headerName);
    if (idx === -1) throw new Error(`Header "${headerName}" not found`);
    return idx;
  }

  // ─── Row Interactions ───────────────────────────────────────────────────

  /**
   * Click a specific row (e.g. for selection).
   */
  async clickRow(rowIndex: number): Promise<void> {
    await this.getRowLocator(rowIndex).click();
  }

  /**
   * Click a cell in a specific row and column.
   */
  async clickCell(rowIndex: number, columnName: string): Promise<void> {
    const colIdx = await this.getColumnIndex(columnName);
    await this.getCellLocator(rowIndex, colIdx).click();
  }

  /**
   * Click a row that contains a specific value in a column.
   */
  async clickRowByValue(columnName: string, value: string | RegExp): Promise<void> {
    const idx = await this.findRowIndex(columnName, value);
    if (idx === -1) throw new Error(`Row with ${columnName}="${value}" not found`);
    await this.clickRow(idx);
  }

  /**
   * Click a button/link inside a specific cell (e.g. action buttons).
   */
  async clickInCell(
    rowIndex: number,
    columnName: string,
    innerSelector: string,
  ): Promise<void> {
    const colIdx = await this.getColumnIndex(columnName);
    await this.getCellLocator(rowIndex, colIdx).locator(innerSelector).click();
  }

  /**
   * Click an action button in a row found by column value.
   * Common pattern: find row by ID/name, click its "Edit" or "Delete" button.
   */
  async clickActionInRow(
    findColumn: string,
    findValue: string | RegExp,
    actionColumn: string,
    actionSelector: string,
  ): Promise<void> {
    const rowIdx = await this.findRowIndex(findColumn, findValue);
    if (rowIdx === -1) throw new Error(`Row with ${findColumn}="${findValue}" not found`);
    await this.clickInCell(rowIdx, actionColumn, actionSelector);
  }

  // ─── Assertions ─────────────────────────────────────────────────────────

  /**
   * Assert the table has exactly N rows.
   */
  async expectRowCount(count: number, options?: { timeout?: number }): Promise<void> {
    const rows = this.root.locator(this.config.rowSelector);
    const expected = this.config.firstRowIsHeader ? count + 1 : count;
    await expect(rows).toHaveCount(expected, { timeout: options?.timeout ?? 5_000 });
  }

  /**
   * Assert a column is sorted in the specified direction.
   */
  async expectColumnSorted(
    columnName: string,
    direction: SortDirection,
  ): Promise<void> {
    const values = await this.getColumnValues(columnName);

    if (direction === 'none') return; // No assertion needed

    const sorted = [...values].sort((a, b) => {
      // Try numeric sort first
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      // Fall back to string sort
      return direction === 'asc'
        ? a.localeCompare(b)
        : b.localeCompare(a);
    });

    expect(values).toEqual(sorted);
  }

  /**
   * Assert a specific cell contains expected text.
   */
  async expectCellText(
    rowIndex: number,
    columnName: string,
    expected: string | RegExp,
  ): Promise<void> {
    const colIdx = await this.getColumnIndex(columnName);
    const cell = this.getCellLocator(rowIndex, colIdx);
    if (typeof expected === 'string') {
      await expect(cell).toHaveText(expected);
    } else {
      await expect(cell).toHaveText(expected);
    }
  }

  /**
   * Assert a row with specific column values exists in the table.
   */
  async expectRowExists(criteria: Record<string, string | RegExp>): Promise<void> {
    const rows = await this.getAllRows();
    const found = rows.some((row) =>
      Object.entries(criteria).every(([col, expected]) => {
        const actual = row[col] || '';
        return typeof expected === 'string' ? actual === expected : expected.test(actual);
      }),
    );
    expect(found).toBe(true);
  }

  /**
   * Assert a row with specific column values does NOT exist.
   */
  async expectRowNotExists(criteria: Record<string, string | RegExp>): Promise<void> {
    const rows = await this.getAllRows();
    const found = rows.some((row) =>
      Object.entries(criteria).every(([col, expected]) => {
        const actual = row[col] || '';
        return typeof expected === 'string' ? actual === expected : expected.test(actual);
      }),
    );
    expect(found).toBe(false);
  }

  /**
   * Assert the table is empty (no data rows).
   */
  async expectEmpty(): Promise<void> {
    await this.expectRowCount(0);
  }

  /**
   * Assert the table is not empty.
   */
  async expectNotEmpty(): Promise<void> {
    const count = await this.getRowCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert all values in a column match a pattern.
   */
  async expectColumnValues(
    columnName: string,
    expected: string[] | RegExp,
  ): Promise<void> {
    const values = await this.getColumnValues(columnName);
    if (Array.isArray(expected)) {
      expect(values).toEqual(expected);
    } else {
      for (const val of values) {
        expect(val).toMatch(expected);
      }
    }
  }

  /**
   * Assert a column contains a specific value somewhere.
   */
  async expectColumnContains(columnName: string, value: string): Promise<void> {
    const values = await this.getColumnValues(columnName);
    expect(values).toContain(value);
  }

  /**
   * Assert a column does NOT contain a specific value.
   */
  async expectColumnNotContains(columnName: string, value: string): Promise<void> {
    const values = await this.getColumnValues(columnName);
    expect(values).not.toContain(value);
  }

  // ─── Pagination ─────────────────────────────────────────────────────────

  /**
   * Navigate to a specific page in a paginated table.
   */
  async goToPage(
    pageNumber: number,
    paginationSelector?: string,
  ): Promise<void> {
    const selector = paginationSelector || `[aria-label="Page ${pageNumber}"], button:has-text("${pageNumber}")`;
    await this.page.locator(selector).click();
  }

  /**
   * Click the "Next page" button.
   */
  async nextPage(selector?: string): Promise<void> {
    const btn = selector || '[aria-label="Next page"], [aria-label="next"], button:has-text("Next")';
    await this.page.locator(btn).click();
  }

  /**
   * Click the "Previous page" button.
   */
  async prevPage(selector?: string): Promise<void> {
    const btn = selector || '[aria-label="Previous page"], [aria-label="previous"], button:has-text("Previous")';
    await this.page.locator(btn).click();
  }

  // ─── Checkbox/Selection ─────────────────────────────────────────────────

  /**
   * Select a row by clicking its checkbox (common in data grids).
   */
  async selectRow(rowIndex: number, checkboxSelector?: string): Promise<void> {
    const row = this.getRowLocator(rowIndex);
    const checkbox = row.locator(checkboxSelector || 'input[type="checkbox"], [role="checkbox"]');
    await checkbox.click();
  }

  /**
   * Select all rows (click the "select all" checkbox in the header).
   */
  async selectAll(selectAllSelector?: string): Promise<void> {
    const selector = selectAllSelector ||
      `${this.config.rootSelector} thead input[type="checkbox"], ${this.config.rootSelector} [role="columnheader"] input[type="checkbox"]`;
    await this.page.locator(selector).click();
  }

  /**
   * Get the indices of currently selected rows.
   */
  async getSelectedRowIndices(selectedClass?: string): Promise<number[]> {
    const rows = this.root.locator(this.config.rowSelector);
    const count = await rows.count();
    const selected: number[] = [];
    const cls = selectedClass || 'selected';

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const isSelected =
        (await row.getAttribute('aria-selected')) === 'true' ||
        (await row.getAttribute('class'))?.includes(cls) ||
        (await row.locator('input[type="checkbox"]:checked').count()) > 0;

      if (isSelected) {
        selected.push(this.config.firstRowIsHeader ? i - 1 : i);
      }
    }

    return selected;
  }

  // ─── Inline Editing ─────────────────────────────────────────────────────

  /**
   * Double-click a cell to enter edit mode, type a value, and confirm.
   * Works with inline-editable grids (AG Grid, Material Table, etc.).
   */
  async editCell(
    rowIndex: number,
    columnName: string,
    newValue: string,
    options?: {
      /** How to activate edit mode. Default: 'dblclick' */
      activateBy?: 'dblclick' | 'click' | 'enter';
      /** How to confirm the edit. Default: 'enter' */
      confirmBy?: 'enter' | 'tab' | 'blur';
      /** Selector for the input that appears in edit mode */
      inputSelector?: string;
    },
  ): Promise<void> {
    const colIdx = await this.getColumnIndex(columnName);
    const cell = this.getCellLocator(rowIndex, colIdx);
    const activateBy = options?.activateBy || 'dblclick';
    const confirmBy = options?.confirmBy || 'enter';
    const inputSelector = options?.inputSelector || 'input, textarea';

    // Activate edit mode
    if (activateBy === 'dblclick') {
      await cell.dblclick();
    } else if (activateBy === 'click') {
      await cell.click();
    } else {
      await cell.press('Enter');
    }

    // Find and fill the input
    const input = cell.locator(inputSelector);
    await input.clear();
    await input.fill(newValue);

    // Confirm
    if (confirmBy === 'enter') {
      await input.press('Enter');
    } else if (confirmBy === 'tab') {
      await input.press('Tab');
    } else {
      await cell.click({ position: { x: 0, y: 0 } }); // Click outside
    }
  }
}

# Table Helpers

**File:** `src/main/utils/table-helpers.ts`

## Overview

TableHelper provides a structured API for interacting with and asserting on HTML tables and data grids (AG Grid, Material Table, etc.). It reads table data into typed objects, supports sorting/filtering assertions, pagination navigation, row selection, inline editing, and action button clicks — all through a single class instance.

## How It Works

TableHelper locates the table root element, then uses configurable selectors to find headers, rows, and cells. It reads the DOM structure into `TableRow` objects (key-value maps where keys are column header text). All operations are relative to the configured root selector, so multiple tables on a page can each have their own helper instance.

The class supports both standard HTML tables (`<thead>/<tbody>/<tr>/<td>`) and ARIA-based grids (`[role="columnheader"]`, `[role="row"]`, `[role="gridcell"]`).

## Configuration

```typescript
const table = new TableHelper(page, {
  rootSelector: '#users-table',                              // Table container
  headerSelector: 'thead th, [role="columnheader"]',         // Header cells
  rowSelector: 'tbody tr, [role="row"]:not(:first-child)',   // Data rows
  cellSelector: 'td, [role="gridcell"], [role="cell"]',      // Cells within a row
  firstRowIsHeader: false,                                   // Skip first row if it's a header
});
```

All selectors have sensible defaults that work with standard HTML tables.

## Usage Examples

### Read table data

```typescript
const table = new TableHelper(page, { rootSelector: '.inventory_list' });

const rows = await table.getAllRows();
// [{ 'Name': 'Sauce Labs Backpack', 'Price': '$29.99', ... }, ...]

const headers = await table.getHeaders();
// ['Name', 'Description', 'Price']

const prices = await table.getColumnValues('Price');
// ['$29.99', '$9.99', '$15.99', ...]

const count = await table.getRowCount();
```

### Search and find rows

```typescript
// Find first row matching a column value
const row = await table.findRow('Email', 'alice@test.com');
expect(row?.['Status']).toBe('Active');

// Find all matching rows
const activeUsers = await table.findRows('Status', 'Active');

// Check existence
const exists = await table.hasRow('Name', /Backpack/);
```

### Sort and verify

```typescript
await table.clickHeader('Price');
await table.expectColumnSorted('Price', 'asc');

await table.clickHeader('Price'); // Click again for desc
await table.expectColumnSorted('Price', 'desc');
```

### Assertions

```typescript
await table.expectRowCount(6);
await table.expectEmpty();
await table.expectNotEmpty();

await table.expectCellText(0, 'Name', 'Sauce Labs Backpack');
await table.expectRowExists({ Name: 'Sauce Labs Backpack', Price: '$29.99' });
await table.expectRowNotExists({ Name: 'Deleted Item' });

await table.expectColumnContains('Status', 'Active');
await table.expectColumnNotContains('Status', 'Banned');
await table.expectColumnValues('Status', ['Active', 'Active', 'Inactive']);
```

### Row interactions

```typescript
// Click a row
await table.clickRow(0);

// Click a specific cell
await table.clickCell(2, 'Actions');

// Click a row by column value
await table.clickRowByValue('Name', 'Alice');

// Click an action button inside a cell
await table.clickActionInRow('Name', 'Alice', 'Actions', 'button.edit');
```

### Pagination

```typescript
await table.nextPage();
await table.prevPage();
await table.goToPage(3);

// Custom pagination selectors
await table.nextPage('.custom-next-btn');
```

### Row selection (checkboxes)

```typescript
await table.selectRow(0);
await table.selectRow(2);
await table.selectAll();

const selected = await table.getSelectedRowIndices();
expect(selected).toEqual([0, 2]);
```

### Inline editing

```typescript
await table.editCell(0, 'Name', 'Updated Name', {
  activateBy: 'dblclick',   // 'dblclick' | 'click' | 'enter'
  confirmBy: 'enter',       // 'enter' | 'tab' | 'blur'
  inputSelector: 'input',   // Selector for the edit input
});
```

## Tips & Best Practices

- Create one `TableHelper` instance per table — reuse it across assertions in the same test.
- Use `findRow` + field access instead of index-based `getRow` when row order might change.
- For AG Grid or complex grids, customize `cellSelector` to match the grid's DOM structure.
- `expectColumnSorted` handles both numeric and string sorting automatically.
- Combine with `waitForCount` from wait-helpers when the table loads data asynchronously.

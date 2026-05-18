# SmartLocator

**File:** `src/main/utils/smart-locator.ts`

## Overview

SmartLocator is a self-healing locator utility for Playwright. It wraps your locators with a fallback strategy system: if your primary locator breaks (e.g. after a UI refactor), the framework automatically tries alternative strategies extracted from the element's DOM attributes. No AI — purely deterministic, weight-based resolution.

Use it when your test suite targets a rapidly evolving UI where selectors frequently change.

## How It Works

1. **Registration** — You register an element with one or more user-provided Playwright Locators (optionally weighted).
2. **Auto-extraction** — On registration, SmartLocator evaluates the live element and extracts fallback strategies from its DOM attributes (testId, role, aria-label, placeholder, id, name, text, CSS path, XPath).
3. **Weighted resolution** — Each strategy has a numeric weight. User locators always have weight ≥ 100; auto-extracted strategies range 20–95 (testId=95, role=90, label=88, placeholder=85, id=85, text=70, CSS=30, XPath=20).
4. **Find/Heal** — When you call `find()` or `locate()`, strategies are tried in descending weight order. If all user locators fail but an auto-strategy succeeds, the element is "healed" and the working strategy is promoted.
5. **Persistence** — Fingerprints are saved to `.locators/locators.json` so healing data survives across runs.

## Configuration

```typescript
const smart = new SmartLocator(page, {
  storeDir: '.locators',        // Directory for fingerprint JSON
  strategyTimeout: 3000,        // Timeout per strategy attempt (ms)
  autoUpdate: true,             // Promote working auto-strategies on heal
  verbose: true,                // Log healing activity to console
  enableAutoHealing: true,      // Extract DOM fallback strategies on register
});
```

## Usage Examples

### Single locator (simplest)

```typescript
const smart = new SmartLocator(page);

await smart.register('login-btn', page.getByRole('button', { name: 'Log in' }));

// Later in the test:
const btn = await smart.locate('login-btn');
await btn.click();
```

### Multiple weighted locators

```typescript
await smart.register('add-to-cart', [
  { locator: page.getByTestId('add-cart'), weight: 300, description: 'test-id' },
  { locator: page.getByRole('button', { name: 'Add to cart' }), weight: 200 },
  { locator: page.locator('.btn-add-cart'), weight: 100 },
]);
```

### Page Object integration

```typescript
class InventoryPage {
  private smart: SmartLocator;

  constructor(private page: Page) {
    this.smart = new SmartLocator(page);
  }

  async init() {
    await this.smart.register('sort-dropdown', this.page.locator('[data-test="product-sort-container"]'));
    await this.smart.register('cart-badge', this.page.locator('.shopping_cart_badge'));
  }

  async sortBy(option: string) {
    const dropdown = await this.smart.locate('sort-dropdown');
    await dropdown.selectOption(option);
  }
}
```

### Checking healing status

```typescript
const result = await smart.find('login-btn');
if (result.healed) {
  console.warn(`Locator healed via: ${result.usedStrategy?.type}:${result.usedStrategy?.value}`);
}
```

## Tips & Best Practices

- Register elements during page initialization (e.g. in a Page Object constructor or `beforeEach`), not inside assertions.
- Use `enableAutoHealing: false` in production CI if you want strict locator enforcement — healing is best for development/debugging.
- Prefer `getByTestId` or `getByRole` as your primary user locator; they're the most stable.
- Review `.locators/locators.json` periodically to see which elements needed healing — it signals selectors that should be updated in code.
- Keep `strategyTimeout` low (2–3s) to avoid slow cascading failures when an element genuinely doesn't exist.

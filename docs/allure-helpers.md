# Allure Helpers

**File:** `src/main/utils/allure-helpers.ts`

## Overview

Allure Helpers provide a clean API for organizing tests in Allure Report. They wrap `allure-js-commons` with typed functions for defining suite hierarchy, behavior hierarchy (Epic/Feature/Story), tags, severity, steps, attachments, and metadata. Designed to be called in `test.beforeEach()` or at the start of each test for consistent report organization.

## How It Works

Each function calls the corresponding `allure-js-commons` API to annotate the currently running test. Allure Report uses these annotations to build its navigation tree:

**Suite hierarchy** (left sidebar):
```
Parent Suite → Suite → Sub Suite → Test
```

**Behavior hierarchy** (Behaviors tab):
```
Epic → Feature → Story → Test
```

The `configureAllure()` function applies all metadata in a single call — ideal for `beforeEach` hooks.

## Configuration

Install the Allure Playwright reporter in `playwright.config.ts`:

```typescript
reporter: [
  ['allure-playwright'],
  ['html'],
],
```

No additional configuration needed for the helpers — they work with any Allure reporter setup.

## Usage Examples

### Full configuration in beforeEach

```typescript
import { configureAllure } from '@utils/allure-helpers';

test.beforeEach(async () => {
  await configureAllure({
    parentSuite: 'E-Commerce App',
    suite: 'Authentication',
    subSuite: 'Login Flow',
    epic: 'User Access',
    feature: 'Login',
    story: 'Email/Password Login',
    tags: ['smoke', 'regression', 'P1'],
    severity: 'critical',
    owner: 'QA Team',
  });
});
```

### Steps (structured reporting)

```typescript
import { allureStep } from '@utils/allure-helpers';

test('complete checkout', async ({ page }) => {
  await allureStep('Add item to cart', async () => {
    await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  });

  await allureStep('Navigate to cart', async () => {
    await page.click('.shopping_cart_link');
  });

  await allureStep('Complete checkout form', async () => {
    await allureStep('Fill personal info', async () => {
      await page.fill('[data-test="firstName"]', 'John');
      await page.fill('[data-test="lastName"]', 'Doe');
      await page.fill('[data-test="postalCode"]', '12345');
    });
    await page.click('[data-test="continue"]');
  });
});
```

### Tags from test title

```typescript
// Test title: 'should login successfully @smoke @P1'
test.beforeEach(async ({}, testInfo) => {
  await allureTagsFromTitle(testInfo.title);
  // Automatically adds tags: ['smoke', 'P1']
});
```

### Manual tags and severity

```typescript
import { allureTags, allureSeverity } from '@utils/allure-helpers';

test('critical payment flow', async ({ page }) => {
  await allureTags('payments', 'critical-path', 'P0');
  await allureSeverity('blocker');
  // ...
});
```

### Suite hierarchy only

```typescript
import { allureSuite } from '@utils/allure-helpers';

test.beforeEach(async () => {
  await allureSuite({
    parentSuite: 'SauceDemo',
    suite: 'Inventory',
    subSuite: 'Product Sorting',
  });
});
```

### Behavior hierarchy only

```typescript
import { allureBehavior } from '@utils/allure-helpers';

await allureBehavior({
  epic: 'Shopping',
  feature: 'Cart Management',
  story: 'Add/Remove Items',
});
```

### Attachments

```typescript
import { allureAttachText, allureAttachJson, allureAttachFile } from '@utils/allure-helpers';

// Attach API response for debugging
await allureAttachJson('API Response', responseBody);

// Attach log output
await allureAttachText('Console Logs', logs.join('\n'));

// Attach a file
await allureAttachFile('Screenshot', 'test-results/failure.png', 'image/png');
```

### Links and metadata

```typescript
import { allureIssue, allureTms, allureLink, allureOwner, allureDescription } from '@utils/allure-helpers';

await allureIssue('JIRA-1234', 'Login timeout bug');
await allureTms('TC-5678', 'Login test case');
await allureLink('https://wiki.example.com/login-spec', 'Spec Doc');
await allureOwner('alice@team.com');
await allureDescription('## Login Flow\nVerifies email/password authentication.');
```

### Parameters

```typescript
import { allureParameter } from '@utils/allure-helpers';

await allureParameter('browser', 'chromium');
await allureParameter('environment', 'staging');
await allureParameter('api-key', 'sk-***', { mode: 'masked' });
```

## Tips & Best Practices

- Use `configureAllure()` in a shared `beforeEach` fixture so all tests in a file have consistent organization.
- Keep suite hierarchy shallow (2–3 levels). Deep nesting makes the report harder to navigate.
- Use `allureStep` for logical groupings within a test — it makes failures easier to locate in the report.
- Combine `@tag` syntax in test titles with `allureTagsFromTitle` for zero-effort tag extraction.
- Severity levels: `blocker` > `critical` > `normal` > `minor` > `trivial`. Use them to prioritize failures in the report.

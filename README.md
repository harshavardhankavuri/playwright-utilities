# Playwright Utilities

A Playwright test automation framework built with TypeScript following the **Page Object Model (POM)** pattern with **Allure reporting**.

## Project Structure

```
├── env/                 # Environment configuration files
│   ├── .env.dev         # Development environment variables
│   └── .env.qa          # QA environment variables
├── src/
│   ├── main/            # Framework source (pages, fixtures, utils)
│   │   ├── pages/       # Page Object classes
│   │   │   ├── base.page.ts
│   │   │   ├── home.page.ts
│   │   │   └── index.ts
│   │   ├── fixtures/    # Custom Playwright fixtures
│   │   │   ├── page-fixtures.ts
│   │   │   └── index.ts
│   │   ├── utils/       # Helper utilities
│   │   │   ├── test-helpers.ts
│   │   │   └── index.ts
│   │   └── data/        # Test data constants
│   │       ├── test-data.ts
│   │       └── index.ts
│   └── tests/           # Test spec files
│       └── home.spec.ts
├── playwright.config.ts # Playwright configuration
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.json       # ESLint configuration
└── .prettierrc          # Prettier configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Java Runtime (for Allure report generation)

### Installation

```bash
npm install
npx playwright install
```

### Running Tests

```bash
# Run all tests (defaults to dev environment)
npm test

# Run tests against specific environment
npm run test:dev
npm run test:qa

# Run tests in headed mode
npm run test:headed

# Run tests with UI mode
npm run test:ui

# Debug tests
npm run test:debug

# Run only Chromium
npm run test:chromium
```

### Reports

```bash
# Open Playwright HTML report
npm run report:html

# Generate and open Allure report
npm run report:allure

# Generate Allure report only
npm run report:allure:generate

# Open existing Allure report
npm run report:allure:open
```

### Linting & Formatting

```bash
# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

## Environment Configuration

Environment files live in the `env/` directory. Set the `ENV` variable to switch:

```bash
# Uses env/.env.dev (default)
npm run test:dev

# Uses env/.env.qa
npm run test:qa

# Custom: ENV=staging npx playwright test
```

Each `.env.<environment>` file should contain:

```env
BASE_URL=https://your-app-url.com
ENV=dev
```

## Page Object Model (POM)

All page objects extend `BasePage` which provides common methods:

- `navigate(path)` - Navigate to a URL
- `waitForPageLoad()` - Wait for page load state
- `click(locator)` - Click an element
- `fill(locator, text)` - Fill an input
- `getText(locator)` - Get element text
- `isVisible(locator)` - Check visibility
- `waitForElement(locator)` - Wait for element

### Creating a New Page Object

```typescript
import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
  }

  async login(username: string, password: string): Promise<void> {
    await this.fill(this.usernameInput, username);
    await this.fill(this.passwordInput, password);
    await this.click(this.submitButton);
  }
}
```

### Using Fixtures

Register your page object in `src/main/fixtures/page-fixtures.ts`, then use it in tests:

```typescript
import { test, expect } from '../main/fixtures';

test('example test', async ({ homePage }) => {
  await homePage.goto();
  expect(await homePage.isHeadingVisible()).toBeTruthy();
});
```

## Allure Reporting

Allure results are generated automatically in `allure-results/` after each test run. To view:

```bash
npm run report:allure
```

This generates the report in `allure-report/` and opens it in your browser.

> **Note:** Allure CLI requires Java Runtime Environment (JRE) to be installed.

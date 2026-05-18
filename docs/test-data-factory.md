# Test Data Factory

**File:** `src/main/utils/test-data-factory.ts`

## Overview

TestDataFactory generates realistic, reproducible test data using a seeded pseudo-random number generator (PRNG). Same seed always produces the same sequence — no external dependencies like faker.js needed. Use it to create people, addresses, credit cards, UUIDs, and arbitrary collections for your tests.

## How It Works

The factory uses the **mulberry32** algorithm — a fast, deterministic 32-bit PRNG. When you provide a seed, every call to the factory produces the same output in the same order. This means:

- Tests are reproducible: re-run with the same seed → same data
- No network calls or external services
- Zero dependencies beyond the standard library
- Data pools (names, cities, streets) are hardcoded arrays picked from via the PRNG

Without a seed, `Date.now()` is used, giving different data each run.

## Configuration

```typescript
// Random seed each run (different data every time)
const data = new TestDataFactory();

// Fixed seed for reproducibility
const data = new TestDataFactory(12345);

// Reset mid-test to a known state
data.reseed(99999);
```

### Exported singleton

```typescript
import { testData } from '@utils/test-data-factory';
// Uses random seed — convenient for quick one-off generation
```

## Usage Examples

### Generate a person

```typescript
const data = new TestDataFactory(42);

const person = data.person();
// { firstName: 'David', lastName: 'Garcia', email: 'david.garcia847@outlook.com',
//   phone: '(847) 293-4521', username: 'david2341' }
```

### Generate an address

```typescript
const addr = data.address();
// { street: '4821 Oak Ave', city: 'Phoenix', state: 'TX', zip: '38291', country: 'US' }
```

### Generate a credit card

```typescript
const card = data.creditCard();
// { number: '4293 8471 0293 4821', expiry: '03/28', cvv: '847', holder: 'DAVID GARCIA' }
```

### Generate UUIDs and IDs

```typescript
const id = data.uuid();    // '8a3f2b91-c4e7-4d82-b293-4821a3f2b91c'
const hex = data.id(12);   // 'a3f2b91c4e72'
const num = data.numericId(1000, 9999); // 4821
```

### Generate collections with `many()`

```typescript
// 10 users with sequential index
const users = data.many(10, (i) => ({
  id: i + 1,
  ...data.person(),
  role: data.oneOf(['admin', 'user', 'viewer']),
}));
```

### SauceDemo test example

```typescript
const data = new TestDataFactory(2025);

test('checkout with generated data', async ({ page }) => {
  const buyer = data.person();

  await page.locator('[data-test="firstName"]').fill(buyer.firstName);
  await page.locator('[data-test="lastName"]').fill(buyer.lastName);
  await page.locator('[data-test="postalCode"]').fill(data.address().zip);
  await page.locator('[data-test="continue"]').click();
});
```

### Other generators

```typescript
data.email();                    // 'james.smith42@gmail.com'
data.phone();                    // '(555) 234-8901'
data.username();                 // 'michael4293'
data.password(16);               // 'kR3$mNp8xQ2!wL5z'
data.company();                  // 'Johnson Technologies'
data.product();                  // 'Premium Widget'
data.price(10, 500);             // '247.83'
data.sentence(8);                // 'The quick brown fox jumps over lazy dog.'
data.pastDate(30);               // Date object within last 30 days
data.futureDate(90);             // Date object within next 90 days
data.bool(0.7);                  // true (70% probability)
data.int(1, 100);                // 47
```

## Tips & Best Practices

- Always use a fixed seed in CI pipelines so failures are reproducible. Log the seed in test output for debugging.
- Use `many()` to generate bulk data for table/list tests — it's cleaner than manual loops.
- Combine with `ApiClient` to seed backend data: `api.post('/users', data.person())`.
- For tests that need unique emails across parallel workers, include the worker index in the seed: `new TestDataFactory(42 + workerIndex)`.
- The `oneOf()` method is useful for randomizing test scenarios (e.g. picking a random product category).

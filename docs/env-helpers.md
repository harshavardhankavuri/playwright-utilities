# Environment Helpers

Type-safe access to environment variables and runtime configuration. Replaces scattered `process.env.X || 'default'` calls with a single validated config object.

## Functions

### `requireEnv(name)`

Get a required env var. Throws with a clear message if missing or empty.

```typescript
import { requireEnv } from '../main/utils';

const apiKey = requireEnv('API_KEY');
const dbUrl  = requireEnv('DATABASE_URL');
```

### `getEnv(name, defaultValue)`

Get an optional env var with a fallback.

```typescript
const timeout = getEnv('TIMEOUT', '30000');
const env     = getEnv('ENV', 'dev');
```

### `getEnvInt(name, defaultValue?)`

Get an env var as a number. Throws if the value is not numeric.

```typescript
const retries = getEnvInt('RETRIES', 2);
const port    = getEnvInt('PORT', 3000);
```

### `getEnvBool(name, defaultValue?)`

Get an env var as a boolean. Treats `'true'`, `'1'`, `'yes'`, `'on'` as `true` (case-insensitive).

```typescript
const headless = getEnvBool('HEADLESS', true);
const debug    = getEnvBool('DEBUG', false);
```

### `getEnvArray(name, defaultValue?)`

Get a comma-separated env var as a string array.

```typescript
// TEST_TAGS=smoke,regression,P1
const tags = getEnvArray('TEST_TAGS', ['smoke']);
// → ['smoke', 'regression', 'P1']
```

## Runtime Flags

Pre-built constants for common runtime checks:

```typescript
import { ENV, IS_CI, IS_DEBUG, UPDATE_SNAPSHOTS } from '../main/utils';

console.log(ENV);              // 'dev' | 'qa' | 'staging' | ...
console.log(IS_CI);            // true when running in CI
console.log(IS_DEBUG);         // true when DEBUG=true or PWDEBUG=true
console.log(UPDATE_SNAPSHOTS); // true when UPDATE_SNAPSHOTS=true
```

### `isEnv(...envNames)`

Check if the current environment matches one of the given names.

```typescript
if (isEnv('staging', 'prod')) {
  // Only run in staging or production
}
```

## `buildConfig(schema)`

Build a typed configuration object from environment variables. Validates all required variables at startup rather than at runtime.

```typescript
import { buildConfig } from '../main/utils';

const config = buildConfig({
  baseUrl:  { env: 'BASE_URL',  required: true },
  apiKey:   { env: 'API_KEY',   required: true },
  timeout:  { env: 'TIMEOUT',   type: 'number',  default: 30000 },
  headless: { env: 'HEADLESS',  type: 'boolean', default: true },
  tags:     { env: 'TEST_TAGS', type: 'array',   default: [] },
});

// config.baseUrl  → string (throws if missing)
// config.timeout  → number
// config.headless → boolean
// config.tags     → string[]
```

### Schema Field Properties

| Property | Type | Description |
|---|---|---|
| `env` | `string` | Environment variable name |
| `required` | `boolean` | Throw if missing. Default: `false` |
| `type` | `'string' \| 'number' \| 'boolean' \| 'array'` | Auto-coercion. Default: `'string'` |
| `default` | `any` | Value when env var is not set |

## Usage in Tests

```typescript
import { buildConfig, isEnv } from '../main/utils';

// Define once at module level — validated on import
const config = buildConfig({
  baseUrl:  { env: 'BASE_URL', required: true },
  username: { env: 'TEST_USER', default: 'admin' },
  password: { env: 'TEST_PASS', required: true },
  timeout:  { env: 'TIMEOUT', type: 'number', default: 30000 },
});

test('login', async ({ page }) => {
  await page.goto(config.baseUrl);
  await page.fill('#username', config.username);
  await page.fill('#password', config.password!);
});

test.skip(isEnv('prod'), 'Skip destructive tests in production');
```

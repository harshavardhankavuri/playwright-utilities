/**
 * Environment Helpers — Type-safe access to environment variables and
 * runtime configuration for Playwright tests.
 *
 * Solves the common problem of scattered `process.env.X || 'default'` calls
 * throughout test files, replacing them with a single validated config object.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPED ENV ACCESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a required environment variable. Throws if missing.
 *
 * Usage:
 *   const apiKey = requireEnv('API_KEY');
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Required environment variable "${name}" is not set. ` +
        `Check your .env file or CI configuration.`,
    );
  }
  return value;
}

/**
 * Get an optional environment variable with a fallback default.
 *
 * Usage:
 *   const timeout = getEnv('TIMEOUT', '30000');
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

/**
 * Get an environment variable as a number. Throws if missing or not numeric.
 *
 * Usage:
 *   const retries = getEnvInt('RETRIES', 2);
 */
export function getEnvInt(name: string, defaultValue?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Required numeric environment variable "${name}" is not set.`);
  }
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable "${name}" must be a number, got: "${raw}"`);
  }
  return parsed;
}

/**
 * Get an environment variable as a boolean.
 * Treats 'true', '1', 'yes', 'on' as true (case-insensitive).
 *
 * Usage:
 *   const headless = getEnvBool('HEADLESS', true);
 */
export function getEnvBool(name: string, defaultValue: boolean = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
}

/**
 * Get an environment variable as a comma-separated array.
 *
 * Usage:
 *   const tags = getEnvArray('TEST_TAGS', ['smoke']);
 *   // TEST_TAGS=smoke,regression → ['smoke', 'regression']
 */
export function getEnvArray(name: string, defaultValue: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/** The current test environment name (dev, qa, staging, prod, etc.) */
export const ENV = getEnv('ENV', 'dev');

/** Whether tests are running in CI. */
export const IS_CI = getEnvBool('CI');

/** Whether tests are running in debug mode. */
export const IS_DEBUG = getEnvBool('DEBUG') || getEnvBool('PWDEBUG');

/** Whether to update visual snapshots. */
export const UPDATE_SNAPSHOTS = getEnvBool('UPDATE_SNAPSHOTS');

/**
 * Check if the current environment matches one of the given names.
 *
 * Usage:
 *   if (isEnv('staging', 'prod')) { ... }
 */
export function isEnv(...envNames: string[]): boolean {
  return envNames.includes(ENV.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPED CONFIG BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a typed test configuration object from environment variables.
 * Validates all required variables at startup rather than at runtime.
 *
 * Usage:
 *   const config = buildConfig({
 *     baseUrl:  { env: 'BASE_URL',  required: true },
 *     apiKey:   { env: 'API_KEY',   required: true },
 *     timeout:  { env: 'TIMEOUT',   type: 'number', default: 30000 },
 *     headless: { env: 'HEADLESS',  type: 'boolean', default: true },
 *   });
 *
 *   config.baseUrl  // string
 *   config.timeout  // number
 */
export function buildConfig<T extends Record<string, ConfigField>>(
  schema: T,
): ResolvedConfig<T> {
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const raw = process.env[field.env];

    if (raw === undefined || raw === '') {
      if (field.required) {
        throw new Error(
          `Required config "${key}" (env: ${field.env}) is not set. ` +
            `Check your .env file or CI configuration.`,
        );
      }
      result[key] = field.default;
      continue;
    }

    switch (field.type) {
      case 'number':
        result[key] = parseInt(raw, 10);
        break;
      case 'boolean':
        result[key] = ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
        break;
      case 'array':
        result[key] = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        result[key] = raw;
    }
  }

  return result as ResolvedConfig<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigField {
  /** Environment variable name */
  env: string;
  /** Whether the variable is required. Default: false */
  required?: boolean;
  /** Value type for automatic coercion. Default: 'string' */
  type?: 'string' | 'number' | 'boolean' | 'array';
  /** Default value if env var is not set */
  default?: unknown;
}

type ResolvedType<F extends ConfigField> = F['type'] extends 'number'
  ? number
  : F['type'] extends 'boolean'
    ? boolean
    : F['type'] extends 'array'
      ? string[]
      : string;

type ResolvedConfig<T extends Record<string, ConfigField>> = {
  [K in keyof T]: T[K]['required'] extends true
    ? ResolvedType<T[K]>
    : ResolvedType<T[K]> | undefined;
};

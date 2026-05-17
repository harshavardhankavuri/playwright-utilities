/**
 * Centralized test data constants.
 * Keep test data separate from test logic for maintainability.
 */
export const TestData = {
  urls: {
    home: '/',
    docs: '/docs/intro',
    api: '/docs/api/class-playwright',
  },
  timeouts: {
    short: 5_000,
    medium: 10_000,
    long: 30_000,
  },
} as const;

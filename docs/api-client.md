# API Client

**File:** `src/main/utils/api-client.ts`

## Overview

ApiClient is a typed HTTP client for API testing within Playwright. It wraps Playwright's `APIRequestContext` with generics, automatic Bearer token injection, response timing, and chainable validation helpers. Use it for API-level setup/teardown, hybrid UI+API tests, or standalone API test suites.

## How It Works

The client uses Playwright's built-in `page.request` (or a standalone `APIRequestContext`) to make HTTP calls. Each response is wrapped in a typed `ApiResponse<T>` object that includes the parsed body, status, headers, duration, and the raw Playwright response. The client automatically:

- Serializes request bodies as JSON
- Sets `Content-Type: application/json` and `Accept: application/json`
- Injects `Authorization: Bearer <token>` when configured
- Measures response time (wall-clock ms)
- Parses JSON responses (falls back to text if parsing fails)

## Configuration

```typescript
const api = new ApiClient(page, {
  baseURL: 'https://api.example.com',   // Prepended to all paths
  defaultHeaders: { 'X-App': 'test' },  // Applied to every request
  bearerToken: 'my-jwt-token',          // Auto-injected as Bearer header
  timeout: 30_000,                      // Default request timeout (ms)
});
```

You can also pass a standalone `APIRequestContext` instead of a page:

```typescript
const api = new ApiClient(request, { baseURL: 'https://api.example.com' });
```

## Usage Examples

### Typed GET request

```typescript
interface User { id: number; name: string; email: string; }

const api = new ApiClient(page, { baseURL: 'https://api.saucedemo.com' });
const { body, status } = await api.get<User[]>('/api/users');

expect(status).toBe(200);
expect(body[0].name).toBe('Alice');
```

### POST with body

```typescript
const { body: created } = await api.post<User>('/api/users', {
  name: 'Bob',
  email: 'bob@test.com',
});
expect(created.id).toBeDefined();
```

### Auth flow chaining

```typescript
const api = new ApiClient(page, { baseURL: 'https://api.example.com' });

// Login to get token
const { body: auth } = await api.post<{ token: string }>('/auth/login', {
  email: 'admin@test.com',
  password: 'secret',
});

// Set token for subsequent requests
api.setToken(auth.token);

// Now all requests include the Bearer header
const { body: users } = await api.get<User[]>('/api/users');
```

### Validation helpers

```typescript
const response = await api.get<User>('/api/users/1');

// Assert status
api.expectStatus(response, 200);

// Assert body has required keys
api.expectBodyHasKeys(response, ['id', 'name', 'email']);

// Assert response time
api.expectFasterThan(response, 500); // Must respond in < 500ms

// Assert body field values
api.expectBodyContains(response, { name: 'Alice', role: 'admin' });

// Assert array length
const listResponse = await api.get<User[]>('/api/users');
api.expectArrayLength(listResponse, 10);
```

### Query parameters

```typescript
const { body } = await api.get<User[]>('/api/users', {
  params: { page: 1, limit: 20, active: true },
});
```

## Tips & Best Practices

- Use `ApiClient` for test data setup (create users, seed DB) before UI tests — it's faster than clicking through forms.
- Chain `expectStatus` + `expectFasterThan` for performance-sensitive endpoints.
- Set `bearerToken` in a fixture or `beforeAll` hook so all tests in a file share the same authenticated client.
- Use generics (`api.get<MyType>(...)`) to get TypeScript autocompletion on response bodies.
- For tests that need different auth levels, create multiple `ApiClient` instances with different tokens.

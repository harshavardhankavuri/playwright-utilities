# Network Mocker

**File:** `src/main/utils/network-mocker.ts`

## Overview

NetworkMocker is an advanced network interception utility for Playwright. It provides a fluent API for mocking API responses, simulating errors/timeouts, modifying real responses on-the-fly, replaying HAR files, mocking WebSocket connections, and capturing requests for assertions. Scoped to a single page instance.

## How It Works

When started, the mocker registers a catch-all route (`**/*`) on the page. Every request is matched against registered rules (sorted by priority). If a rule matches:

- **Static mock** — Responds with the configured status/body/headers.
- **Dynamic handler** — Calls your function with the request, returns a computed response.
- **Modify** — Fetches the real response from the server, applies your modifier, then serves the patched result.
- **Error/Timeout** — Aborts or delays the request.
- **Passthrough + Record** — Lets the request through but captures the exchange.

Unmatched requests pass through to the real server. All matched requests are captured for later inspection.

## Configuration

```typescript
const mocker = new NetworkMocker(page, {
  recordAll: false,       // If true, captures ALL requests (even unmatched)
  defaultDelay: 0,        // Default latency added to all mock responses (ms)
  defaultHeaders: {},     // Headers added to all mock responses
});
```

## Usage Examples

### Basic mock

```typescript
const mocker = new NetworkMocker(page);
await mocker.start();

mocker.mock('/api/users', { body: [{ id: 1, name: 'John' }] });

// Navigate and interact — /api/users will return the mock
await page.goto('/users');
```

### Dynamic response handler

```typescript
mocker.mock('/api/login', (req) => {
  const body = JSON.parse(req.postData() || '{}');
  return body.password === 'secret'
    ? { status: 200, body: { token: 'abc123' } }
    : { status: 401, body: { error: 'Invalid credentials' } };
});
```

### Method-specific mocks

```typescript
mocker.mockGet('/api/products', { body: products });
mocker.mockPost('/api/orders', { status: 201, body: { id: 'order-1' } });
mocker.mockDelete('/api/orders/1', { status: 204 });
```

### Error simulation

```typescript
// Network failure
mocker.mockError('/api/payments');

// Timeout (hangs for 30s then aborts)
mocker.mockTimeout('/api/slow-endpoint', 30_000);

// Slow response (adds latency before responding)
mocker.mockSlow('/api/search', 3000, { body: { results: [] } });
```

### Modify real responses

```typescript
// Fetch real response, then patch it
mocker.mockAndModify('/api/products', async (route, response) => {
  const json = await response.json();
  json.push({ name: 'Injected Product', id: 999 });
  return { json };
});

// Simpler: patch specific JSON fields
mocker.patchJson('/api/user/profile', { name: 'Overridden', verified: true });
```

### HAR replay

```typescript
await mocker.replayFromHAR('./hars/checkout-flow.har', {
  url: '**/api/**',
  notFound: 'abort',
});
```

### WebSocket mocking

```typescript
await mocker.mockWebSocket('wss://example.com/ws', (ws) => {
  ws.onMessage((message) => {
    if (message === 'ping') ws.send('pong');
  });
});
```

### Request inspection

```typescript
// After test actions...
expect(mocker.wasCalled('/api/users')).toBe(true);
expect(mocker.callCount('/api/users')).toBe(2);

const requests = mocker.getRequests('/api/login');
expect(requests[0].body).toEqual({ email: 'admin@test.com', password: 'secret' });

const lastReq = mocker.getLastRequest('/api/orders');
expect(lastReq?.method).toBe('POST');
```

### Limited-use mocks

```typescript
// Only respond with error for the first 2 calls, then remove
mocker.mockError('/api/flaky', { times: 2 });
```

### Cleanup

```typescript
await mocker.stop();   // Remove all routes
mocker.reset();        // Clear rules + captured requests
```

## Tips & Best Practices

- Always call `await mocker.start()` before registering mocks and `await mocker.stop()` in `afterEach`.
- Use `times` to simulate retry scenarios (fail N times, then succeed on the next real request).
- Use `priority` to layer mocks — higher priority rules match first. Error mocks default to priority 10.
- `mockAndModify` is powerful for testing edge cases: inject extra items, change field values, or add error fields to otherwise-real responses.
- Combine `recordAll: true` with `getRequests()` to assert that no unexpected API calls were made during a test.

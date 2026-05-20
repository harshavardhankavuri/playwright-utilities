# k6 Check Utilities (`k6/lib/checks.js`)

Composable check builders that produce objects compatible with k6's `check()` function. Build checks once, reuse them across tests.

## Core Functions

### `runChecks(res, ...checkObjects)`

Run multiple check objects against a response in one call. Returns `true` if all pass.

```js
import { runChecks, statusIs, bodyHasField, responseTimeLt } from '../lib/checks.js';

runChecks(res,
  statusIs(200),
  bodyHasField('id'),
  bodyHasField('title'),
  responseTimeLt(500),
);
```

### `allChecks(...checkObjects)`

Merge check objects into one without running them. Pass to k6's `check()` yourself.

```js
import { check } from 'k6';
import { allChecks, statusIs, bodyIsArray } from '../lib/checks.js';

check(res, allChecks(statusIs(200), bodyIsArray()));
```

## Status Checks

| Function | Assertion |
|---|---|
| `statusIs(code)` | `res.status === code` |
| `statusOk()` | `res.status >= 200 && < 300` |
| `statusClientError()` | `res.status >= 400 && < 500` |

```js
runChecks(res, statusIs(201));
runChecks(res, statusOk());
runChecks(res, statusClientError());
```

## Response Time Checks

### `responseTimeLt(maxMs)`

```js
runChecks(res, responseTimeLt(500));   // must complete in < 500ms
runChecks(res, responseTimeLt(2000));  // relaxed threshold
```

## Body Checks

### `bodyNotEmpty()`

```js
runChecks(res, bodyNotEmpty());
```

### `bodyContains(substring)`

```js
runChecks(res, bodyContains('"status":"active"'));
```

### `bodyHasField(fieldPath)`

Supports dot-notation for nested fields.

```js
runChecks(res, bodyHasField('id'));
runChecks(res, bodyHasField('user.address.city'));
```

### `bodyFieldEquals(fieldPath, expected)`

```js
runChecks(res, bodyFieldEquals('status', 'active'));
runChecks(res, bodyFieldEquals('user.role', 'admin'));
```

### `bodyIsArray()`

```js
runChecks(res, bodyIsArray());
```

### `bodyArrayMinLength(minLength)`

```js
runChecks(res, bodyArrayMinLength(10));
```

## Header Checks

### `hasHeader(headerName)`

Case-insensitive header name matching.

```js
runChecks(res, hasHeader('content-type'));
```

### `headerContains(headerName, substring)`

```js
runChecks(res, headerContains('content-type', 'application/json'));
```

## Combining Checks

```js
// All in one runChecks call
runChecks(res,
  statusIs(200),
  responseTimeLt(500),
  bodyHasField('id'),
  bodyHasField('name'),
  bodyFieldEquals('active', true),
  headerContains('content-type', 'json'),
);

// Build a reusable check set
var userChecks = allChecks(
  statusIs(200),
  bodyHasField('id'),
  bodyHasField('email'),
  bodyHasField('name'),
);

// Reuse across multiple responses
check(res1, userChecks);
check(res2, userChecks);
```

## Custom Checks

For checks not covered by the helpers, use k6's `check()` directly:

```js
import { check } from 'k6';

check(res, {
  'response has pagination': function(r) {
    var body = r.json();
    return body && body.page !== undefined && body.total !== undefined;
  },
  'items count matches total': function(r) {
    var body = r.json();
    return body && body.items.length <= body.pageSize;
  },
});
```

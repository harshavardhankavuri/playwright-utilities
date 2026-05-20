# k6 HTTP Utilities (`k6/lib/http.js`)

Wrappers around k6's built-in `http` module that add automatic JSON serialisation, default headers, bearer token injection, and URL building.

## Functions

### `buildUrl(base, path, params?)`

Build a full URL with optional query parameters.

```js
import { buildUrl } from '../lib/http.js';

buildUrl('https://api.example.com', '/users');
// → 'https://api.example.com/users'

buildUrl('https://api.example.com', '/posts', { userId: 1, limit: 10 });
// → 'https://api.example.com/posts?userId=1&limit=10'
```

### `get(url, options?)`

```js
import { get } from '../lib/http.js';

var res = get('https://api.example.com/users');
var res = get('https://api.example.com/users', {
  bearerToken: 'my-jwt',
  headers: { 'X-Custom': 'value' },
  tags: { name: 'get-users' },   // groups metrics in k6 output
});
```

### `post(url, body, options?)`

Serialises `body` to JSON automatically.

```js
var res = post('https://api.example.com/users', { name: 'Alice', email: 'alice@test.com' });
var res = post('https://api.example.com/login', { username: 'admin', password: 'secret' }, {
  bearerToken: token,
  tags: { name: 'login' },
});
```

### `put(url, body, options?)` / `patch(url, body, options?)`

Same signature as `post`.

```js
var res = put('https://api.example.com/users/1', { name: 'Alice Updated' });
var res = patch('https://api.example.com/users/1', { name: 'Alice Patched' });
```

### `del(url, options?)`

```js
var res = del('https://api.example.com/users/1');
var res = del('https://api.example.com/users/1', { bearerToken: token });
```

### `mergeHeaders(clientHeaders, requestHeaders, bearerToken?)`

Merge headers with defaults. Used internally but exported for custom scenarios.

```js
var headers = mergeHeaders({}, { 'X-Trace-Id': '123' }, 'my-jwt');
// → { 'Content-Type': 'application/json', Accept: 'application/json',
//     'X-Trace-Id': '123', Authorization: 'Bearer my-jwt' }
```

### `parseJson(res)`

Parse response body as JSON, returning `null` on failure instead of throwing.

```js
var body = parseJson(res);
if (body) console.log(body.id);
```

## Options Object

All HTTP functions accept an optional `options` object:

| Property | Type | Description |
|---|---|---|
| `headers` | `Object` | Additional request headers |
| `bearerToken` | `string` | Injected as `Authorization: Bearer <token>` |
| `tags` | `Object` | k6 metric tags — use `{ name: 'endpoint-name' }` to group metrics |

## Default Headers

Every request automatically includes:

```
Content-Type: application/json
Accept: application/json
```

Override by passing `headers` in options.

## Complete Example

```js
import { get, post, put, del, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyHasField } from '../lib/checks.js';

var BASE = 'https://api.example.com';

export default function () {
  // Create
  var created = post(buildUrl(BASE, '/posts'), {
    title: 'Hello',
    userId: 1,
  }, { tags: { name: 'create-post' } });
  runChecks(created, statusIs(201), bodyHasField('id'));

  // Read
  var post = get(buildUrl(BASE, '/posts/1'), { tags: { name: 'get-post' } });
  runChecks(post, statusIs(200));

  // Update
  var updated = put(buildUrl(BASE, '/posts/1'), { title: 'Updated' });
  runChecks(updated, statusIs(200));

  // Delete
  var deleted = del(buildUrl(BASE, '/posts/1'));
  runChecks(deleted, statusIs(200));
}
```

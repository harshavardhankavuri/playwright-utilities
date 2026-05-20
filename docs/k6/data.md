# k6 Test Data Utilities (`k6/lib/data.js`)

Random data generators and helpers for creating unique, realistic test payloads inside k6 scripts. No external dependencies — works in k6's JS runtime.

## Random Generators

### `randomString(length?)`

Alphanumeric string. Default length: 8.

```js
randomString()    // 'x7k2m9qr'
randomString(16)  // 'a3f8b2c1d9e4f7g6'
```

### `randomInt(min, max)`

Integer between min and max (inclusive).

```js
randomInt(1, 10)      // 7
randomInt(100, 999)   // 452
```

### `randomEmail(domain?)`

```js
randomEmail()              // 'user_x7k2m9@test.com'
randomEmail('example.com') // 'user_a3f8b2@example.com'
```

### `uuid()`

UUID v4 string.

```js
uuid()  // '550e8400-e29b-41d4-a716-446655440000'
```

### `randomName()`

Random full name from a built-in pool.

```js
randomName()  // 'Alice Smith'
```

### `pickRandom(arr)`

Pick a random element from an array.

```js
pickRandom(['GET', 'POST', 'PUT'])  // 'POST'
```

### `pickMany(arr, n)`

Pick N unique random elements.

```js
pickMany(['a', 'b', 'c', 'd'], 2)  // ['c', 'a']
```

## Payload Builder

### `buildPayload(template)`

Build a payload object, calling any function values to generate unique data per iteration.

```js
import { buildPayload, randomString, randomInt } from '../lib/data.js';

var payload = buildPayload({
  title:  function() { return 'Post ' + randomString(6); },
  body:   function() { return 'Created at ' + new Date().toISOString(); },
  userId: randomInt(1, 10),   // evaluated once at call time
  status: 'active',           // static value
});
// → { title: 'Post x7k2m9', body: 'Created at 2025-...', userId: 4, status: 'active' }
```

## Data Feeder

### `feeder(items)`

Round-robin data feeder — cycles through an array, one item per call to `next()`.

```js
import { feeder } from '../lib/data.js';

var users = feeder([
  { username: 'alice', password: 'pass1' },
  { username: 'bob',   password: 'pass2' },
  { username: 'carol', password: 'pass3' },
]);

export default function () {
  var user = users.next();  // alice, bob, carol, alice, bob, ...
  // login with user.username / user.password
}
```

## Complete Example

```js
import { sleep } from 'k6';
import { post, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyHasField } from '../lib/checks.js';
import { randomString, randomInt, randomEmail, buildPayload, feeder } from '../lib/data.js';

var BASE_URL = 'https://api.example.com';

// Pre-defined user pool — each VU gets a different user
var userPool = feeder([
  { id: 1, token: 'token-alice' },
  { id: 2, token: 'token-bob' },
  { id: 3, token: 'token-carol' },
]);

export default function () {
  var user = userPool.next();

  var payload = buildPayload({
    title:    function() { return 'Test ' + randomString(8); },
    body:     function() { return 'Content ' + randomString(20); },
    authorId: user.id,
    tags:     function() { return [randomString(4), randomString(4)]; },
  });

  var res = post(buildUrl(BASE_URL, '/posts'), payload, {
    bearerToken: user.token,
    tags: { name: 'create-post' },
  });

  runChecks(res, statusIs(201), bodyHasField('id'));
  sleep(randomInt(1, 3) * 0.1);
}
```

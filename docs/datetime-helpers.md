# DateTime Helpers

**File:** `src/main/utils/datetime-helpers.ts`

## Overview

DateTime Helpers provide utilities for testing time-dependent UI behavior: freezing/advancing the browser clock, formatting dates for assertions, navigating date pickers, and simulating timezones. Built on Playwright's `page.clock` API for deterministic time control.

## How It Works

**Clock control** uses Playwright's built-in clock API (`page.clock.setFixedTime`, `page.clock.install`, `page.clock.fastForward`). When frozen, all browser-side time functions (`Date.now()`, `new Date()`, `setTimeout`, `setInterval`) use the mocked time.

**Date formatting** is a simple token-replacement system (no external libraries). Tokens like `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` are replaced with values from the Date object.

**Date picker navigation** uses a generic algorithm: read the currently displayed month, compare to target, click next/prev until aligned, then click the target day.

## Configuration

### Timezone constants

```typescript
import { TIMEZONES } from '@utils/datetime-helpers';

// Available presets:
TIMEZONES.UTC              // 'UTC'
TIMEZONES.US_EASTERN       // 'America/New_York'
TIMEZONES.US_CENTRAL       // 'America/Chicago'
TIMEZONES.US_PACIFIC       // 'America/Los_Angeles'
TIMEZONES.UK               // 'Europe/London'
TIMEZONES.CENTRAL_EUROPE   // 'Europe/Berlin'
TIMEZONES.INDIA            // 'Asia/Kolkata'
TIMEZONES.JAPAN            // 'Asia/Tokyo'
TIMEZONES.AUSTRALIA        // 'Australia/Sydney'
```

Set timezone in `playwright.config.ts`:

```typescript
use: { timezoneId: TIMEZONES.US_EASTERN }
```

## Usage Examples

### Freeze clock at a specific time

```typescript
import { freezeClock } from '@utils/datetime-helpers';

await freezeClock(page, '2025-06-15T10:30:00Z');

// All Date calls in the browser now return this time
const time = await page.evaluate(() => new Date().toISOString());
// → '2025-06-15T10:30:00.000Z'
```

### Install and advance clock

```typescript
import { installClock, advanceClock, resumeClock } from '@utils/datetime-helpers';

await installClock(page, '2025-01-01T00:00:00Z');

// Advance by 5 seconds
await advanceClock(page, 5000);

// Advance by 1 hour
await advanceClock(page, 60 * 60 * 1000);

// Resume real time
await resumeClock(page);
```

### Set clock without freezing

```typescript
import { setClockTime } from '@utils/datetime-helpers';

// Time continues advancing from this point
await setClockTime(page, '2025-12-31T23:59:00Z');
```

### Date formatting for assertions

```typescript
import { formatDate, today, relativeDate, relativeTo } from '@utils/datetime-helpers';

formatDate('2025-06-15', 'MM/DD/YYYY');     // '06/15/2025'
formatDate('2025-06-15', 'D MMM YYYY');     // '15 06 2025'
formatDate(new Date(), 'YYYY-MM-DD HH:mm'); // '2025-06-15 10:30'

today('MM/DD/YYYY');                         // Today's date formatted
relativeDate(7, 'YYYY-MM-DD');              // 7 days from now
relativeDate(-30, 'MM/DD/YYYY');            // 30 days ago

relativeTo('2025-01-01', { months: 3, days: 15 }, 'YYYY-MM-DD'); // '2025-04-16'
```

### Fill native date inputs

```typescript
import { fillDateInput, fillDateTimeInput, fillTimeInput } from '@utils/datetime-helpers';

await fillDateInput(page, '#birth-date', '1990-05-20');
await fillDateTimeInput(page, '#appointment', '2025-06-15T14:30');
await fillTimeInput(page, '#alarm', '07:30');
```

### Navigate a custom date picker

```typescript
import { selectDateInPicker } from '@utils/datetime-helpers';

await selectDateInPicker(page, {
  triggerSelector: '#date-field',
  targetDate: '2025-03-15',
  nextMonthSelector: 'button[aria-label="Next month"]',
  prevMonthSelector: 'button[aria-label="Previous month"]',
  daySelector: (day) => `button:has-text("${day}")`,
  currentMonthSelector: '.calendar-header-label',
  maxNavigations: 24,
});
```

### SauceDemo example — test session expiry

```typescript
test('session expires after 30 minutes', async ({ page }) => {
  await installClock(page, '2025-01-01T10:00:00Z');
  await page.goto('/inventory.html');

  // Advance past session timeout
  await advanceClock(page, 31 * 60 * 1000);

  // Trigger a navigation that checks session
  await page.reload();
  await expect(page).toHaveURL(/login/);
});
```

## Format Tokens

| Token | Output | Example |
|-------|--------|---------|
| `YYYY` | 4-digit year | `2025` |
| `YY` | 2-digit year | `25` |
| `MM` | Month (zero-padded) | `06` |
| `M` | Month | `6` |
| `DD` | Day (zero-padded) | `05` |
| `D` | Day | `5` |
| `HH` | Hour 24h (zero-padded) | `14` |
| `hh` | Hour 12h (zero-padded) | `02` |
| `mm` | Minutes | `30` |
| `ss` | Seconds | `45` |
| `A` | AM/PM | `PM` |
| `a` | am/pm | `pm` |

## Tips & Best Practices

- Freeze the clock BEFORE navigating to the page — some apps read time on initial load.
- Use `installClock` + `advanceClock` for testing timeouts, countdowns, and session expiry.
- Combine `freezeClock` with `formatDate` to build expected values: `formatDate('2025-06-15', 'MM/DD/YYYY')` matches what the frozen UI should display.
- Set timezone in config (not per-test) for consistency across the entire suite.
- The `selectDateInPicker` helper works with most calendar UIs (Material, Ant Design, custom) — just provide the right selectors.

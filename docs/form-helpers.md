# Form Helpers

Utilities for filling, submitting, and validating HTML forms. Handles all standard input types including text, select, checkbox, radio, file upload, and range sliders.

---

## Smart Form Fill

### `fillField(locator, value)`

Fill a single field intelligently based on its type. Handles text, email, password, number, date, select, checkbox, radio, and textarea.

```typescript
import { fillField } from './src/main/utils';

await fillField(page.locator('#email'), 'user@test.com');
await fillField(page.locator('select#country'), 'US');
await fillField(page.locator('#agree'), true);          // checkbox
await fillField(page.locator('#quantity'), 5);          // number
```

---

### `fillForm(page, data)`

Fill an entire form using a data map. Matches fields by `name`, `id`, `aria-label`, or `placeholder`.

```typescript
import { fillForm } from './src/main/utils';

await fillForm(page, {
  email: 'user@test.com',
  password: 'secret123',
  country: 'US',
  newsletter: true,
  age: 30,
});
```

---

## Select Helpers

### `selectByText(locator, text)`

Select an option by its visible label text.

```typescript
import { selectByText, selectByValue, selectByIndex, selectMultiple } from './src/main/utils';

await selectByText(page.locator('select#country'), 'United States');
await selectByValue(page.locator('select#country'), 'US');
await selectByIndex(page.locator('select#country'), 2);

// Multi-select
await selectMultiple(page.locator('select#tags'), ['javascript', 'typescript', 'playwright']);
```

### `getSelectOptions(locator)`

Get all available options from a select element.

```typescript
import { getSelectOptions, getSelectedOptions } from './src/main/utils';

const options = await getSelectOptions(page.locator('select#country'));
// [{ value: 'US', text: 'United States', selected: true, disabled: false }, ...]

const selected = await getSelectedOptions(page.locator('select#tags'));
// [{ value: 'js', text: 'JavaScript' }]
```

---

## Checkbox Helpers

```typescript
import { checkBox, uncheckBox, toggleCheckbox, checkByLabels, getCheckedValues } from './src/main/utils';

await checkBox(page.locator('#agree'));           // Check if not already checked
await uncheckBox(page.locator('#newsletter'));    // Uncheck if checked
await toggleCheckbox(page.locator('#option'));   // Toggle state

// Check multiple by label text
await checkByLabels(page, ['Accept Terms', 'Subscribe to newsletter']);

// Get all checked values in a container
const checked = await getCheckedValues(page.locator('form#preferences'));
// ['option1', 'option3']
```

---

## Radio Group Helpers

```typescript
import { selectRadio, selectRadioByLabel, getSelectedRadio } from './src/main/utils';

await selectRadio(page, 'payment', 'credit-card');
await selectRadioByLabel(page, 'Credit Card');

const selected = await getSelectedRadio(page, 'payment');
// 'credit-card'
```

---

## File Upload Helpers

```typescript
import { uploadFile, uploadFiles, clearFileInput, uploadBuffer } from './src/main/utils';

// Upload from disk
await uploadFile(page.locator('input[type="file"]'), './test-data/sample.pdf');

// Upload multiple files
await uploadFiles(page.locator('input[type="file"]'), ['./a.jpg', './b.jpg']);

// Clear file input
await clearFileInput(page.locator('input[type="file"]'));

// Upload from Buffer (no disk file needed)
await uploadBuffer(
  page.locator('input[type="file"]'),
  'test.csv',
  Buffer.from('name,age\nAlice,30'),
  'text/csv',
);
```

---

## Form Validation

### `getFormValidationState(formLocator)`

Get the HTML5 validation state of all fields in a form.

```typescript
import { getFormValidationState } from './src/main/utils';

const state = await getFormValidationState(page.locator('form#signup'));
expect(state.isValid).toBe(true);

// On failure:
// state.invalidFields = [
//   { name: 'email', id: 'email', validationMessage: 'Please enter a valid email', value: 'bad' }
// ]
```

### `expectValidationMessage(locator, message)`

Assert a field shows a specific validation error.

```typescript
import { expectValidationMessage, expectFieldInvalid, expectFieldValid } from './src/main/utils';

await expectValidationMessage(page.locator('#email'), 'Please enter a valid email');
await expectFieldInvalid(page.locator('#email'));
await expectFieldValid(page.locator('#name'));
```

---

## Form Data Extraction

```typescript
import { extractFormData, clearForm, submitForm, clickSubmit } from './src/main/utils';

// Get all field values
const data = await extractFormData(page.locator('form#signup'));
// { email: 'user@test.com', country: 'US', newsletter: 'on' }

// Clear all fields
await clearForm(page.locator('form#search'));

// Submit programmatically
await submitForm(page.locator('form#login'));

// Click the submit button
await clickSubmit(page.locator('form#login'));
```

---

## Range / Slider Helpers

```typescript
import { setSliderValue, getSliderValue, getSliderRange } from './src/main/utils';

await setSliderValue(page.locator('input[type="range"]#volume'), 75);

const value = await getSliderValue(page.locator('#volume'));
// 75

const range = await getSliderRange(page.locator('#volume'));
// { min: 0, max: 100, step: 1 }
```

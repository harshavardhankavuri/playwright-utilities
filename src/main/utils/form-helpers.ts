import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Form Helpers — Utilities for filling, submitting, and validating HTML forms.
 *
 * Covers:
 * - Smart form filling (auto-detect field types)
 * - Select/multi-select helpers
 * - Checkbox and radio group helpers
 * - File upload helpers
 * - Form validation state assertions
 * - Form data extraction
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A map of field name/label → value for bulk form filling.
 */
export type FormData = Record<string, string | string[] | boolean | number>;

/**
 * Result of form validation state inspection.
 */
export interface FormValidationState {
  /** Whether the form is valid (all fields pass HTML5 validation) */
  isValid: boolean;
  /** Fields with validation errors */
  invalidFields: Array<{
    name: string;
    id: string;
    validationMessage: string;
    value: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART FORM FILL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill a form field intelligently based on its type.
 * Handles text, email, password, number, date, select, checkbox, radio, textarea.
 *
 * Usage:
 *   await fillField(page.locator('#email'), 'user@test.com');
 *   await fillField(page.locator('select#country'), 'US');
 *   await fillField(page.locator('#agree'), true);
 */
export async function fillField(locator: Locator, value: string | boolean | number): Promise<void> {
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
  const inputType = await locator.getAttribute('type');

  if (tagName === 'select') {
    await locator.selectOption(String(value));
    return;
  }

  if (tagName === 'textarea') {
    await locator.fill(String(value));
    return;
  }

  if (inputType === 'checkbox' || inputType === 'radio') {
    const shouldCheck = typeof value === 'boolean' ? value : value === 'true' || value === '1';
    const isChecked = await locator.isChecked();
    if (shouldCheck !== isChecked) {
      await locator.click();
    }
    return;
  }

  if (inputType === 'file') {
    await locator.setInputFiles(String(value));
    return;
  }

  // Default: fill as text
  await locator.fill(String(value));
}

/**
 * Fill an entire form using a data map.
 * Matches fields by name attribute, id, aria-label, or placeholder.
 *
 * Usage:
 *   await fillForm(page, {
 *     email: 'user@test.com',
 *     password: 'secret123',
 *     country: 'US',
 *     newsletter: true,
 *   });
 */
export async function fillForm(page: Page, data: FormData): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    // Try multiple strategies to find the field
    const strategies = [
      () => page.locator(`[name="${key}"]`),
      () => page.locator(`#${key}`),
      () => page.getByLabel(key, { exact: false }),
      () => page.getByPlaceholder(key, { exact: false }),
    ];

    let filled = false;
    for (const strategy of strategies) {
      const locator = strategy();
      if (await locator.count() > 0) {
        if (Array.isArray(value)) {
          await locator.selectOption(value.map(String));
        } else {
          await fillField(locator.first(), value);
        }
        filled = true;
        break;
      }
    }

    if (!filled) {
      console.warn(`[fillForm] Could not find field: "${key}"`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select an option by its visible text (partial match).
 *
 * Usage:
 *   await selectByText(page.locator('select#country'), 'United States');
 */
export async function selectByText(locator: Locator, text: string): Promise<void> {
  await locator.selectOption({ label: text });
}

/**
 * Select an option by its value attribute.
 *
 * Usage:
 *   await selectByValue(page.locator('select#country'), 'US');
 */
export async function selectByValue(locator: Locator, value: string): Promise<void> {
  await locator.selectOption({ value });
}

/**
 * Select an option by its index (0-based).
 *
 * Usage:
 *   await selectByIndex(page.locator('select#country'), 2);
 */
export async function selectByIndex(locator: Locator, index: number): Promise<void> {
  await locator.selectOption({ index });
}

/**
 * Select multiple options in a multi-select.
 *
 * Usage:
 *   await selectMultiple(page.locator('select#tags'), ['javascript', 'typescript']);
 */
export async function selectMultiple(locator: Locator, values: string[]): Promise<void> {
  await locator.selectOption(values);
}

/**
 * Get all available options from a select element.
 *
 * Usage:
 *   const options = await getSelectOptions(page.locator('select#country'));
 *   // [{ value: 'US', text: 'United States', selected: true }, ...]
 */
export async function getSelectOptions(
  locator: Locator,
): Promise<Array<{ value: string; text: string; selected: boolean; disabled: boolean }>> {
  return locator.evaluate((el) => {
    const select = el as HTMLSelectElement;
    return Array.from(select.options).map((opt) => ({
      value: opt.value,
      text: opt.text.trim(),
      selected: opt.selected,
      disabled: opt.disabled,
    }));
  });
}

/**
 * Get the currently selected option(s) from a select element.
 */
export async function getSelectedOptions(
  locator: Locator,
): Promise<Array<{ value: string; text: string }>> {
  return locator.evaluate((el) => {
    const select = el as HTMLSelectElement;
    return Array.from(select.selectedOptions).map((opt) => ({
      value: opt.value,
      text: opt.text.trim(),
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKBOX HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check a checkbox if it's not already checked.
 */
export async function checkBox(locator: Locator): Promise<void> {
  if (!(await locator.isChecked())) {
    await locator.check();
  }
}

/**
 * Uncheck a checkbox if it's currently checked.
 */
export async function uncheckBox(locator: Locator): Promise<void> {
  if (await locator.isChecked()) {
    await locator.uncheck();
  }
}

/**
 * Toggle a checkbox (check if unchecked, uncheck if checked).
 */
export async function toggleCheckbox(locator: Locator): Promise<void> {
  await locator.click();
}

/**
 * Check multiple checkboxes by their labels.
 *
 * Usage:
 *   await checkByLabels(page, ['Accept Terms', 'Subscribe to newsletter']);
 */
export async function checkByLabels(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) {
    await page.getByLabel(label).check();
  }
}

/**
 * Get all checked checkboxes within a container.
 */
export async function getCheckedValues(container: Locator | Page): Promise<string[]> {
  const locator = 'locator' in container
    ? (container as Page).locator('input[type="checkbox"]:checked')
    : (container as Locator).locator('input[type="checkbox"]:checked');

  const count = await locator.count();
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    const value = await locator.nth(i).getAttribute('value');
    if (value) values.push(value);
  }
  return values;
}

// ─────────────────────────────────────────────────────────────────────────────
// RADIO GROUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select a radio button by its value within a named group.
 *
 * Usage:
 *   await selectRadio(page, 'payment', 'credit-card');
 */
export async function selectRadio(page: Page, groupName: string, value: string): Promise<void> {
  await page.locator(`input[type="radio"][name="${groupName}"][value="${value}"]`).check();
}

/**
 * Select a radio button by its label text.
 *
 * Usage:
 *   await selectRadioByLabel(page, 'Credit Card');
 */
export async function selectRadioByLabel(page: Page, labelText: string): Promise<void> {
  await page.getByLabel(labelText).check();
}

/**
 * Get the currently selected radio value in a group.
 *
 * Usage:
 *   const selected = await getSelectedRadio(page, 'payment');
 *   // 'credit-card'
 */
export async function getSelectedRadio(page: Page, groupName: string): Promise<string | null> {
  const checked = page.locator(`input[type="radio"][name="${groupName}"]:checked`);
  if (await checked.count() === 0) return null;
  return checked.getAttribute('value');
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file to a file input.
 *
 * Usage:
 *   await uploadFile(page.locator('input[type="file"]'), './test-data/sample.pdf');
 */
export async function uploadFile(locator: Locator, filePath: string): Promise<void> {
  await locator.setInputFiles(filePath);
}

/**
 * Upload multiple files to a file input.
 *
 * Usage:
 *   await uploadFiles(page.locator('input[type="file"]'), ['./a.jpg', './b.jpg']);
 */
export async function uploadFiles(locator: Locator, filePaths: string[]): Promise<void> {
  await locator.setInputFiles(filePaths);
}

/**
 * Clear a file input (remove selected files).
 */
export async function clearFileInput(locator: Locator): Promise<void> {
  await locator.setInputFiles([]);
}

/**
 * Upload a file from a Buffer (no disk file needed).
 *
 * Usage:
 *   await uploadBuffer(page.locator('input[type="file"]'), 'test.csv', Buffer.from('a,b\n1,2'));
 */
export async function uploadBuffer(
  locator: Locator,
  fileName: string,
  content: Buffer | string,
  mimeType: string = 'application/octet-stream',
): Promise<void> {
  await locator.setInputFiles({
    name: fileName,
    mimeType,
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the HTML5 validation state of all form fields.
 * Returns which fields are invalid and their validation messages.
 *
 * Usage:
 *   const state = await getFormValidationState(page.locator('form#signup'));
 *   expect(state.isValid).toBe(true);
 */
export async function getFormValidationState(
  formLocator: Locator,
): Promise<FormValidationState> {
  return formLocator.evaluate((form) => {
    const inputs = form.querySelectorAll('input, textarea, select');
    const invalidFields: FormValidationState['invalidFields'] = [];

    for (const input of inputs) {
      const el = input as HTMLInputElement;
      if (!el.validity.valid) {
        invalidFields.push({
          name: el.name || '',
          id: el.id || '',
          validationMessage: el.validationMessage,
          value: el.value,
        });
      }
    }

    return {
      isValid: invalidFields.length === 0,
      invalidFields,
    };
  });
}

/**
 * Assert a form field shows a specific validation error message.
 *
 * Usage:
 *   await expectValidationMessage(page.locator('#email'), 'Please enter a valid email');
 */
export async function expectValidationMessage(
  locator: Locator,
  expectedMessage: string | RegExp,
): Promise<void> {
  const message = await locator.evaluate(
    (el) => (el as HTMLInputElement).validationMessage,
  );

  if (typeof expectedMessage === 'string') {
    expect(message).toContain(expectedMessage);
  } else {
    expect(message).toMatch(expectedMessage);
  }
}

/**
 * Assert a field is in an invalid state (has :invalid CSS pseudo-class).
 */
export async function expectFieldInvalid(locator: Locator): Promise<void> {
  const isInvalid = await locator.evaluate(
    (el) => !(el as HTMLInputElement).validity.valid,
  );
  expect(isInvalid).toBe(true);
}

/**
 * Assert a field is in a valid state.
 */
export async function expectFieldValid(locator: Locator): Promise<void> {
  const isValid = await locator.evaluate(
    (el) => (el as HTMLInputElement).validity.valid,
  );
  expect(isValid).toBe(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM DATA EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all form field values as a key-value map.
 * Keys are field names; values are the current field values.
 *
 * Usage:
 *   const data = await extractFormData(page.locator('form#signup'));
 *   // { email: 'user@test.com', country: 'US', newsletter: 'on' }
 */
export async function extractFormData(formLocator: Locator): Promise<Record<string, string>> {
  return formLocator.evaluate((form) => {
    const data: Record<string, string> = {};
    const formEl = form as HTMLFormElement;
    const formData = new FormData(formEl);
    formData.forEach((value, key) => {
      data[key] = String(value);
    });
    return data;
  });
}

/**
 * Clear all fields in a form.
 *
 * Usage:
 *   await clearForm(page.locator('form#search'));
 */
export async function clearForm(formLocator: Locator): Promise<void> {
  await formLocator.evaluate((form) => {
    const inputs = form.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), textarea');
    for (const input of inputs) {
      const el = input as HTMLInputElement;
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = false;
      } else {
        el.value = '';
      }
    }
    const selects = form.querySelectorAll('select');
    for (const select of selects) {
      (select as HTMLSelectElement).selectedIndex = 0;
    }
  });
}

/**
 * Submit a form programmatically (bypasses submit button click).
 *
 * Usage:
 *   await submitForm(page.locator('form#login'));
 */
export async function submitForm(formLocator: Locator): Promise<void> {
  await formLocator.evaluate((form) => {
    (form as HTMLFormElement).submit();
  });
}

/**
 * Click the submit button within a form.
 *
 * Usage:
 *   await clickSubmit(page.locator('form#login'));
 */
export async function clickSubmit(formLocator: Locator): Promise<void> {
  await formLocator
    .locator('button[type="submit"], input[type="submit"]')
    .first()
    .click();
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGE / SLIDER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the value of a range input (slider) to a specific value.
 * Fires both 'input' and 'change' events.
 *
 * Usage:
 *   await setSliderValue(page.locator('input[type="range"]#volume'), 75);
 */
export async function setSliderValue(locator: Locator, value: number): Promise<void> {
  await locator.evaluate((el, val) => {
    const input = el as HTMLInputElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )?.set;
    nativeInputValueSetter?.call(input, String(val));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/**
 * Get the current value of a range input.
 */
export async function getSliderValue(locator: Locator): Promise<number> {
  const value = await locator.inputValue();
  return parseFloat(value);
}

/**
 * Get the min/max/step attributes of a range input.
 */
export async function getSliderRange(
  locator: Locator,
): Promise<{ min: number; max: number; step: number }> {
  return locator.evaluate((el) => {
    const input = el as HTMLInputElement;
    return {
      min: parseFloat(input.min || '0'),
      max: parseFloat(input.max || '100'),
      step: parseFloat(input.step || '1'),
    };
  });
}

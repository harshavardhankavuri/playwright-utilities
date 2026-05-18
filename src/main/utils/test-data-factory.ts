/**
 * Test Data Factory — Generate realistic, reproducible test data.
 *
 * Features:
 * - Seeded randomness for reproducibility (same seed = same data)
 * - Realistic fake data (names, emails, addresses, phones, etc.)
 * - Composable builders for complex objects
 * - No external dependencies (no faker.js needed)
 */

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RANDOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Same seed always produces the same sequence.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a float between 0 (inclusive) and 1 (exclusive). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer between min (inclusive) and max (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick N unique elements from an array. */
  pickMany<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => this.next() - 0.5);
    return shuffled.slice(0, count);
  }

  /** Generate a random string of given length. */
  string(length: number, chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, chars.length - 1)];
    }
    return result;
  }

  /** Returns true with the given probability (0-1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA POOLS
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Steven', 'Sandra', 'Andrew', 'Ashley',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
];

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.com', 'example.com', 'company.org'];

const STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr',
  'Pine St', 'Washington Ave', 'Lake Rd', 'Hill St', 'River Rd', 'Forest Dr',
];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Denver', 'Seattle',
];

const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'WA', 'CO'];

const COUNTRIES = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX'];

const COMPANY_SUFFIXES = ['Inc', 'LLC', 'Corp', 'Ltd', 'Group', 'Solutions', 'Technologies'];

const PRODUCTS = [
  'Widget', 'Gadget', 'Doohickey', 'Thingamajig', 'Gizmo', 'Contraption',
  'Device', 'Apparatus', 'Instrument', 'Module', 'Component', 'Assembly',
];

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TestDataFactory — Generate realistic test data with optional seeding.
 *
 * Usage:
 *   const data = new TestDataFactory();          // Random seed each run
 *   const data = new TestDataFactory(12345);     // Reproducible sequence
 *
 *   data.person();       // { firstName, lastName, email, phone, ... }
 *   data.email();        // 'james.smith42@gmail.com'
 *   data.address();      // { street, city, state, zip, country }
 *   data.creditCard();   // { number, expiry, cvv, holder }
 *   data.uuid();         // '550e8400-e29b-41d4-a716-446655440000'
 */
export class TestDataFactory {
  private rng: SeededRandom;

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed ?? Date.now());
  }

  /** Reset with a new seed for reproducibility. */
  reseed(seed: number): this {
    this.rng = new SeededRandom(seed);
    return this;
  }

  // ─── People ─────────────────────────────────────────────────────────────

  firstName(): string {
    return this.rng.pick(FIRST_NAMES);
  }

  lastName(): string {
    return this.rng.pick(LAST_NAMES);
  }

  fullName(): string {
    return `${this.firstName()} ${this.lastName()}`;
  }

  email(firstName?: string, lastName?: string): string {
    const first = (firstName || this.firstName()).toLowerCase();
    const last = (lastName || this.lastName()).toLowerCase();
    const num = this.rng.int(1, 999);
    const domain = this.rng.pick(DOMAINS);
    return `${first}.${last}${num}@${domain}`;
  }

  phone(): string {
    const area = this.rng.int(200, 999);
    const prefix = this.rng.int(200, 999);
    const line = this.rng.int(1000, 9999);
    return `(${area}) ${prefix}-${line}`;
  }

  username(): string {
    const first = this.firstName().toLowerCase();
    const num = this.rng.int(1, 9999);
    return `${first}${num}`;
  }

  password(length: number = 12): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    return this.rng.string(length, chars);
  }

  person(): {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    username: string;
  } {
    const first = this.firstName();
    const last = this.lastName();
    return {
      firstName: first,
      lastName: last,
      email: this.email(first, last),
      phone: this.phone(),
      username: this.username(),
    };
  }

  // ─── Addresses ──────────────────────────────────────────────────────────

  address(): {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } {
    return {
      street: `${this.rng.int(100, 9999)} ${this.rng.pick(STREETS)}`,
      city: this.rng.pick(CITIES),
      state: this.rng.pick(STATES),
      zip: this.rng.int(10000, 99999).toString(),
      country: this.rng.pick(COUNTRIES),
    };
  }

  // ─── Finance ────────────────────────────────────────────────────────────

  creditCard(): {
    number: string;
    expiry: string;
    cvv: string;
    holder: string;
  } {
    const prefixes = ['4', '5', '37', '6011'];
    const prefix = this.rng.pick(prefixes);
    const remaining = 16 - prefix.length;
    const number = prefix + this.rng.string(remaining, '0123456789');
    const month = this.rng.int(1, 12).toString().padStart(2, '0');
    const year = this.rng.int(26, 30);

    return {
      number: number.replace(/(.{4})/g, '$1 ').trim(),
      expiry: `${month}/${year}`,
      cvv: this.rng.string(prefix === '37' ? 4 : 3, '0123456789'),
      holder: this.fullName().toUpperCase(),
    };
  }

  price(min: number = 1, max: number = 999): string {
    const dollars = this.rng.int(min, max);
    const cents = this.rng.int(0, 99);
    return `${dollars}.${cents.toString().padStart(2, '0')}`;
  }

  // ─── Identifiers ────────────────────────────────────────────────────────

  uuid(): string {
    const hex = () => this.rng.string(4, '0123456789abcdef');
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${this.rng.pick(['8', '9', 'a', 'b'])}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
  }

  id(length: number = 8): string {
    return this.rng.string(length, '0123456789abcdef');
  }

  numericId(min: number = 1, max: number = 99999): number {
    return this.rng.int(min, max);
  }

  // ─── Text ───────────────────────────────────────────────────────────────

  sentence(wordCount: number = 8): string {
    const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
      'a', 'big', 'red', 'car', 'drives', 'fast', 'down', 'road',
      'she', 'sells', 'sea', 'shells', 'by', 'shore', 'every', 'day'];
    const selected = Array.from({ length: wordCount }, () => this.rng.pick(words));
    selected[0] = selected[0].charAt(0).toUpperCase() + selected[0].slice(1);
    return selected.join(' ') + '.';
  }

  paragraph(sentenceCount: number = 4): string {
    return Array.from({ length: sentenceCount }, () => this.sentence(this.rng.int(6, 12))).join(' ');
  }

  // ─── Business ───────────────────────────────────────────────────────────

  company(): string {
    return `${this.lastName()} ${this.rng.pick(COMPANY_SUFFIXES)}`;
  }

  product(): string {
    const adj = this.rng.pick(['Premium', 'Ultra', 'Pro', 'Basic', 'Advanced', 'Smart']);
    return `${adj} ${this.rng.pick(PRODUCTS)}`;
  }

  // ─── Dates ──────────────────────────────────────────────────────────────

  pastDate(daysBack: number = 365): Date {
    const now = Date.now();
    const offset = this.rng.int(1, daysBack) * 24 * 60 * 60 * 1000;
    return new Date(now - offset);
  }

  futureDate(daysAhead: number = 365): Date {
    const now = Date.now();
    const offset = this.rng.int(1, daysAhead) * 24 * 60 * 60 * 1000;
    return new Date(now + offset);
  }

  dateString(format: string = 'YYYY-MM-DD'): string {
    const d = this.rng.chance(0.5) ? this.pastDate(30) : this.futureDate(30);
    return format
      .replace('YYYY', d.getFullYear().toString())
      .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', d.getDate().toString().padStart(2, '0'));
  }

  // ─── Collections ────────────────────────────────────────────────────────

  /** Generate an array of N items using a builder function. */
  many<T>(count: number, builder: (index: number) => T): T[] {
    return Array.from({ length: count }, (_, i) => builder(i));
  }

  /** Pick a random item from a custom array. */
  oneOf<T>(items: T[]): T {
    return this.rng.pick(items);
  }

  /** Generate a boolean with given probability of being true. */
  bool(trueProbability: number = 0.5): boolean {
    return this.rng.chance(trueProbability);
  }

  /** Generate a random integer in range. */
  int(min: number, max: number): number {
    return this.rng.int(min, max);
  }
}

/** Singleton instance with random seed (convenient for quick use). */
export const testData = new TestDataFactory();

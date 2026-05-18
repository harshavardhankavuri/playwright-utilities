/**
 * Extracts X-Ray test keys from test titles.
 *
 * Convention: [PROJ-123] or [PROJ-1,PROJ-2] or [PROJ-1/2/3] in the title.
 */

const BRACKET_RE = /\[([A-Z][A-Z0-9]*-[^\]]+)\]/g;
const FULL_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/;
const BARE_NUM_RE = /^\d+$/;

/**
 * Stage 2: expand the inner content of a bracket group into individual keys.
 * Supports comma and slash separators, bare numbers inherit the last-seen prefix.
 *
 * Examples:
 *   "PROJ-1,PROJ-2"   → ["PROJ-1", "PROJ-2"]
 *   "PROJ-1/2/3"      → ["PROJ-1", "PROJ-2", "PROJ-3"]
 *   "PROJ-10,20"      → ["PROJ-10", "PROJ-20"]
 */
export function expandBracketContent(inner: string): string[] {
  const results: string[] = [];
  let lastPrefix = '';

  const tokens = inner.split(/[,/]/).map((t) => t.trim());

  for (const token of tokens) {
    if (!token) continue;

    if (FULL_KEY_RE.test(token)) {
      // Full key like PROJ-123
      const dashIdx = token.lastIndexOf('-');
      lastPrefix = token.substring(0, dashIdx + 1); // "PROJ-"
      results.push(token);
    } else if (BARE_NUM_RE.test(token) && lastPrefix) {
      // Bare number inherits last prefix
      results.push(`${lastPrefix}${token}`);
    }
    // Non-matching tokens are skipped
  }

  return results;
}

/**
 * Extract all X-Ray test IDs from a test title.
 * Returns deduplicated keys in insertion order.
 */
export function extractTestIds(title: string, pattern?: RegExp): string[] {
  const regex = pattern ?? BRACKET_RE;
  const seen = new Set<string>();
  const keys: string[] = [];

  // Reset lastIndex for global regex
  regex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(title)) !== null) {
    const inner = match[1];
    const expanded = expandBracketContent(inner);
    for (const key of expanded) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  return keys;
}

/**
 * Strip test ID brackets from a title, normalizing whitespace.
 */
export function stripTestIds(title: string, pattern?: RegExp): string {
  const regex = pattern ?? BRACKET_RE;
  return title.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
}

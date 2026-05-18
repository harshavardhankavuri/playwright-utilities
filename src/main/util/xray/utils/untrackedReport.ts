import * as fs from 'fs';
import * as path from 'path';
import type { Logger, UntrackedTest, XRayTestResult } from '../types';

/**
 * Writes a plain-text report of tests that have no X-Ray key in their title.
 */
export function writeUntrackedReport(
  tests: UntrackedTest[],
  outputFile: string,
  log: Logger,
): void {
  try {
    const dir = path.dirname(outputFile);
    fs.mkdirSync(dir, { recursive: true });

    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════════════',
      '  UNTRACKED TESTS — No X-Ray key found in title',
      '═══════════════════════════════════════════════════════════════════════',
      '',
    ];

    for (const t of tests) {
      lines.push(`  Title:    ${t.title}`);
      lines.push(`  File:     ${t.filePath}`);
      lines.push(`  Status:   ${t.status}`);
      lines.push(`  Duration: ${t.duration}ms`);
      lines.push('  ───────────────────────────────────────────────────────────────');
    }

    lines.push('');
    lines.push(`  Total untracked: ${tests.length}`);
    lines.push('');

    fs.writeFileSync(outputFile, lines.join('\n'), 'utf-8');
    log.info(`Untracked report written to ${outputFile}`);
  } catch (err) {
    log.warn(`Failed to write untracked report: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Prints a formatted summary box to the console.
 */
export function printSummary(
  log: Logger,
  executionKey: string | null,
  totalCount: number,
  trackedResults: XRayTestResult[],
  untrackedList: UntrackedTest[],
): void {
  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const r of trackedResults) {
    switch (r.status) {
      case 'PASS':
        pass++;
        break;
      case 'FAIL':
        fail++;
        break;
      case 'TODO':
        skip++;
        break;
      default:
        break;
    }
  }

  const lines: string[] = [
    '',
    '╔═══════════════════════════════════════════════════════════════════════╗',
    '║                     X-Ray Integration Summary                       ║',
    '╠═══════════════════════════════════════════════════════════════════════╣',
    `║  Execution Key : ${executionKey ?? 'N/A'}`,
    `║  Total Tests   : ${totalCount}`,
    `║  Tracked       : ${trackedResults.length} (✔ ${pass} | ✖ ${fail} | ⊘ ${skip})`,
    `║  Untracked     : ${untrackedList.length}`,
  ];

  if (untrackedList.length > 0) {
    lines.push('║  ─────────────────────────────────────────────────────────────────');
    lines.push('║  Untracked titles:');
    for (const t of untrackedList) {
      const truncated = t.title.length > 68 ? t.title.substring(0, 68) + '…' : t.title;
      lines.push(`║    • ${truncated}`);
    }
  }

  lines.push('╚═══════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  log.info(lines.join('\n'));
}

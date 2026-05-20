import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type {
  Logger,
  ResolvedConfig,
  UntrackedTest,
  XRayImportPayload,
  XRayTestResult,
  XRayUserConfig,
} from '../types';
import { XRayClient } from '../client/xrayClient';
import { resolveConfig } from '../utils/configResolver';
import { createLogger } from '../utils/logger';
import { extractScreenshots, screenshotToEvidence } from '../utils/screenshotHelper';
import { extractTestIds } from '../utils/testIdExtractor';
import { printSummary, writeUntrackedReport } from '../utils/untrackedReport';

// ─── Per-test streaming flow ──────────────────────────────────────────────────
//
// For every test that finishes:
//   1. Extract X-Ray key(s) from the title
//   2. If no key → mark as untracked, skip X-Ray
//   3. If execution key exists:
//        a. Ensure the test is linked to the execution (add if missing)
//        b. Import the result immediately (single-test batch)
//        c. If failed + attachScreenshots → upload evidence
//   4. Move on to the next test
//
// onEnd only handles the untracked report and the console summary.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  passed:      'PASS',
  failed:      'FAIL',
  timedOut:    'FAIL',
  skipped:     'TODO',
  interrupted: 'ABORTED',
};

const ANSI_RE = /\x1B\[[0-9;]*m/g;

/**
 * Playwright Reporter that pushes results to X-Ray (Jira).
 *
 * Streaming mode: each test result is linked and imported immediately after
 * the test finishes, rather than batching everything at onEnd.
 * This means partial results appear in Jira even if the run is interrupted.
 *
 * Loaded via playwright.config.ts reporter array — not exported from barrel.
 */
export default class XRayReporter implements Reporter {
  private active = false;
  private config!: ResolvedConfig;
  private log!: Logger;
  private client!: XRayClient;
  private executionKey: string | null = null;

  // Accumulated for the final summary only — not used for import
  private trackedResults: XRayTestResult[] = [];
  private untrackedTests: UntrackedTest[] = [];
  private totalCount = 0;

  // Pending async work from onTestEnd — awaited in onEnd
  private pendingOps: Promise<void>[] = [];

  constructor(userConfig: XRayUserConfig) {
    const earlyLog = createLogger(userConfig.verbose ?? false);

    try {
      this.config = resolveConfig(userConfig);
    } catch (err) {
      earlyLog.error(
        `Config resolution failed: ${err instanceof Error ? err.message : err}`,
      );
      this.active = false;
      return;
    }

    if (!this.config.enabled) {
      earlyLog.debug('X-Ray integration is disabled');
      this.active = false;
      return;
    }

    this.log = createLogger(this.config.verbose);
    this.client = new XRayClient(this.config, this.log);
    this.active = true;
  }

  // ─── onBegin ─────────────────────────────────────────────────────────────

  async onBegin(_config: FullConfig, _suite: Suite): Promise<void> {
    if (!this.active) return;

    // Authenticate if using xray-client
    if (this.config.auth.type === 'xray-client') {
      const ok = await this.client.authenticate();
      if (!ok) {
        this.active = false;
        return;
      }
    }

    // Resolve execution key
    if (this.config.existingExecutionKey) {
      // ── Provided execution key ────────────────────────────────────────────
      this.executionKey = this.config.existingExecutionKey;
      this.log.info(`Using existing execution: ${this.executionKey}`);

      // Pre-warm the linked-tests cache so per-test ensureTestLinked is fast
      if (this.config.features.updateTestStatus) {
        await this.client.getLinkedTestKeys(this.executionKey);
      }
    } else if (this.config.features.createExecution) {
      // ── Create a new execution ────────────────────────────────────────────
      this.executionKey = await this.client.createTestExecution(
        this.config.executionSummary,
        this.config.executionDescription,
        this.config.projectKey,
        this.config.assignee,
      );

      if (!this.executionKey) {
        this.log.error('Failed to create execution — deactivating');
        this.active = false;
        return;
      }
      // Tests are NOT pre-linked here.
      // Each test links itself just before its result is imported (in onTestEnd).
      // This ensures only tests that actually run appear in the execution.
    }
    // If neither existingExecutionKey nor createExecution, executionKey stays
    // null and per-test imports are skipped (results only go to summary).
  }

  // ─── onTestEnd (streaming) ────────────────────────────────────────────────

  /**
   * Called by Playwright after every test completes.
   *
   * Per-test flow:
   *   1. Extract X-Ray key(s) from title
   *   2. No key → untracked
   *   3. Key + execution exists:
   *        a. Ensure test is linked to execution (add if missing)
   *        b. Import result immediately
   *        c. Attach screenshot evidence if failed
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    this.totalCount++;

    const ids = extractTestIds(test.title);
    const status = STATUS_MAP[result.status] ?? 'TODO';

    // ── No X-Ray key → untracked ──────────────────────────────────────────
    if (ids.length === 0) {
      this.untrackedTests.push({
        title:    test.title,
        filePath: test.location?.file ?? '',
        status:   result.status,
        duration: result.duration,
      });
      if (this.config.features.untrackedReport) {
        this.log.debug(`Untracked: "${test.title}"`);
      }
      return;
    }

    // ── Build result objects ──────────────────────────────────────────────
    const startedOn  = new Date(result.startTime).toISOString();
    const finishedOn = new Date(result.startTime.getTime() + result.duration).toISOString();
    const comment    = this.buildComment(result);

    const xrayResults: XRayTestResult[] = ids.map((testKey) => ({
      testKey,
      status,
      startedOn,
      finishedOn,
      ...(comment ? { comment } : {}),
    }));

    // Accumulate for summary
    this.trackedResults.push(...xrayResults);

    // ── No execution key → nothing to push yet ────────────────────────────
    if (!this.active || !this.executionKey) return;

    // ── Per-test async work (fire and collect) ────────────────────────────
    const execKey = this.executionKey;
    const attachments = result.attachments;
    const isFailed = result.status === 'failed' || result.status === 'timedOut';

    const op = (async (): Promise<void> => {
      for (const xrayResult of xrayResults) {
        const { testKey } = xrayResult;

        // Step a: ensure the test is linked to the execution
        if (this.config.features.updateTestStatus) {
          await this.client.ensureTestLinked(execKey, testKey);
        }

        // Step b: import the result immediately
        if (this.config.features.updateTestStatus) {
          await this.client.importSingleResult(execKey, xrayResult, {
            summary:     this.config.executionSummary,
            description: this.config.executionDescription,
            project:     this.config.projectKey,
            ...(this.config.testPlanKey
              ? { testPlanKey: this.config.testPlanKey }
              : {}),
            ...(this.config.testEnvironments.length > 0
              ? { testEnvironments: this.config.testEnvironments }
              : {}),
          });
          this.log.debug(
            `[${testKey}] ${status} — imported (${result.duration}ms)`,
          );
        }

        // Step c: attach screenshot evidence for failures
        if (this.config.features.attachScreenshots && isFailed) {
          const screenshotPaths = extractScreenshots(attachments);
          for (const ssPath of screenshotPaths) {
            const evidence = screenshotToEvidence(ssPath);
            if (evidence) {
              await this.client.attachEvidence(execKey, testKey, evidence);
            }
          }
        }
      }
    })();

    this.pendingOps.push(op);
  }

  // ─── onEnd ────────────────────────────────────────────────────────────────

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.active) {
      // Still print summary even when disabled mid-run
      printSummary(
        this.log ?? createLogger(false),
        this.executionKey,
        this.totalCount,
        this.trackedResults,
        this.untrackedTests,
      );
      return;
    }

    // Wait for all per-test async operations to complete
    if (this.pendingOps.length > 0) {
      this.log.debug(`Waiting for ${this.pendingOps.length} pending operation(s)…`);
      await Promise.allSettled(this.pendingOps);
    }

    // Untracked report
    if (this.config.features.untrackedReport && this.untrackedTests.length > 0) {
      writeUntrackedReport(
        this.untrackedTests,
        this.config.untrackedOutputFile,
        this.log,
      );
    }

    // Console summary
    printSummary(
      this.log,
      this.executionKey,
      this.totalCount,
      this.trackedResults,
      this.untrackedTests,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildComment(result: TestResult): string | undefined {
    const isFailed = result.status === 'failed' || result.status === 'timedOut';
    if (!isFailed || !result.errors || result.errors.length === 0) return undefined;

    const raw = result.errors
      .map((e) => e.message ?? e.stack ?? '')
      .join('\n---\n');

    const clean = raw.replace(ANSI_RE, '');
    return clean.length > 2000 ? clean.substring(0, 2000) : clean;
  }
}

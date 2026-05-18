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

const STATUS_MAP: Record<string, string> = {
  passed: 'PASS',
  failed: 'FAIL',
  timedOut: 'FAIL',
  skipped: 'TODO',
  interrupted: 'ABORTED',
};

const ANSI_RE = /\x1B\[[0-9;]*m/g;

/**
 * Playwright Reporter that pushes results to X-Ray (Jira).
 * Loaded via playwright.config.ts reporter array — not exported from barrel.
 */
export default class XRayReporter implements Reporter {
  private active = false;
  private config!: ResolvedConfig;
  private log!: Logger;
  private client!: XRayClient;
  private executionKey: string | null = null;
  private results: XRayTestResult[] = [];
  private untrackedTests: UntrackedTest[] = [];
  private failedAttachments: Map<string, Array<{ name?: string; contentType?: string; path?: string }>> = new Map();
  private totalCount = 0;

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

  async onBegin(_config: FullConfig, suite: Suite): Promise<void> {
    if (!this.active) return;

    // Authenticate if using xray-client
    if (this.config.auth.type === 'xray-client') {
      const ok = await this.client.authenticate();
      if (!ok) {
        this.active = false;
        return;
      }
    }

    // Use existing execution key or create a new one
    if (this.config.existingExecutionKey) {
      this.executionKey = this.config.existingExecutionKey;
      this.log.info(`Using existing execution: ${this.executionKey}`);
    } else if (this.config.features.createExecution) {
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

      // Pre-link all tests found in the suite tree
      const allTestIds = this.collectAllTestIds(suite);
      if (allTestIds.length > 0) {
        await this.client.addTestsToExecution(this.executionKey, allTestIds);
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.totalCount++;

    const ids = extractTestIds(test.title);
    const status = STATUS_MAP[result.status] ?? 'TODO';

    if (ids.length === 0) {
      // Untracked test
      this.untrackedTests.push({
        title: test.title,
        filePath: test.location?.file ?? '',
        status: result.status,
        duration: result.duration,
      });
      return;
    }

    const startedOn = new Date(result.startTime).toISOString();
    const finishedOn = new Date(
      result.startTime.getTime() + result.duration,
    ).toISOString();

    const comment =
      result.status === 'failed' || result.status === 'timedOut'
        ? this.buildComment(result.errors)
        : undefined;

    for (const testKey of ids) {
      this.results.push({
        testKey,
        status,
        startedOn,
        finishedOn,
        comment,
      });
    }

    // Store attachments for failed tests (for screenshot evidence)
    if (
      (result.status === 'failed' || result.status === 'timedOut') &&
      result.attachments.length > 0
    ) {
      for (const testKey of ids) {
        this.failedAttachments.set(testKey, result.attachments);
      }
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.active) return;

    // Import results
    if (this.config.features.updateTestStatus && this.results.length > 0 && this.executionKey) {
      const payload: XRayImportPayload = {
        testExecutionKey: this.executionKey,
        info: {
          summary: this.config.executionSummary,
          description: this.config.executionDescription,
          project: this.config.projectKey,
          ...(this.config.testPlanKey && { testPlanKey: this.config.testPlanKey }),
          ...(this.config.testEnvironments.length > 0 && {
            testEnvironments: this.config.testEnvironments,
          }),
        },
        tests: this.results,
      };

      await this.client.importResults(payload);
    }

    // Attach screenshots for failed tests
    if (
      this.config.features.attachScreenshots &&
      this.executionKey &&
      this.failedAttachments.size > 0
    ) {
      const promises: Promise<void>[] = [];

      for (const [testKey, attachments] of this.failedAttachments) {
        const screenshotPaths = extractScreenshots(attachments);
        for (const ssPath of screenshotPaths) {
          const evidence = screenshotToEvidence(ssPath);
          if (evidence) {
            promises.push(
              this.client
                .attachEvidence(this.executionKey!, testKey, evidence)
                .then(() => {}),
            );
          }
        }
      }

      await Promise.all(promises);
    }

    // Untracked report
    if (this.config.features.untrackedReport && this.untrackedTests.length > 0) {
      writeUntrackedReport(
        this.untrackedTests,
        this.config.untrackedOutputFile,
        this.log,
      );
    }

    // Always print summary
    printSummary(
      this.log,
      this.executionKey,
      this.totalCount,
      this.results,
      this.untrackedTests,
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private collectAllTestIds(suite: Suite): string[] {
    const ids = new Set<string>();

    const walk = (s: Suite): void => {
      for (const test of s.tests ?? []) {
        for (const id of extractTestIds(test.title)) {
          ids.add(id);
        }
      }
      for (const child of s.suites ?? []) {
        walk(child);
      }
    };

    walk(suite);
    return [...ids];
  }

  private buildComment(errors: TestResult['errors']): string | undefined {
    if (!errors || errors.length === 0) return undefined;

    const raw = errors
      .map((e) => e.message ?? e.stack ?? '')
      .join('\n---\n');

    const clean = raw.replace(ANSI_RE, '');
    return clean.length > 2000 ? clean.substring(0, 2000) : clean;
  }
}

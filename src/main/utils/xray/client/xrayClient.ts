import axios, { AxiosInstance } from 'axios';
import type { Logger, ResolvedConfig, XRayEvidence, XRayImportPayload, XRayTestResult } from '../types';

/**
 * HTTP client for X-Ray / Jira REST APIs.
 * All methods are non-throwing — errors are logged and safe defaults returned.
 */
export class XRayClient {
  private jiraAxios: AxiosInstance;
  private cloudAxios: AxiosInstance | null = null;
  private runIdCache: Map<string, Map<string, string>> = new Map();
  private linkedTestsCache: Map<string, Set<string>> = new Map();
  private config: ResolvedConfig;
  private log: Logger;

  constructor(config: ResolvedConfig, log: Logger) {
    this.config = config;
    this.log = log;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    switch (config.auth.type) {
      case 'basic': {
        const token = Buffer.from(
          `${config.auth.email}:${config.auth.apiToken}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${token}`;
        break;
      }
      case 'pat': {
        headers['Authorization'] = `Bearer ${config.auth.token}`;
        break;
      }
      case 'xray-client': {
        // Jira REST calls need basic/pat — xray-client is for X-Ray Cloud API only.
        break;
      }
    }

    this.jiraAxios = axios.create({
      baseURL: config.jiraBaseUrl,
      headers,
      timeout: 30_000,
    });
  }

  // ─── Authentication ──────────────────────────────────────────────────────

  /**
   * Authenticate with X-Ray Cloud (only for xray-client auth type).
   * Populates the cloudAxios instance with the bearer token.
   */
  async authenticate(): Promise<boolean> {
    if (this.config.auth.type !== 'xray-client') {
      this.log.debug('authenticate() skipped — not using xray-client auth');
      return true;
    }

    try {
      const { clientId, clientSecret } = this.config.auth;
      const response = await axios.post<string>(
        'https://xray.cloud.getxray.app/api/v2/authenticate',
        { client_id: clientId, client_secret: clientSecret },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const token = response.data;
      this.cloudAxios = axios.create({
        baseURL: 'https://xray.cloud.getxray.app/api/v2',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: 30_000,
      });

      this.log.success('Authenticated with X-Ray Cloud');
      return true;
    } catch (err) {
      this.log.error(
        `X-Ray Cloud authentication failed: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  // ─── Execution management ────────────────────────────────────────────────

  /**
   * Create a new Test Execution issue in Jira.
   * Returns the issue key (e.g. "PROJ-456") or null on failure.
   */
  async createTestExecution(
    summary: string,
    description: string,
    projectKey: string,
    assignee: string,
  ): Promise<string | null> {
    try {
      const payload: Record<string, unknown> = {
        fields: {
          project: { key: projectKey },
          summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: description }],
              },
            ],
          },
          issuetype: { name: 'Test Execution' },
        },
      };

      if (assignee) {
        (payload.fields as Record<string, unknown>).assignee = { id: assignee };
      }

      const response = await this.jiraAxios.post('/rest/api/3/issue', payload);
      const key = response.data?.key as string;
      this.log.success(`Created Test Execution: ${key}`);
      return key;
    } catch (err) {
      this.log.error(
        `Failed to create Test Execution: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Fetch all test keys already linked to an execution.
   * Results are cached per execution key.
   */
  async getLinkedTestKeys(executionKey: string): Promise<Set<string>> {
    if (this.linkedTestsCache.has(executionKey)) {
      return this.linkedTestsCache.get(executionKey)!;
    }

    const linked = new Set<string>();

    try {
      let tests: Array<{ key?: string; testKey?: string }> = [];

      if (this.config.xrayMode === 'cloud' && this.cloudAxios) {
        const resp = await this.cloudAxios.get(`/testexec/${executionKey}/tests`);
        tests = resp.data ?? [];
      } else {
        const resp = await this.jiraAxios.get(
          `/rest/raven/1.0/api/testexec/${executionKey}/test`,
        );
        tests = resp.data ?? [];
      }

      for (const t of tests) {
        const k = t.key ?? t.testKey;
        if (k) linked.add(k);
      }

      this.log.debug(
        `Execution ${executionKey} already has ${linked.size} linked test(s)`,
      );
    } catch (err) {
      this.log.warn(
        `Could not fetch linked tests for ${executionKey}: ${err instanceof Error ? err.message : err}`,
      );
    }

    this.linkedTestsCache.set(executionKey, linked);
    return linked;
  }

  /**
   * Ensure a single test key is linked to the execution.
   * Skips the API call if the key is already linked (uses cache).
   */
  async ensureTestLinked(executionKey: string, testKey: string): Promise<void> {
    const linked = await this.getLinkedTestKeys(executionKey);
    if (linked.has(testKey)) {
      this.log.debug(`${testKey} already linked to ${executionKey} — skipping`);
      return;
    }

    await this.addTestsToExecution(executionKey, [testKey]);
    linked.add(testKey); // update cache
  }

  /**
   * Link one or more test keys to an execution. Best-effort — logs warning on failure.
   */
  async addTestsToExecution(executionKey: string, testKeys: string[]): Promise<void> {
    if (testKeys.length === 0) return;

    try {
      if (this.config.xrayMode === 'cloud' && this.cloudAxios) {
        await this.cloudAxios.post('/graphql', {
          query: `mutation { addTestsToTestExecution(issueId: "${executionKey}", testIssueIds: ${JSON.stringify(testKeys)}) { addedTests warning } }`,
        });
      } else {
        await this.jiraAxios.post(
          `/rest/raven/1.0/api/testexec/${executionKey}/test`,
          { add: testKeys },
        );
      }
      this.log.debug(`Linked [${testKeys.join(', ')}] to ${executionKey}`);
    } catch (err) {
      this.log.warn(
        `Failed to link tests to execution: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ─── Result import ───────────────────────────────────────────────────────

  /**
   * Import a single test result immediately after the test finishes.
   * This is the per-test update path used by the new streaming flow.
   */
  async importSingleResult(
    executionKey: string,
    result: XRayTestResult,
    info?: XRayImportPayload['info'],
  ): Promise<boolean> {
    const payload: XRayImportPayload = {
      testExecutionKey: executionKey,
      ...(info ? { info } : {}),
      tests: [result],
    };
    return this.importResults(payload);
  }

  /**
   * Import a batch of test results into X-Ray.
   * Returns true on success, false on failure.
   */
  async importResults(payload: XRayImportPayload): Promise<boolean> {
    try {
      if (this.config.xrayMode === 'cloud' && this.cloudAxios) {
        await this.cloudAxios.post('/import/execution', payload);
      } else {
        await this.jiraAxios.post('/rest/raven/2.0/import/execution', payload);
      }
      this.log.success(`Imported ${payload.tests.length} test result(s)`);
      return true;
    } catch (err) {
      this.log.error(
        `Failed to import results: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  // ─── Evidence ────────────────────────────────────────────────────────────

  /**
   * Attach evidence (screenshot) to a specific test run within an execution.
   * Returns true on success, false on failure.
   */
  async attachEvidence(
    executionKey: string,
    testKey: string,
    evidence: XRayEvidence,
  ): Promise<boolean> {
    try {
      const runId = await this.getRunId(executionKey, testKey);
      if (!runId) {
        this.log.warn(`No run ID found for ${testKey} in ${executionKey}`);
        return false;
      }

      if (this.config.xrayMode === 'cloud' && this.cloudAxios) {
        await this.cloudAxios.post(`/testrun/${runId}/evidence`, evidence);
      } else {
        await this.jiraAxios.post(
          `/rest/raven/2.0/api/testrun/${runId}/evidence`,
          evidence,
        );
      }

      this.log.debug(`Attached evidence to ${testKey} (run ${runId})`);
      return true;
    } catch (err) {
      this.log.error(
        `Failed to attach evidence for ${testKey}: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  /**
   * Fetches the run ID for a test within an execution. Results are cached.
   */
  private async getRunId(
    executionKey: string,
    testKey: string,
  ): Promise<string | null> {
    if (this.runIdCache.has(executionKey)) {
      const cached = this.runIdCache.get(executionKey)!;
      return cached.get(testKey) ?? null;
    }

    try {
      let runs: Array<{ testKey: string; id: string }> = [];

      if (this.config.xrayMode === 'cloud' && this.cloudAxios) {
        const resp = await this.cloudAxios.get(
          `/testexec/${executionKey}/testruns`,
        );
        runs = resp.data ?? [];
      } else {
        const resp = await this.jiraAxios.get(
          `/rest/raven/2.0/api/testexec/${executionKey}/testruns`,
        );
        runs = resp.data ?? [];
      }

      const map = new Map<string, string>();
      for (const run of runs) {
        if (run.testKey && run.id) {
          map.set(run.testKey, String(run.id));
        }
      }
      this.runIdCache.set(executionKey, map);

      return map.get(testKey) ?? null;
    } catch (err) {
      this.log.warn(
        `Failed to fetch run IDs for ${executionKey}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}

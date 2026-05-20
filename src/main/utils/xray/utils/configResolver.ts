import type {
  AuthConfig,
  ResolvedConfig,
  XRayFeatures,
  XRayMode,
  XRayUserConfig,
} from '../types';

// ─── Env helpers ─────────────────────────────────────────────────────────────

function envStr(key: string): string | undefined {
  const val = process.env[key];
  return val !== undefined && val !== '' ? val : undefined;
}

function envBool(key: string): boolean | undefined {
  const val = envStr(key);
  if (val === undefined) return undefined;
  return val === 'true' || val === '1';
}

function envArray(key: string): string[] | undefined {
  const val = envStr(key);
  if (!val) return undefined;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Feature resolution ──────────────────────────────────────────────────────

export function resolveFeatures(userConfig: XRayUserConfig): XRayFeatures {
  return {
    createExecution:
      envBool('XRAY_FEATURE_CREATE_EXECUTION') ??
      userConfig.features?.createExecution ??
      false,
    updateTestStatus:
      envBool('XRAY_FEATURE_UPDATE_STATUS') ??
      userConfig.features?.updateTestStatus ??
      false,
    attachScreenshots:
      envBool('XRAY_FEATURE_ATTACH_SCREENSHOTS') ??
      userConfig.features?.attachScreenshots ??
      false,
    untrackedReport:
      envBool('XRAY_FEATURE_UNTRACKED_REPORT') ??
      userConfig.features?.untrackedReport ??
      false,
  };
}

// ─── Auth resolution ─────────────────────────────────────────────────────────

function resolveAuth(userConfig: XRayUserConfig): AuthConfig {
  const authType = userConfig.auth?.type ?? 'basic';

  switch (authType) {
    case 'basic':
      return {
        type: 'basic',
        email:
          envStr('JIRA_EMAIL') ??
          (userConfig.auth as { email?: string })?.email ??
          '',
        apiToken:
          envStr('JIRA_API_TOKEN') ??
          (userConfig.auth as { apiToken?: string })?.apiToken ??
          '',
      };
    case 'pat':
      return {
        type: 'pat',
        token:
          envStr('JIRA_PAT') ??
          (userConfig.auth as { token?: string })?.token ??
          '',
      };
    case 'xray-client':
      return {
        type: 'xray-client',
        clientId:
          envStr('XRAY_CLIENT_ID') ??
          (userConfig.auth as { clientId?: string })?.clientId ??
          '',
        clientSecret:
          envStr('XRAY_CLIENT_SECRET') ??
          (userConfig.auth as { clientSecret?: string })?.clientSecret ??
          '',
      };
    default:
      return { type: 'basic', email: '', apiToken: '' };
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validate(config: ResolvedConfig): void {
  const errors: string[] = [];

  if (!config.jiraBaseUrl) {
    errors.push('jiraBaseUrl is required (env: JIRA_BASE_URL)');
  }
  if (!config.projectKey) {
    errors.push('projectKey is required (env: JIRA_PROJECT_KEY)');
  }

  const validModes: XRayMode[] = ['cloud', 'dc'];
  if (!validModes.includes(config.xrayMode)) {
    errors.push(`xrayMode must be one of: ${validModes.join(', ')} (env: XRAY_MODE)`);
  }

  // Auth-specific validation
  switch (config.auth.type) {
    case 'basic':
      if (!config.auth.email)
        errors.push('auth.email is required for basic auth (env: JIRA_EMAIL)');
      if (!config.auth.apiToken)
        errors.push('auth.apiToken is required for basic auth (env: JIRA_API_TOKEN)');
      break;
    case 'pat':
      if (!config.auth.token)
        errors.push('auth.token is required for PAT auth (env: JIRA_PAT)');
      break;
    case 'xray-client':
      if (!config.auth.clientId)
        errors.push('auth.clientId is required for xray-client auth (env: XRAY_CLIENT_ID)');
      if (!config.auth.clientSecret)
        errors.push('auth.clientSecret is required for xray-client auth (env: XRAY_CLIENT_SECRET)');
      break;
  }

  if (errors.length > 0) {
    throw new Error(`[xray] Configuration errors:\n  • ${errors.join('\n  • ')}`);
  }
}

// ─── Main resolver ───────────────────────────────────────────────────────────

export function resolveConfig(userConfig: XRayUserConfig): ResolvedConfig {
  const xrayModeRaw = envStr('XRAY_MODE') ?? userConfig.xrayMode ?? 'cloud';
  const xrayMode: XRayMode = xrayModeRaw === 'dc' ? 'dc' : 'cloud';

  const resolved: ResolvedConfig = {
    enabled:     envBool('XRAY_ENABLED')      ?? userConfig.enabled      ?? false,
    verbose:     envBool('XRAY_VERBOSE')      ?? userConfig.verbose      ?? false,
    jiraBaseUrl: envStr('JIRA_BASE_URL')      ?? userConfig.jiraBaseUrl  ?? '',
    projectKey:  envStr('JIRA_PROJECT_KEY')   ?? userConfig.projectKey   ?? '',
    xrayMode,
    auth: resolveAuth(userConfig),
    features: resolveFeatures(userConfig),
    executionSummary:
      envStr('XRAY_EXECUTION_SUMMARY') ??
      userConfig.executionSummary ??
      'Playwright E2E — Automated Run',
    executionDescription:
      envStr('XRAY_EXECUTION_DESCRIPTION') ??
      userConfig.executionDescription ??
      'Automated test execution from Playwright',
    testPlanKey:
      envStr('XRAY_TEST_PLAN_KEY') ?? userConfig.testPlanKey ?? '',
    testEnvironments:
      envArray('XRAY_TEST_ENVIRONMENTS') ?? userConfig.testEnvironments ?? [],
    existingExecutionKey:
      envStr('XRAY_EXECUTION_KEY') ?? userConfig.existingExecutionKey ?? '',
    assignee:
      envStr('XRAY_ASSIGNEE') ?? userConfig.assignee ?? '',
    untrackedOutputFile:
      envStr('XRAY_UNTRACKED_OUTPUT') ??
      userConfig.untrackedOutputFile ??
      'reports/untracked-tests.txt',
  };

  // Only validate when enabled
  if (resolved.enabled) {
    validate(resolved);
  }

  return resolved;
}

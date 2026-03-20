/**
 * Integration Tests for US-CFG-037: Full Round-Trip (Plugin + n8n Custom Node)
 *
 * Tests the COMPLETE config sync flow with REAL service instances:
 * ConfigLoader → ConfigSyncer → SchemaValidator → ConfigMerger → process.env
 *
 * Only external I/O is mocked:
 * - HTTP (global fetch) — webhook calls to n8n
 * - Filesystem — via temporary directories with real files
 *
 * Internal services (ConfigLoader, ConfigSyncer, SchemaValidator, ConfigMerger)
 * run with their real implementations, wired together as in config.ts.
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 *
 * @see US-CFG-037 - Integration Test Full Round-Trip
 * @see config.ts - Entry point orchestration being tested
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/** Mutable home directory for tests — set per scenario. */
let testHomeDir = '/tmp/test-home'

/** Mutable fetch response — set per scenario. */
let pendingFetchResponse: SyncResponse | null = null

/** Stored promise from executeFullSyncFlow — awaited in assertion steps. */
let flowResult: Promise<void> | null = null

vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>()
  return {
    ...original,
    default: {
      ...original,
      homedir: () => testHomeDir,
    },
    homedir: () => testHomeDir,
  }
})

import { ConfigLoader } from '../../src/services/ConfigLoader.js'
import { ConfigMerger } from '../../src/services/ConfigMerger.js'
import { ConfigSyncer } from '../../src/services/ConfigSyncer.js'
import { SchemaValidator } from '../../src/services/SchemaValidator.js'
import { PROTECTED_FIELDS } from '../../src/types/PluginConfig.js'
import type { SyncResponse } from '../../src/types/SyncResponse.js'
import type { PluginDescriptor } from '../../src/types/PluginDescriptor.js'
import type { PluginLoggerInterface } from '../../src/interfaces/PluginLoggerInterface.js'

// --- State ---

/** Captured fetch calls for assertion. */
let capturedFetchCalls: Array<{ url: string; body: Record<string, unknown> }>

/** Collected log messages for assertion. */
let logMessages: Array<{ level: string; message: string }>

/** Saved process.env values for cleanup. */
let savedEnv: Record<string, string | undefined>

/** Temporary directory for config files. */
let tmpDir: string

/** Path to the project directory within tmpDir. */
let projectDir: string

/** Path to the global config home within tmpDir. */
let homeDir: string

// --- Test Logger ---

/**
 * Create a test logger that captures all log messages.
 */
function createTestLogger(): PluginLoggerInterface {
  const log = (level: string, msg: string) => {
    logMessages.push({ level, message: msg })
  }

  return {
    debug: (msg: string) => log('debug', msg),
    info: (msg: string) => log('info', msg),
    warn: (msg: string) => log('warn', msg),
    error: (msg: string) => log('error', msg),
    withLogging: <T extends (...args: any[]) => any>(fn: T) => fn,
    withErrorHandling: <T extends (...args: any[]) => any>(fn: T) => fn,
  }
}

// --- Filesystem Helpers ---

/**
 * Write a JSON file to the given path, creating directories as needed.
 */
function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

/**
 * Set up the project config file.
 */
function setupLocalConfig(config: Record<string, unknown>): void {
  writeJsonFile(path.join(projectDir, '.opencode/opencode-project.json'), config)
}

/**
 * Set up the global config file.
 */
function setupGlobalConfig(config: Record<string, unknown> = {}): void {
  writeJsonFile(path.join(homeDir, '.config/opencode/opencode-project.json'), config)
}

/**
 * Set up a plugin in the local node_modules directory.
 */
function setupPlugin(
  pluginName: string,
  npmName: string,
  options?: { configSchema?: string; schemaContent?: object },
): void {
  const pluginDir = path.join(projectDir, '.opencode/node_modules/@opencode-ai', npmName)
  fs.mkdirSync(pluginDir, { recursive: true })

  writeJsonFile(path.join(pluginDir, 'package.json'), {
    name: `@opencode-ai/${npmName}`,
    version: '0.1.0',
    opencode: { plugin: true },
  })

  writeJsonFile(path.join(pluginDir, 'plugin.json'), {
    name: pluginName,
    version: '0.1.0',
    configSchema: options?.configSchema ?? null,
  })

  if (options?.configSchema && options?.schemaContent) {
    writeJsonFile(path.join(pluginDir, options.configSchema), options.schemaContent)
  }
}

/**
 * Set up all standard plugins with schemas.
 */
function setupStandardPlugins(): void {
  setupPlugin('jira', 'opencode-plugin-jira', {
    configSchema: 'schemas/jira.schema.json',
    schemaContent: {
      type: 'object',
      properties: {
        jira: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              properties: {
                status: { type: 'object' },
              },
            },
            transitions: { type: 'object' },
            tempo_accounts: { type: 'object' },
          },
        },
      },
    },
  })

  setupPlugin('time-tracking', 'opencode-plugin-time-tracking', {
    configSchema: 'schemas/time-tracking.schema.json',
    schemaContent: {
      type: 'object',
      properties: {
        time_tracking: {
          type: 'object',
        },
      },
    },
  })

  setupPlugin('config', 'opencode-plugin-config', {
    configSchema: 'schemas/config.schema.json',
    schemaContent: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            sync_url: { type: 'string' },
            sync_token: { type: 'string' },
          },
        },
      },
    },
  })
}

// --- Webhook Mock Helpers ---

/**
 * Set the fetch mock to return a specific response.
 */
function setupFetchResponse(response: SyncResponse): void {
  pendingFetchResponse = response
}

// --- Data Builders ---

/**
 * Build a happy-path webhook response with all sections.
 */
function buildHappyPathResponse(): SyncResponse {
  return {
    version: '0.1.0',
    config: {
      jira: {
        workflow: {
          status: {
            open: 'Open',
            in_progress: 'In Progress',
            in_review: 'In Review',
            done: 'Done',
          },
        },
        transitions: {
          start_work: 'In Progress',
          complete_work: 'Done',
        },
        tempo_accounts: {
          DEV_ACC: '12345',
        },
      },
      time_tracking: {
        default_issue: 'TESTPROJ-1',
        pricing: {
          'claude-sonnet-4-20250514': {
            input: 0.003,
            output: 0.015,
          },
        },
        agent_defaults: {
          coordinator: 'agent_coordinator',
        },
      },
    },
  }
}

/**
 * Build the standard local config used in Background.
 */
function buildLocalConfig(): Record<string, unknown> {
  return {
    jira: {
      project: 'TESTPROJ',
      base_url: 'https://test.atlassian.net',
    },
    time_tracking: {
      enabled: true,
    },
  }
}

// --- Orchestration (mirrors config.ts steps 2-8) ---

/**
 * Execute the full config sync flow using real service instances.
 *
 * This mirrors the orchestration in config.ts (steps 2-8) but uses
 * the test logger and test directory instead of the Plugin SDK.
 *
 * Steps:
 * 2. Instantiate services (real instances)
 * 3. Build plugin descriptors from local node_modules
 * 4. Load local config cascade
 * 5. Sync config via webhook (fetch is mocked)
 * 6. Validate response sections
 * 7. Deep-merge remote + local
 * 8. Write to process.env
 */
async function executeFullSyncFlow(): Promise<void> {
  const logger = createTestLogger()

  // Step 2: Service instantiation (real instances)
  const merger = new ConfigMerger()
  const loader = new ConfigLoader(merger, logger)
  const syncer = new ConfigSyncer(logger)
  const validator = new SchemaValidator(logger)

  // Step 3: Build plugin descriptors from filesystem
  const pluginDescriptors = discoverTestPlugins()
  const pluginNames = pluginDescriptors.map((p) => p.name)
  const ownDescriptor = pluginDescriptors.find((p) => p.name === 'config')
  const pluginVersion = ownDescriptor?.version ?? '0.0.0'

  // Step 4: Load local config cascade (real ConfigLoader reads real files)
  const localConfig = loader.loadLocalConfig(projectDir)

  // Step 5: Webhook sync (fetch is mocked globally)
  const syncResponse = await syncer.syncConfig(localConfig, pluginNames, pluginVersion)

  // Step 6: Schema validation (only if sync succeeded)
  let validatedRemoteConfig: Record<string, unknown> = {}

  if (syncResponse !== null) {
    validatedRemoteConfig = validator.validateResponse(syncResponse, pluginDescriptors)
  }

  // Step 7: Deep-merge (remote as base, local as override)
  let finalConfig: Record<string, unknown>

  if (Object.keys(validatedRemoteConfig).length > 0) {
    finalConfig = merger.mergeWithProtectedFields(
      validatedRemoteConfig,
      localConfig,
      PROTECTED_FIELDS,
    )
  } else {
    finalConfig = localConfig
  }

  // Step 8: Write to process.env
  process.env.OPENCODE_PROJECT_CONFIG = JSON.stringify(finalConfig)
}

/**
 * Discover plugins from the test project's node_modules.
 * Simplified version of PluginDiscovery for test use.
 */
function discoverTestPlugins(): PluginDescriptor[] {
  const descriptors: PluginDescriptor[] = []
  const nodeModulesDir = path.join(projectDir, '.opencode/node_modules')

  if (!fs.existsSync(nodeModulesDir)) return descriptors

  const entries = fs.readdirSync(nodeModulesDir)

  for (const entry of entries) {
    const entryPath = path.join(nodeModulesDir, entry)
    const stat = fs.statSync(entryPath)

    if (entry.startsWith('@') && stat.isDirectory()) {
      const scopeEntries = fs.readdirSync(entryPath)
      for (const scopeEntry of scopeEntries) {
        const packageDir = path.join(entryPath, scopeEntry)
        const descriptor = tryBuildDescriptor(packageDir)
        if (descriptor) descriptors.push(descriptor)
      }
    } else {
      const descriptor = tryBuildDescriptor(entryPath)
      if (descriptor) descriptors.push(descriptor)
    }
  }

  return descriptors
}

/**
 * Try to build a PluginDescriptor from a package directory.
 */
function tryBuildDescriptor(packageDir: string): PluginDescriptor | null {
  try {
    const packageJsonPath = path.join(packageDir, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return null

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    if (!packageJson.opencode?.plugin) return null

    const pluginJsonPath = path.join(packageDir, 'plugin.json')
    let pluginJson: Record<string, unknown> | null = null
    if (fs.existsSync(pluginJsonPath)) {
      pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'))
    }

    return {
      name: (pluginJson?.name as string) ?? packageJson.name,
      version: (pluginJson?.version as string) ?? packageJson.version ?? '0.0.0',
      configSchema: (pluginJson?.configSchema as string) ?? null,
      path: packageDir,
    }
  } catch {
    return null
  }
}

// --- Assertion Helpers ---

/**
 * Parse the final config from process.env.OPENCODE_PROJECT_CONFIG.
 */
function getParsedConfig(): Record<string, unknown> {
  const raw = process.env.OPENCODE_PROJECT_CONFIG
  expect(raw).toBeDefined()
  expect(raw).not.toBe('')
  const parsed = JSON.parse(raw!)
  expect(typeof parsed).toBe('object')
  expect(parsed).not.toBeNull()
  expect(Array.isArray(parsed)).toBe(false)
  return parsed as Record<string, unknown>
}

/**
 * Deep-get a nested value from an object using dot notation.
 */
function deepGet(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// --- Load Feature ---

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-037-integration-test-round-trip.feature',
)

// --- Test Suite ---

describeFeature(feature, ({ Background, Scenario }) => {
  // NOTE: Do NOT use afterEach — vitest-cucumber runs each step as a separate
  // test, so afterEach would run between Background steps and delete the temp dir.
  // Cleanup is done in the Background's first Given step (before creating new temp dir).

  // afterEach for cleanup is defined above (before Background)

  Background(({ Given, And }) => {
    Given('the config plugin is initialized', () => {
      // Clean up previous scenario's temp dir (if any)
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
      // Restore previous scenario's env vars (if any)
      if (savedEnv) {
        for (const [key, value] of Object.entries(savedEnv)) {
          if (value === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = value
          }
        }
      }

      // Create temporary directory for test files
      tmpDir = fs.mkdtempSync(path.join('/tmp', 'round-trip-'))
      projectDir = path.join(tmpDir, 'project')
      homeDir = path.join(tmpDir, 'home')
      fs.mkdirSync(projectDir, { recursive: true })
      fs.mkdirSync(homeDir, { recursive: true })

      // Override os.homedir for ConfigLoader's global config path
      testHomeDir = homeDir

      // Default fetch response (happy path)
      pendingFetchResponse = buildHappyPathResponse()

      // Mock global fetch
      globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
        const body = JSON.parse(options?.body as string ?? '{}')
        capturedFetchCalls.push({ url: String(url), body })
        if (pendingFetchResponse === null) {
          throw new Error('fetch failed: Connection refused')
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => pendingFetchResponse,
        } as Response
      }) as typeof fetch

      // Reset state
      capturedFetchCalls = []
      logMessages = []
      flowResult = null

      // Save env vars
      savedEnv = {
        OPENCODE_USER_EMAIL: process.env.OPENCODE_USER_EMAIL,
        OC_CONFIG_SYNC_URL: process.env.OC_CONFIG_SYNC_URL,
        OC_CONFIG_SYNC_TOKEN: process.env.OC_CONFIG_SYNC_TOKEN,
        OPENCODE_PROJECT_CONFIG: process.env.OPENCODE_PROJECT_CONFIG,
      }
    })

    And('a local opencode-project.json exists with:', () => {
      setupLocalConfig(buildLocalConfig())
      setupGlobalConfig()
    })

    And('the shell-env plugin has set process.env.OPENCODE_USER_EMAIL to "dev@example.com"', () => {
      process.env.OPENCODE_USER_EMAIL = 'dev@example.com'
    })

    And('the shell-env plugin has set process.env.OC_CONFIG_SYNC_URL to "http://localhost:5678/oc-config-sync"', () => {
      process.env.OC_CONFIG_SYNC_URL = 'http://localhost:5678/oc-config-sync'
    })

    And('the n8n ConfigBuilder node is running with mock credentials', () => {
      setupStandardPlugins()
    })
  })

  // --- Scenario 1: Happy Path ---

  Scenario('Happy Path - Full round-trip with all sources succeeding', ({ Given, When, Then, And }) => {
    Given('the Google Sheet mock returns valid data for all 6 tabs:', () => {
      // Sheet data is embedded in the webhook response
    })

    And('the JIRA API mock returns valid statuses for project "TESTPROJ":', () => {
      // JIRA data is embedded in the webhook response
    })

    When('the config plugin executes the full sync flow', () => {
      setupFetchResponse(buildHappyPathResponse())
      flowResult = executeFullSyncFlow()
    })

    Then('the ConfigSyncer sends a POST to the n8n webhook with:', async () => {
      await flowResult
      expect(capturedFetchCalls).toHaveLength(1)
      const call = capturedFetchCalls[0]
      expect(call.url).toBe('http://localhost:5678/oc-config-sync')
      expect(call.body.email).toBe('dev@example.com')
      expect((call.body.config as Record<string, unknown>).jira).toBeDefined()
      expect((call.body as any).plugins).toEqual(expect.arrayContaining(['jira', 'time-tracking']))
    })

    And('the n8n node responds with HTTP 200 and a valid config containing:', () => {
      // Verified by the successful flow — response was accepted
      expect(capturedFetchCalls).toHaveLength(1)
    })

    And('the SchemaValidator accepts both sections', () => {
      const config = getParsedConfig()
      expect(config.jira).toBeDefined()
      expect(config.time_tracking).toBeDefined()
    })

    And('the ConfigMerger produces a final config with remote as base and local overrides', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.workflow.status')).toBeDefined()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
    })

    And('process.env.OPENCODE_PROJECT_CONFIG contains valid JSON', () => {
      const raw = process.env.OPENCODE_PROJECT_CONFIG
      expect(raw).toBeDefined()
      expect(() => JSON.parse(raw!)).not.toThrow()
    })

    And('the parsed config contains jira.workflow.status with normalized status keys', () => {
      const config = getParsedConfig()
      const status = deepGet(config, 'jira.workflow.status') as Record<string, string>
      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
      expect(status.open).toBe('Open')
      expect(status.in_progress).toBe('In Progress')
    })

    And('the parsed config contains time_tracking.pricing with model prices', () => {
      const config = getParsedConfig()
      const pricing = deepGet(config, 'time_tracking.pricing') as Record<string, unknown>
      expect(pricing).toBeDefined()
      expect(pricing['claude-sonnet-4-20250514']).toEqual({ input: 0.003, output: 0.015 })
    })

    And('the parsed config contains jira.project = "TESTPROJ" from local config', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
    })
  })

  // --- Scenario 2: Partial Failure ---

  Scenario('Partial Failure - JIRA API unreachable, Sheet data still delivered', ({ Given, And, When, Then }) => {
    Given('the Google Sheet mock returns valid data for all 6 tabs', () => {
      // Sheet data is embedded in the webhook response
    })

    And('the JIRA API mock is unreachable (connection timeout)', () => {
      // n8n still responds, but without JIRA workflow.status data
      const partialResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          time_tracking: {
            default_issue: 'TESTPROJ-1',
            pricing: {
              'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
            },
            agent_defaults: { coordinator: 'agent_coordinator' },
          },
          jira: {
            transitions: { start_work: 'In Progress', complete_work: 'Done' },
            tempo_accounts: { DEV_ACC: '12345' },
          },
        },
      }
      setupFetchResponse(partialResponse)
    })

    When('the config plugin executes the full sync flow', () => {
      flowResult = executeFullSyncFlow()
    })

    Then('the n8n node responds with HTTP 200', async () => {
      await flowResult
      expect(capturedFetchCalls).toHaveLength(1)
    })

    And('the response contains time_tracking section with valid data', () => {
      const config = getParsedConfig()
      expect(config.time_tracking).toBeDefined()
      expect(deepGet(config, 'time_tracking.pricing')).toBeDefined()
    })

    And('the response contains jira section without workflow.status (only Sheet-based data)', () => {
      const config = getParsedConfig()
      expect(config.jira).toBeDefined()
      expect(deepGet(config, 'jira.workflow.status')).toBeUndefined()
    })

    And('the SchemaValidator validates the time_tracking section successfully', () => {
      const config = getParsedConfig()
      expect(config.time_tracking).toBeDefined()
    })

    And('the SchemaValidator skips or validates the partial jira section', () => {
      const config = getParsedConfig()
      expect(config.jira).toBeDefined()
    })

    And('the ConfigMerger produces a final config', () => {
      const config = getParsedConfig()
      expect(Object.keys(config).length).toBeGreaterThan(0)
    })

    And('process.env.OPENCODE_PROJECT_CONFIG contains valid JSON', () => {
      expect(() => JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)).not.toThrow()
    })

    And('the parsed config contains time_tracking data from remote', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'time_tracking.pricing')).toBeDefined()
      expect(deepGet(config, 'time_tracking.agent_defaults.coordinator')).toBe('agent_coordinator')
    })

    And('the parsed config contains jira.project from local config', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
    })
  })

  // --- Scenario 3: Schema validation rejects invalid jira section ---

  Scenario('Schema validation rejects invalid jira section', ({ Given, And, But, When, Then }) => {
    Given('the Google Sheet mock returns valid data for all 6 tabs', () => {
      // Sheet data is embedded in the webhook response
    })

    And('the JIRA API mock returns valid statuses', () => {
      // JIRA data is embedded in the webhook response
    })

    But('the n8n node response contains an invalid jira section:', () => {
      const invalidResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: {
            workflow: {
              status: 'not-an-object' as unknown,
            },
          },
          time_tracking: {
            default_issue: 'TESTPROJ-1',
            pricing: {
              'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
            },
            agent_defaults: { coordinator: 'agent_coordinator' },
          },
        },
      }
      setupFetchResponse(invalidResponse)
    })

    And('the n8n node response contains a valid time_tracking section', () => {
      // Already set up in the previous step
    })

    When('the config plugin executes the full sync flow', () => {
      flowResult = executeFullSyncFlow()
    })

    Then('the SchemaValidator rejects the jira section with a validation error', async () => {
      await flowResult
      const warnings = logMessages.filter(
        (m) => m.level === 'warn' && m.message.includes('jira') && m.message.includes('failed schema validation'),
      )
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    And('the SchemaValidator accepts the time_tracking section', () => {
      const config = getParsedConfig()
      expect(config.time_tracking).toBeDefined()
    })

    And('a warning is logged for the skipped jira section', () => {
      const warnings = logMessages.filter(
        (m) => m.level === 'warn' && m.message.includes('jira'),
      )
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    And('the ConfigMerger merges only the valid time_tracking section with local config', () => {
      const config = getParsedConfig()
      expect(config.time_tracking).toBeDefined()
      expect(deepGet(config, 'time_tracking.pricing')).toBeDefined()
    })

    And('process.env.OPENCODE_PROJECT_CONFIG contains valid JSON', () => {
      expect(() => JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)).not.toThrow()
    })

    And('the parsed config contains time_tracking data from remote', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'time_tracking.pricing')).toBeDefined()
    })

    And('the parsed config does not contain remote jira.workflow.status', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.workflow.status')).toBeUndefined()
    })

    And('the parsed config contains jira.project from local config', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
    })
  })

  // --- Scenario 4: Version conflict ---

  Scenario('Version conflict - n8n response version too high', ({ Given, And, When, Then }) => {
    Given('the Google Sheet mock returns valid data for all 6 tabs', () => {
      // Sheet data is embedded in the webhook response
    })

    And('the JIRA API mock returns valid statuses', () => {
      // JIRA data is embedded in the webhook response
    })

    And('the n8n node responds with version "99.0.0"', () => {
      const versionConflictResponse: SyncResponse = {
        version: '99.0.0',
        config: {
          jira: {
            workflow: { status: { open: 'Open' } },
          },
          time_tracking: {
            pricing: { 'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 } },
          },
        },
      }
      setupFetchResponse(versionConflictResponse)
    })

    When('the config plugin executes the full sync flow', () => {
      flowResult = executeFullSyncFlow()
    })

    Then('the ConfigSyncer detects a version incompatibility', async () => {
      await flowResult
      const warnings = logMessages.filter(
        (m) => m.level === 'warn' && m.message.includes('neuere Plugin-Version'),
      )
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    And('the entire remote response is discarded', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.workflow')).toBeUndefined()
    })

    And('a warning is logged about the version conflict', () => {
      const warnings = logMessages.filter(
        (m) => m.level === 'warn' && (m.message.includes('99.0.0') || m.message.includes('neuere Plugin-Version')),
      )
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    And('the ConfigMerger uses only the local config', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
      expect(deepGet(config, 'jira.base_url')).toBe('https://test.atlassian.net')
    })

    And('process.env.OPENCODE_PROJECT_CONFIG contains valid JSON', () => {
      expect(() => JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)).not.toThrow()
    })

    And('the parsed config contains jira.project = "TESTPROJ" from local config', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.project')).toBe('TESTPROJ')
    })

    And('the parsed config does not contain any remote-only fields', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.workflow')).toBeUndefined()
      expect(deepGet(config, 'time_tracking.pricing')).toBeUndefined()
      expect(deepGet(config, 'jira.tempo_accounts')).toBeUndefined()
    })
  })

  // --- Scenario 5: Local override wins ---

  Scenario('Local override wins in deep-merge', ({ Given, And, When, Then }) => {
    Given('the Google Sheet mock returns valid data with:', () => {
      const remoteResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          time_tracking: {
            default_issue: 'TESTPROJ-99',
            pricing: {
              'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
            },
            agent_defaults: { coordinator: 'agent_coordinator' },
          },
          jira: {
            base_url: 'https://remote.atlassian.net',
            workflow: {
              status: { open: 'Open', in_progress: 'In Progress' },
            },
            transitions: { start_work: 'In Progress', complete_work: 'Done' },
            tempo_accounts: { DEV_ACC: '12345' },
          },
        },
      }
      setupFetchResponse(remoteResponse)
    })

    And('the JIRA API mock returns valid statuses', () => {
      // JIRA data is embedded in the webhook response
    })

    And('the local config contains:', () => {
      const localConfig = {
        jira: {
          project: 'TESTPROJ',
          base_url: 'https://test.atlassian.net',
        },
        time_tracking: {
          enabled: true,
          default_issue: 'TESTPROJ-1',
        },
      }
      setupLocalConfig(localConfig)
    })

    When('the config plugin executes the full sync flow', () => {
      flowResult = executeFullSyncFlow()
    })

    Then('the ConfigMerger deep-merges remote (base) with local (override)', async () => {
      await flowResult
      const config = getParsedConfig()
      expect(config.jira).toBeDefined()
      expect(config.time_tracking).toBeDefined()
    })

    And('process.env.OPENCODE_PROJECT_CONFIG contains valid JSON', () => {
      expect(() => JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)).not.toThrow()
    })

    And('the parsed config contains time_tracking.default_issue = "TESTPROJ-1" (local wins)', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'time_tracking.default_issue')).toBe('TESTPROJ-1')
    })

    And('the parsed config contains jira.base_url = "https://test.atlassian.net" (local wins)', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.base_url')).toBe('https://test.atlassian.net')
    })

    And('the parsed config contains remote-only fields that were not overridden locally', () => {
      const config = getParsedConfig()
      expect(deepGet(config, 'jira.workflow.status')).toBeDefined()
      expect(deepGet(config, 'jira.transitions')).toBeDefined()
      expect(deepGet(config, 'jira.tempo_accounts')).toBeDefined()
      expect(deepGet(config, 'time_tracking.pricing')).toBeDefined()
      expect(deepGet(config, 'time_tracking.agent_defaults')).toBeDefined()
    })
  })
})

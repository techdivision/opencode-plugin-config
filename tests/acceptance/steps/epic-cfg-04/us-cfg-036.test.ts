/**
 * Acceptance Tests for US-CFG-036: Plugin Returns Empty Object (No Runtime Hooks)
 *
 * Tests that the config plugin always returns an empty object `{}` after
 * initialization, signaling to the plugin loader that no runtime hooks
 * (onMessage, onChat, etc.) need to be registered.
 *
 * Covers all return-value scenarios:
 * - Successful init with config merged
 * - Webhook failure with fallback to local config
 * - No config exists at all (empty config)
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 *
 * @see us-cfg-036-plugin-returns-empty.feature
 * @see config.ts - Entry point returns {} (no runtime hooks)
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'
import type { SyncResponse } from '../../../../src/types/SyncResponse.js'

// --- Hoisted mock instances (must be declared before vi.mock factories) ---

const {
  mockLogClient,
  mockMerger,
  mockLoader,
  mockSyncer,
  mockValidator,
  mockDiscovery,
  mockLogger,
} = vi.hoisted(() => ({
  mockLogClient: { log: vi.fn() },
  mockMerger: {
    merge: vi.fn(),
    mergeWithProtectedFields: vi.fn(),
  },
  mockLoader: {
    readGlobalConfig: vi.fn(),
    readProjectConfig: vi.fn(),
    resolveEnvVars: vi.fn(),
    loadLocalConfig: vi.fn(),
  },
  mockSyncer: { syncConfig: vi.fn() },
  mockValidator: {
    validateResponse: vi.fn(),
    validateSection: vi.fn(),
    buildSchemaMap: vi.fn(),
    deriveSectionKey: vi.fn(),
    filterUnknownSections: vi.fn(),
  },
  mockDiscovery: { discoverPlugins: vi.fn() },
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withLogging: vi.fn().mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn),
    withErrorHandling: vi.fn().mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn),
  },
}))

// --- Mock all service modules ---

vi.mock('../../../../src/services/ConfigMerger.js', () => ({
  ConfigMerger: vi.fn().mockImplementation(() => mockMerger),
}))

vi.mock('../../../../src/services/ConfigLoader.js', () => ({
  ConfigLoader: vi.fn().mockImplementation(() => mockLoader),
}))

vi.mock('../../../../src/services/ConfigSyncer.js', () => ({
  ConfigSyncer: vi.fn().mockImplementation(() => mockSyncer),
}))

vi.mock('../../../../src/services/SchemaValidator.js', () => ({
  SchemaValidator: vi.fn().mockImplementation(() => mockValidator),
}))

vi.mock('../../../../src/utils/PluginDiscovery.js', () => ({
  PluginDiscovery: vi.fn().mockImplementation(() => mockDiscovery),
}))

vi.mock('../../../../src/utils/PluginLogger.js', () => ({
  createPluginLogger: vi.fn().mockReturnValue(mockLogger),
}))

// Import the module under test (mocks are hoisted, so this gets the mocked version)
import { ConfigPlugin } from '../../../../src/config.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-036-plugin-returns-empty.feature',
)

describeFeature(feature, ({ Scenario }) => {
  let pluginInput: any
  let result: any

  const defaultPlugins = new Map<string, PluginDescriptor>([
    ['config', { name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' }],
  ])

  /** Known OpenCode runtime hook names that MUST NOT be present in the return value. */
  const RUNTIME_HOOK_NAMES = [
    'onMessage',
    'onChat',
    'onTool',
    'onCommand',
    'onError',
    'onInit',
    'onShutdown',
  ]

  /**
   * Helper: set up default mocks for a clean test run.
   * Resets all mocks and configures the plugin input.
   */
  function setupDefaults(): void {
    delete process.env.OPENCODE_PROJECT_CONFIG
    vi.clearAllMocks()
    result = undefined

    mockLogger.withLogging.mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn)
    mockLogger.withErrorHandling.mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn)

    pluginInput = {
      client: mockLogClient,
      directory: '/test/project',
      project: {},
      worktree: '/test/project',
      serverUrl: new URL('http://localhost:3000'),
      $: {} as any,
    }

    mockDiscovery.discoverPlugins.mockReturnValue(defaultPlugins)
  }

  // --- Scenario 1: Plugin returns empty object on successful init ---

  Scenario(
    'Plugin returns empty object on successful init',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      const syncResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { base_url: 'https://remote.atlassian.net' },
        },
      }

      const validatedRemoteConfig = {
        jira: { base_url: 'https://remote.atlassian.net' },
      }

      const finalMergedConfig = {
        jira: { project: 'COPSPA', base_url: 'https://remote.atlassian.net' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      Given('the config plugin has completed its initialization', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
        mockSyncer.syncConfig.mockResolvedValue(syncResponse)
        mockValidator.validateResponse.mockReturnValue(validatedRemoteConfig)
        mockMerger.mergeWithProtectedFields.mockReturnValue(finalMergedConfig)
      })

      And('process.env.OPENCODE_PROJECT_CONFIG has been set', async () => {
        result = await ConfigPlugin(pluginInput)
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
      })

      When('the plugin function returns', () => {
        // Result was already captured in the And step above
        expect(result).toBeDefined()
      })

      Then('the return value is an empty object {}', () => {
        expect(result).toEqual({})
        expect(Object.keys(result)).toHaveLength(0)
      })

      And('no hooks are registered (no "onMessage", "onChat", etc.)', () => {
        for (const hookName of RUNTIME_HOOK_NAMES) {
          expect(result).not.toHaveProperty(hookName)
        }
      })
    },
  )

  // --- Scenario 2: Plugin returns empty object even when webhook fails ---

  Scenario(
    'Plugin returns empty object even when webhook fails',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      Given('the config plugin initialization encountered a webhook error', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
        // ConfigSyncer returns null on webhook failure (graceful degradation)
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      And('the fallback to local config was applied', () => {
        // When syncConfig returns null, the entry point uses local config as-is
        // No merge or validation happens — verified in the Then steps
      })

      When('the plugin function returns', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the return value is an empty object {}', () => {
        expect(result).toEqual({})
        expect(Object.keys(result)).toHaveLength(0)
      })

      And('the plugin does not throw an error', () => {
        // If we reached this point, no error was thrown.
        // Additionally verify the local config was written as fallback.
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(localConfig)
      })
    },
  )

  // --- Scenario 3: Plugin returns empty object when no config exists ---

  Scenario(
    'Plugin returns empty object when no config exists',
    ({ Given, When, Then, And }) => {
      Given('no local config and no webhook response is available', () => {
        setupDefaults()
        // ConfigLoader returns {} when no config file exists
        mockLoader.loadLocalConfig.mockReturnValue({})
        // ConfigSyncer returns null when no sync_url or webhook fails
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      When('the plugin function returns', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the return value is an empty object {}', () => {
        expect(result).toEqual({})
        expect(Object.keys(result)).toHaveLength(0)
      })

      And('process.env.OPENCODE_PROJECT_CONFIG is set to "{}"', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBe('{}')
      })
    },
  )
})

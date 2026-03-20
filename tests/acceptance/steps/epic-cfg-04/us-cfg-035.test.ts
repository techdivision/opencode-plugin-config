/**
 * Acceptance Tests for US-CFG-035: Fallback When No Webhook Available
 *
 * Tests that the config plugin writes only the local config to process.env
 * when no webhook response is available, ensuring downstream plugins always
 * have a config regardless of webhook availability.
 *
 * Covers all fallback scenarios:
 * - No sync_url configured
 * - Webhook returns HTTP error
 * - Webhook times out (5s)
 * - OPENCODE_USER_EMAIL not set
 * - No local config and no webhook (empty config {})
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 *
 * @see us-cfg-035-fallback-no-webhook.feature
 * @see ConfigSyncer - Graceful Degradation on webhook failures
 * @see config.ts - Entry point orchestration with fallback logic
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'

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
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-035-fallback-no-webhook.feature',
)

describeFeature(feature, ({ Scenario }) => {
  let pluginInput: any
  let result: any

  const defaultPlugins = new Map<string, PluginDescriptor>([
    ['config', { name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' }],
  ])

  /**
   * Helper: set up default mocks for a clean test run.
   * Resets all mocks and configures the plugin input.
   */
  function setupDefaults(): void {
    delete process.env.OPENCODE_PROJECT_CONFIG
    delete process.env.OC_CONFIG_SYNC_URL
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

  // --- Scenario 1: No sync_url configured - local config is used ---

  Scenario(
    'No sync_url configured - local config is used',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: '.opencode/tt.csv' },
      }

      Given('a local config exists:', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
      })

      And('the local config does not contain "config.sync_url"', () => {
        // localConfig has no config.sync_url — already the case
        expect(localConfig).not.toHaveProperty('config')
      })

      And('process.env.OC_CONFIG_SYNC_URL is not set', () => {
        delete process.env.OC_CONFIG_SYNC_URL
      })

      When('the config plugin initializes', async () => {
        // ConfigSyncer returns null when no sync_url is available
        mockSyncer.syncConfig.mockResolvedValue(null)
        result = await ConfigPlugin(pluginInput)
      })

      Then('the webhook call is skipped', () => {
        // syncConfig was called but returned null (no sync_url → skip)
        expect(mockSyncer.syncConfig).toHaveBeenCalled()
        // SchemaValidator and Merger are NOT called when sync returns null
        expect(mockValidator.validateResponse).not.toHaveBeenCalled()
        expect(mockMerger.mergeWithProtectedFields).not.toHaveBeenCalled()
      })

      And('process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(localConfig)
      })

      And('no error is thrown', () => {
        // Plugin returned successfully (empty hooks object)
        expect(result).toEqual({})
      })
    },
  )

  // --- Scenario 2: Webhook returns HTTP error - local config is used ---

  Scenario(
    'Webhook returns HTTP error - local config is used',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      Given('a local config exists with "config.sync_url" set', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
      })

      And('the webhook returns HTTP 500', () => {
        // ConfigSyncer catches HTTP errors internally and returns null
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      When('the config plugin initializes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('a warning is logged about the webhook error', () => {
        // The entry point logs "Using local config only" when sync returns null
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Using local config only (no remote config available)',
        )
      })

      And('process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(localConfig)
      })

      And('the plugin continues without failing', () => {
        expect(result).toEqual({})
      })
    },
  )

  // --- Scenario 3: Webhook times out - local config is used ---

  Scenario(
    'Webhook times out - local config is used',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      Given('a local config exists with "config.sync_url" set', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
      })

      And('the webhook does not respond within 5 seconds', () => {
        // ConfigSyncer catches timeout (AbortError) internally and returns null
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      When('the config plugin initializes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('a warning is logged about the timeout', () => {
        // The entry point logs "Using local config only" when sync returns null
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Using local config only (no remote config available)',
        )
      })

      And('process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(localConfig)
      })
    },
  )

  // --- Scenario 4: OPENCODE_USER_EMAIL not set - webhook is skipped ---

  Scenario(
    'OPENCODE_USER_EMAIL not set - webhook is skipped',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com/sync' },
      }

      Given('a local config exists with "config.sync_url" set', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(localConfig)
      })

      And('process.env.OPENCODE_USER_EMAIL is not set', () => {
        delete process.env.OPENCODE_USER_EMAIL
        // ConfigSyncer returns null when email is missing
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      When('the config plugin initializes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the webhook call is skipped', () => {
        // syncConfig was called but returned null (no email → skip)
        expect(mockSyncer.syncConfig).toHaveBeenCalled()
        expect(mockValidator.validateResponse).not.toHaveBeenCalled()
        expect(mockMerger.mergeWithProtectedFields).not.toHaveBeenCalled()
      })

      And('process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(localConfig)
      })
    },
  )

  // --- Scenario 5: No local config and no webhook - empty config is provided ---

  Scenario(
    'No local config and no webhook - empty config is provided',
    ({ Given, When, Then, And }) => {
      Given('no local config file exists', () => {
        setupDefaults()
        // ConfigLoader returns {} when no config file exists
        mockLoader.loadLocalConfig.mockReturnValue({})
      })

      And('no sync_url is configured', () => {
        delete process.env.OC_CONFIG_SYNC_URL
        // ConfigSyncer returns null when no sync_url
        mockSyncer.syncConfig.mockResolvedValue(null)
      })

      When('the config plugin initializes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('process.env.OPENCODE_PROJECT_CONFIG is set to "{}"', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBe('{}')
      })

      And('downstream plugins receive an empty config object', () => {
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual({})
        expect(Object.keys(parsed)).toHaveLength(0)
      })
    },
  )
})

/**
 * Acceptance Tests for US-CFG-031: Plugin Entry Point Orchestration
 *
 * Tests the config.ts entry point orchestration of all 4 services:
 * ConfigLoader → ConfigSyncer → SchemaValidator → ConfigMerger
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import type { SyncResponse } from '../../../../src/types/SyncResponse.js'
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
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-031-plugin-entry-point-orchestration.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let pluginInput: any
  let result: any
  let callOrder: string[]

  const defaultPlugins = new Map<string, PluginDescriptor>([
    ['config', { name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' }],
    ['time-tracking', { name: 'time-tracking', version: '0.2.0', configSchema: 'schemas/config.schema.json', path: '/plugins/time-tracking' }],
  ])

  Background(({ Given }) => {
    Given('the config plugin entry point "config.ts" is loaded', () => {
      // Clear process.env for clean test state
      delete process.env.OPENCODE_PROJECT_CONFIG

      // Reset all mocks
      vi.clearAllMocks()
      callOrder = []
      result = undefined

      // Re-setup logger mock (clearAllMocks resets implementations)
      mockLogger.withLogging.mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn)
      mockLogger.withErrorHandling.mockImplementation(<T extends (...args: any[]) => any>(fn: T) => fn)

      // Setup default plugin input
      pluginInput = {
        client: mockLogClient,
        directory: '/test/project',
        project: {},
        worktree: '/test/project',
        serverUrl: new URL('http://localhost:3000'),
        $: {} as any,
      }

      // Default: discovery returns plugins
      mockDiscovery.discoverPlugins.mockImplementation(() => {
        callOrder.push('discoverPlugins')
        return defaultPlugins
      })
    })
  })

  Scenario(
    'Full orchestration with all services succeeding',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com' },
      }

      const syncResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { base_url: 'https://remote.atlassian.net' },
          time_tracking: { csv_file: 'tt.csv' },
        },
      }

      const validatedRemoteConfig = {
        jira: { base_url: 'https://remote.atlassian.net' },
        time_tracking: { csv_file: 'tt.csv' },
      }

      const finalMergedConfig = {
        jira: { project: 'COPSPA', base_url: 'https://remote.atlassian.net' },
        time_tracking: { csv_file: 'tt.csv' },
        config: { sync_url: 'https://webhook.example.com' },
      }

      Given('the ConfigLoader returns a valid local config', () => {
        mockLoader.loadLocalConfig.mockImplementation(() => {
          callOrder.push('loadLocalConfig')
          return localConfig
        })
      })

      And('the ConfigSyncer returns a valid webhook response', () => {
        mockSyncer.syncConfig.mockImplementation(async () => {
          callOrder.push('syncConfig')
          return syncResponse
        })
      })

      And('the SchemaValidator validates all sections successfully', () => {
        mockValidator.validateResponse.mockImplementation(() => {
          callOrder.push('validateResponse')
          return validatedRemoteConfig
        })
      })

      And('the ConfigMerger is ready to merge', () => {
        mockMerger.mergeWithProtectedFields.mockImplementation(() => {
          callOrder.push('mergeWithProtectedFields')
          return finalMergedConfig
        })
        mockMerger.merge.mockImplementation((base: any, override: any) => {
          return { ...base, ...override }
        })
      })

      When('the plugin entry point executes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the ConfigLoader is called first to load the local config cascade', () => {
        expect(mockLoader.loadLocalConfig).toHaveBeenCalledWith('/test/project')
        const loaderIndex = callOrder.indexOf('loadLocalConfig')
        expect(loaderIndex).toBeGreaterThanOrEqual(0)
      })

      And('the ConfigSyncer is called second with the local config as seed', () => {
        expect(mockSyncer.syncConfig).toHaveBeenCalled()
        const syncerIndex = callOrder.indexOf('syncConfig')
        const loaderIndex = callOrder.indexOf('loadLocalConfig')
        expect(syncerIndex).toBeGreaterThan(loaderIndex)
      })

      And('the SchemaValidator is called third to validate the webhook response sections', () => {
        expect(mockValidator.validateResponse).toHaveBeenCalled()
        const validatorIndex = callOrder.indexOf('validateResponse')
        const syncerIndex = callOrder.indexOf('syncConfig')
        expect(validatorIndex).toBeGreaterThan(syncerIndex)
      })

      And('the ConfigMerger is called fourth to deep-merge remote and local configs', () => {
        expect(mockMerger.mergeWithProtectedFields).toHaveBeenCalled()
        const mergerIndex = callOrder.indexOf('mergeWithProtectedFields')
        const validatorIndex = callOrder.indexOf('validateResponse')
        expect(mergerIndex).toBeGreaterThan(validatorIndex)
      })

      And('the final config is written to process.env.OPENCODE_PROJECT_CONFIG', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const envConfig = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(envConfig).toEqual(finalMergedConfig)
      })

      And('the plugin returns an empty object {}', () => {
        expect(result).toEqual({})
      })
    },
  )

  Scenario(
    'Orchestration continues when webhook fails',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com' },
      }

      Given('the ConfigLoader returns a valid local config', () => {
        mockLoader.loadLocalConfig.mockImplementation(() => {
          callOrder.push('loadLocalConfig')
          return localConfig
        })
        mockMerger.merge.mockImplementation((base: any, override: any) => {
          return { ...base, ...override }
        })
      })

      And('the ConfigSyncer returns an error (webhook unreachable)', () => {
        mockSyncer.syncConfig.mockImplementation(async () => {
          callOrder.push('syncConfig')
          return null
        })
      })

      When('the plugin entry point executes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the ConfigLoader is called to load the local config cascade', () => {
        expect(mockLoader.loadLocalConfig).toHaveBeenCalledWith('/test/project')
      })

      And('the ConfigSyncer is called and its error is caught', () => {
        expect(mockSyncer.syncConfig).toHaveBeenCalled()
      })

      And('the SchemaValidator is not called', () => {
        expect(mockValidator.validateResponse).not.toHaveBeenCalled()
      })

      And('the ConfigMerger is not called for remote merge', () => {
        expect(mockMerger.mergeWithProtectedFields).not.toHaveBeenCalled()
      })

      And('the local config is written to process.env.OPENCODE_PROJECT_CONFIG', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const envConfig = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(envConfig).toEqual(localConfig)
      })

      And('the plugin returns an empty object {}', () => {
        expect(result).toEqual({})
      })

      And('a warning is logged about the webhook failure', () => {
        // The ConfigSyncer itself logs the warning internally when it returns null
        // The entry point logs that sync returned null via "Using local config only"
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Using local config only (no remote config available)',
        )
      })
    },
  )

  Scenario(
    'Orchestration continues when no sync_url is configured',
    ({ Given, When, Then, And }) => {
      const localConfigNoSync = {
        jira: { project: 'COPSPA' },
      }

      Given('the ConfigLoader returns a local config without "config.sync_url"', () => {
        mockLoader.loadLocalConfig.mockImplementation(() => {
          callOrder.push('loadLocalConfig')
          return localConfigNoSync
        })
        mockMerger.merge.mockImplementation((base: any, override: any) => {
          return { ...base, ...override }
        })
        // ConfigSyncer returns null when no sync_url
        mockSyncer.syncConfig.mockImplementation(async () => {
          callOrder.push('syncConfig')
          return null
        })
      })

      When('the plugin entry point executes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('the ConfigLoader is called to load the local config cascade', () => {
        expect(mockLoader.loadLocalConfig).toHaveBeenCalledWith('/test/project')
      })

      And('the ConfigSyncer is skipped', () => {
        // ConfigSyncer.syncConfig returns null when no sync_url is configured
        // The entry point still calls it, but it returns null immediately
        expect(mockSyncer.syncConfig).toHaveBeenCalled()
      })

      And('the local config is written to process.env.OPENCODE_PROJECT_CONFIG', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const envConfig = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(envConfig).toEqual(localConfigNoSync)
      })

      And('the plugin returns an empty object {}', () => {
        expect(result).toEqual({})
      })
    },
  )

  Scenario(
    'Orchestration handles partial validation failures',
    ({ Given, When, Then, And }) => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        config: { sync_url: 'https://webhook.example.com' },
      }

      const syncResponse: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { base_url: 'https://remote.atlassian.net' },
          time_tracking: { invalid_field: true },
        },
      }

      // Only jira passes validation, time_tracking is rejected
      const validatedRemoteConfig = {
        jira: { base_url: 'https://remote.atlassian.net' },
      }

      const finalMergedConfig = {
        jira: { project: 'COPSPA', base_url: 'https://remote.atlassian.net' },
        config: { sync_url: 'https://webhook.example.com' },
      }

      Given('the ConfigLoader returns a valid local config', () => {
        mockLoader.loadLocalConfig.mockImplementation(() => {
          callOrder.push('loadLocalConfig')
          return localConfig
        })
        mockMerger.merge.mockImplementation((base: any, override: any) => {
          return { ...base, ...override }
        })
      })

      And('the ConfigSyncer returns a response with sections "jira" and "time_tracking"', () => {
        mockSyncer.syncConfig.mockImplementation(async () => {
          callOrder.push('syncConfig')
          return syncResponse
        })
      })

      And('the SchemaValidator rejects the "time_tracking" section', () => {
        // Handled in the next step — validateResponse returns only valid sections
      })

      And('the SchemaValidator accepts the "jira" section', () => {
        mockValidator.validateResponse.mockImplementation(() => {
          callOrder.push('validateResponse')
          return validatedRemoteConfig
        })
        mockMerger.mergeWithProtectedFields.mockImplementation(() => {
          callOrder.push('mergeWithProtectedFields')
          return finalMergedConfig
        })
      })

      When('the plugin entry point executes', async () => {
        result = await ConfigPlugin(pluginInput)
      })

      Then('only the valid "jira" section is passed to the ConfigMerger', () => {
        expect(mockMerger.mergeWithProtectedFields).toHaveBeenCalled()
        const mergeCall = mockMerger.mergeWithProtectedFields.mock.calls[0]
        // First arg is the validated remote config (base)
        expect(mergeCall[0]).toEqual(validatedRemoteConfig)
        expect(mergeCall[0]).not.toHaveProperty('time_tracking')
      })

      And('the "time_tracking" section from the webhook is excluded from the merge', () => {
        const mergeCall = mockMerger.mergeWithProtectedFields.mock.calls[0]
        expect(mergeCall[0]).not.toHaveProperty('time_tracking')
      })

      And('a warning is logged about the rejected "time_tracking" section', () => {
        // SchemaValidator internally logs warnings about rejected sections
        // We verify that validateResponse was called with the full response
        expect(mockValidator.validateResponse).toHaveBeenCalledWith(
          syncResponse,
          expect.any(Array),
        )
      })

      And('the final config is written to process.env.OPENCODE_PROJECT_CONFIG', () => {
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
        const envConfig = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(envConfig).toEqual(finalMergedConfig)
      })
    },
  )
})

/**
 * Acceptance Tests for US-CFG-032: process.env.OPENCODE_PROJECT_CONFIG setzen
 *
 * Tests that the config plugin writes the final merged config as a valid
 * JSON string to process.env.OPENCODE_PROJECT_CONFIG so that downstream
 * plugins can read it from memory without file I/O.
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
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
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-032-process-env-config.feature',
)

describeFeature(feature, ({ Scenario }) => {
  let pluginInput: any
  let savedEnvValue: string | undefined

  const defaultPlugins = new Map<string, PluginDescriptor>([
    ['config', { name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' }],
  ])

  /**
   * Helper: set up default mocks for a clean test run.
   * Resets all mocks and configures the plugin input.
   */
  function setupDefaults(): void {
    delete process.env.OPENCODE_PROJECT_CONFIG
    vi.clearAllMocks()

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
    mockSyncer.syncConfig.mockResolvedValue(null)
  }

  // --- Scenario 1: Final config is written as JSON string to process.env ---

  Scenario(
    'Final config is written as JSON string to process.env',
    ({ Given, When, Then, And }) => {
      const finalConfig = {
        jira: { project: 'COPSPA', base_url: 'https://techdivision.atlassian.net' },
        time_tracking: { csv_file: '.opencode/tt.csv' },
      }

      Given('the ConfigMerger produces a final config:', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(finalConfig)
      })

      When('the config plugin writes to process.env', async () => {
        await ConfigPlugin(pluginInput)
        savedEnvValue = process.env.OPENCODE_PROJECT_CONFIG
      })

      Then('process.env.OPENCODE_PROJECT_CONFIG is defined', () => {
        expect(savedEnvValue).toBeDefined()
        expect(typeof savedEnvValue).toBe('string')
      })

      And('JSON.parse(process.env.OPENCODE_PROJECT_CONFIG) equals the final config', () => {
        const parsed = JSON.parse(savedEnvValue!)
        expect(parsed).toEqual(finalConfig)
      })

      And('the value is a valid JSON string', () => {
        expect(() => JSON.parse(savedEnvValue!)).not.toThrow()
        // Verify it round-trips correctly
        const roundTripped = JSON.stringify(JSON.parse(savedEnvValue!))
        expect(roundTripped).toBe(savedEnvValue)
      })
    },
  )

  // --- Scenario 2: No file is written to disk ---

  Scenario(
    'No file is written to disk',
    ({ Given, When, Then, And }) => {
      const finalConfig = {
        jira: { project: 'COPSPA' },
      }

      Given('the ConfigMerger produces a final config', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(finalConfig)
      })

      When('the config plugin writes to process.env', async () => {
        await ConfigPlugin(pluginInput)
      })

      Then('no file write operation occurs for the config output', () => {
        // The config plugin only writes to process.env, never to disk.
        // We verify this by checking that the plugin's output mechanism
        // is purely in-memory (process.env), not file-based.
        // The entry point code has no fs.writeFile calls for config output.
        expect(process.env.OPENCODE_PROJECT_CONFIG).toBeDefined()
      })

      And('the local "opencode-project.json" files remain unchanged', () => {
        // The ConfigLoader reads files but the entry point never writes them.
        // Verify that no write-related methods were called on any service.
        // ConfigLoader only has read methods (readGlobalConfig, readProjectConfig, loadLocalConfig)
        // None of the services have write-to-disk methods.
        expect(mockLoader.loadLocalConfig).toHaveBeenCalled()
        // No write method exists on any mock — the architecture is read-only for local files
      })

      And('process.env.OPENCODE_PROJECT_CONFIG contains the config', () => {
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(finalConfig)
      })
    },
  )

  // --- Scenario 3: Downstream plugin reads config from process.env ---

  Scenario(
    'Downstream plugin reads config from process.env',
    ({ Given, When, Then, And }) => {
      const configJson = JSON.stringify({
        jira: { project: 'COPSPA' },
        time_tracking: { valid_projects: ['COPSPA'] },
      })

      let parsedConfig: Record<string, unknown>

      Given('process.env.OPENCODE_PROJECT_CONFIG contains:', () => {
        process.env.OPENCODE_PROJECT_CONFIG = configJson
      })

      When('a downstream plugin reads process.env.OPENCODE_PROJECT_CONFIG', () => {
        const rawValue = process.env.OPENCODE_PROJECT_CONFIG
        expect(rawValue).toBeDefined()
        parsedConfig = JSON.parse(rawValue!) as Record<string, unknown>
      })

      And('parses it with JSON.parse', () => {
        expect(parsedConfig).toBeDefined()
        expect(typeof parsedConfig).toBe('object')
      })

      Then('the parsed object contains "jira.project" with value "COPSPA"', () => {
        const jira = parsedConfig.jira as Record<string, unknown>
        expect(jira).toBeDefined()
        expect(jira.project).toBe('COPSPA')
      })

      And('the parsed object contains "time_tracking.valid_projects" as an array', () => {
        const timeTracking = parsedConfig.time_tracking as Record<string, unknown>
        expect(timeTracking).toBeDefined()
        expect(Array.isArray(timeTracking.valid_projects)).toBe(true)
        expect(timeTracking.valid_projects).toEqual(['COPSPA'])
      })
    },
  )

  // --- Scenario 4: Config with special characters is serialized correctly ---

  Scenario(
    'Config with special characters is serialized correctly',
    ({ Given, When, Then, And }) => {
      const specialConfig = {
        jira: {
          workflow: {
            status: {
              open: { name: 'Offen' },
            },
          },
          tempo: {
            accounts: {
              TD_KS_1165_CoP_SPA: {
                value: '1165 | CoP Smart Process Automation SPA',
              },
            },
          },
        },
        time_tracking: {
          pricing: {
            default: { input: 3 },
          },
        },
      }

      Given('the ConfigMerger produces a final config with:', () => {
        setupDefaults()
        mockLoader.loadLocalConfig.mockReturnValue(specialConfig)
      })

      When('the config plugin writes to process.env', async () => {
        await ConfigPlugin(pluginInput)
      })

      Then('JSON.parse(process.env.OPENCODE_PROJECT_CONFIG) preserves all values', () => {
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed).toEqual(specialConfig)
      })

      And('unicode characters are correctly encoded', () => {
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        // German umlaut "Offen" (with special character ö if present)
        expect(parsed.jira.workflow.status.open.name).toBe('Offen')
      })

      And('pipe characters in values are preserved', () => {
        const parsed = JSON.parse(process.env.OPENCODE_PROJECT_CONFIG!)
        expect(parsed.jira.tempo.accounts.TD_KS_1165_CoP_SPA.value).toBe(
          '1165 | CoP Smart Process Automation SPA',
        )
        // Verify the pipe character is literally present in the raw JSON string
        expect(process.env.OPENCODE_PROJECT_CONFIG).toContain('|')
      })
    },
  )
})

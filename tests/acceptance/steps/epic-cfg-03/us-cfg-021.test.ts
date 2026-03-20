/**
 * Acceptance Tests for US-CFG-021: Plugin Schema Resolution
 *
 * Validates that the SchemaValidator correctly resolves JSON schema files
 * from PluginDescriptor metadata and builds a schema map for section-level
 * validation.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-021-plugin-schema-resolution.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(),
  }
})

import { readFileSync } from 'node:fs'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-021-plugin-schema-resolution.feature',
)

/**
 * Parse a key-value Gherkin table into a Record.
 *
 * @remarks
 * vitest-cucumber treats the first row as headers. For a 2-column key-value
 * table like `| pluginName | time-tracking |`, the first row becomes headers
 * `['pluginName', 'time-tracking']` and subsequent rows are objects with those keys.
 * This helper reconstructs the original key-value mapping.
 */
function parseKeyValueTable(
  headers: [string, string],
  rows: Array<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {}
  result[headers[0]] = headers[1]
  for (const row of rows) {
    const key = row[headers[0]]!
    const value = row[headers[1]]!
    result[key] = value
  }
  return result
}

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let descriptor: PluginDescriptor
  let sectionKey: string
  let schemaMap: Map<string, object>
  let plugins: PluginDescriptor[]

  Background(({ Given }) => {
    Given('the SchemaValidator service is initialized', () => {
      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withLogging: vi.fn(),
        withErrorHandling: vi.fn(),
      }
      validator = new SchemaValidator(mockLogger)
      sectionKey = ''
      schemaMap = new Map()
      plugins = []
      vi.mocked(readFileSync).mockReset()
    })
  })

  Scenario('Resolve schema from PluginDescriptor with configSchema', ({ Given, When, Then, And }) => {
    Given('a PluginDescriptor with the following properties:', (_ctx, table: Array<Record<string, string>>) => {
      const props = parseKeyValueTable(['pluginName', 'time-tracking'], table)
      const schema = { type: 'object', properties: {} }
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))
      descriptor = {
        name: props['pluginName']!,
        version: '1.0.0',
        configSchema: props['configSchema']!,
        path: props['rootDir']!,
      }
    })

    When('the schema is resolved for this plugin', () => {
      schemaMap = validator.buildSchemaMap([descriptor])
    })

    Then('the schema path is "/path/to/opencode-plugin-time-tracking/schemas/config.schema.json"', () => {
      expect(readFileSync).toHaveBeenCalledWith(
        '/path/to/opencode-plugin-time-tracking/schemas/config.schema.json',
        'utf-8',
      )
    })

    And('the section key is "time_tracking"', () => {
      expect(schemaMap.has('time_tracking')).toBe(true)
    })
  })

  Scenario('Derive section key from plugin name with hyphens', ({ Given, When, Then }) => {
    Given('a PluginDescriptor with pluginName "time-tracking"', () => {
      descriptor = { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '' }
    })

    When('the section key is derived', () => {
      sectionKey = validator.deriveSectionKey(descriptor.name)
    })

    Then('the section key is "time_tracking"', () => {
      expect(sectionKey).toBe('time_tracking')
    })
  })

  Scenario('Derive section key from plugin name without hyphens', ({ Given, When, Then }) => {
    Given('a PluginDescriptor with pluginName "marp"', () => {
      descriptor = { name: 'marp', version: '1.0.0', configSchema: null, path: '' }
    })

    When('the section key is derived', () => {
      sectionKey = validator.deriveSectionKey(descriptor.name)
    })

    Then('the section key is "marp"', () => {
      expect(sectionKey).toBe('marp')
    })
  })

  Scenario('Skip plugin without configSchema', ({ Given, When, Then, And }) => {
    Given('a PluginDescriptor with the following properties:', (_ctx, table: Array<Record<string, string>>) => {
      const props = parseKeyValueTable(['pluginName', 'shell-env'], table)
      descriptor = {
        name: props['pluginName']!,
        version: '1.0.0',
        configSchema: props['configSchema'] === 'null' ? null : (props['configSchema'] ?? null),
        path: props['rootDir']!,
      }
    })

    When('the schema is resolved for this plugin', () => {
      schemaMap = validator.buildSchemaMap([descriptor])
    })

    Then('no schema is returned', () => {
      expect(schemaMap.size).toBe(0)
    })

    And('no error is raised', () => {
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  Scenario('Schema file does not exist on disk', ({ Given, When, Then, And }) => {
    Given('a PluginDescriptor with the following properties:', (_ctx, table: Array<Record<string, string>>) => {
      const props = parseKeyValueTable(['pluginName', 'time-tracking'], table)
      descriptor = {
        name: props['pluginName']!,
        version: '1.0.0',
        configSchema: props['configSchema']!,
        path: props['rootDir']!,
      }
    })

    And('the schema file does not exist at the resolved path', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })
    })

    When('the schema is resolved for this plugin', () => {
      schemaMap = validator.buildSchemaMap([descriptor])
    })

    Then('a warning is logged containing "schema file not found"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('schema file not found')
    })

    And('the section is treated as having no schema', () => {
      expect(schemaMap.size).toBe(0)
    })
  })

  Scenario('Schema file contains invalid JSON', ({ Given, When, Then, And }) => {
    Given('a PluginDescriptor with the following properties:', (_ctx, table: Array<Record<string, string>>) => {
      const props = parseKeyValueTable(['pluginName', 'time-tracking'], table)
      descriptor = {
        name: props['pluginName']!,
        version: '1.0.0',
        configSchema: props['configSchema']!,
        path: props['rootDir']!,
      }
    })

    And('the schema file contains invalid JSON', () => {
      vi.mocked(readFileSync).mockReturnValue('{ not valid json :::')
    })

    When('the schema is resolved for this plugin', () => {
      schemaMap = validator.buildSchemaMap([descriptor])
    })

    Then('a warning is logged containing "invalid schema JSON"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('invalid schema json')
    })

    And('the section is treated as having no schema', () => {
      expect(schemaMap.size).toBe(0)
    })
  })

  Scenario('Build schema map from multiple plugins', ({ Given, When, Then, And }) => {
    Given('the following PluginDescriptors are discovered:', (_ctx, table: Array<Record<string, string>>) => {
      const timeTrackingSchema = { type: 'object', properties: { csv_file: { type: 'string' } } }
      const configPluginSchema = { type: 'object', properties: { project: { type: 'string' } } }

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        if (String(filePath).includes('time-tracking')) {
          return JSON.stringify(timeTrackingSchema)
        }
        if (String(filePath).includes('config')) {
          return JSON.stringify(configPluginSchema)
        }
        throw new Error('ENOENT: no such file or directory')
      })

      plugins = table.map((row: Record<string, string>) => ({
        name: row['pluginName']!,
        version: '1.0.0',
        configSchema: row['configSchema'] === 'null' ? null : row['configSchema']!,
        path: `/plugins/${row['pluginName']}`,
      }))
    })

    When('the schema map is built', () => {
      schemaMap = validator.buildSchemaMap(plugins)
    })

    Then('the map contains 2 entries', () => {
      expect(schemaMap.size).toBe(2)
    })

    And('the map contains key "time_tracking"', () => {
      expect(schemaMap.has('time_tracking')).toBe(true)
    })

    And('the map contains key "config"', () => {
      expect(schemaMap.has('config')).toBe(true)
    })

    And('the map does not contain key "shell_env"', () => {
      expect(schemaMap.has('shell_env')).toBe(false)
    })
  })
})

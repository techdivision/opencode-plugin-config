/**
 * Acceptance Tests for US-CFG-024: Sections Without Schema
 *
 * Validates that the SchemaValidator accepts response sections from plugins
 * without a configSchema, handles mixed sections correctly, gracefully
 * handles missing schema files, and emits info-level logs for no-schema
 * acceptance.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-024-sections-without-schema.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'
import type { ValidatedConfig } from '../../../../src/types/ValidatedConfig.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(),
  }
})

import { readFileSync } from 'node:fs'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-024-sections-without-schema.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let plugins: PluginDescriptor[]
  let validatedResult: ValidatedConfig

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
      plugins = []
      validatedResult = {}
      vi.mocked(readFileSync).mockReset()
    })
  })

  Scenario('Section from plugin without configSchema is accepted', ({ Given, And, When, Then }) => {
    Given('a plugin "marp" is discovered without configSchema', () => {
      plugins = [
        { name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' },
      ]
    })

    And('the response contains a section "marp" with data:', (_ctx, docString: string) => {
      // docString contains the JSON data for the marp section
      // The actual data is set up in the When step via the response object
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            marp: { theme: 'default', output_dir: './slides' },
          },
        },
        plugins,
      )
    })

    Then('the section "marp" is included in the validated result without modification', () => {
      expect(validatedResult).toHaveProperty('marp')
      expect(validatedResult.marp).toEqual({ theme: 'default', output_dir: './slides' })
    })

    And('no validation is performed on the "marp" section', () => {
      // Since marp has no schema, readFileSync should not be called for it
      expect(readFileSync).not.toHaveBeenCalled()
    })

    And('no warning is logged for "marp"', () => {
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  Scenario('Mix of sections with and without schema', ({ Given, And, When, Then }) => {
    const timeTrackingSchema = {
      type: 'object',
      properties: {
        time_tracking: {
          type: 'object',
          properties: {
            csv_file: { type: 'string' },
          },
          required: ['csv_file'],
        },
      },
    }

    Given('the following plugins are discovered:', (_ctx, table: Array<Record<string, string>>) => {
      plugins = []
      for (const row of table) {
        if (row.hasSchema === 'yes') {
          plugins.push({
            name: row.pluginName,
            version: '1.0.0',
            configSchema: 'schemas/config.schema.json',
            path: `/plugins/${row.pluginName}`,
          })
        } else {
          plugins.push({
            name: row.pluginName,
            version: '1.0.0',
            configSchema: null,
            path: `/plugins/${row.pluginName}`,
          })
        }
      }

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath)
        if (pathStr.includes('time-tracking')) {
          return JSON.stringify(timeTrackingSchema)
        }
        throw new Error('ENOENT: no such file or directory')
      })
    })

    And('the response contains sections "time_tracking" and "marp"', () => {
      // Set up in When step
    })

    And('section "time_tracking" is valid against its schema', () => {
      // Data is valid — set up in When step
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            time_tracking: { csv_file: 'tt.csv' },
            marp: { theme: 'default' },
          },
        },
        plugins,
      )
    })

    Then('the section "time_tracking" is validated and included', () => {
      expect(validatedResult).toHaveProperty('time_tracking')
      expect(validatedResult.time_tracking).toEqual({ csv_file: 'tt.csv' })
    })

    And('the section "marp" is included without validation', () => {
      expect(validatedResult).toHaveProperty('marp')
      expect(validatedResult.marp).toEqual({ theme: 'default' })
    })

    And('the validated result contains both sections', () => {
      expect(Object.keys(validatedResult)).toHaveLength(2)
      expect(validatedResult).toHaveProperty('time_tracking')
      expect(validatedResult).toHaveProperty('marp')
    })
  })

  Scenario('Section without schema when schema file was not found', ({ Given, But, And, When, Then }) => {
    Given('a plugin "time-tracking" declares configSchema "schemas/config.schema.json"', () => {
      plugins = [
        {
          name: 'time-tracking',
          version: '1.0.0',
          configSchema: 'schemas/config.schema.json',
          path: '/plugins/time-tracking',
        },
      ]
    })

    But('the schema file does not exist at the resolved path', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })
    })

    And('the response contains section "time_tracking"', () => {
      // Set up in When step
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            time_tracking: { csv_file: 'tt.csv' },
          },
        },
        plugins,
      )
    })

    Then('a warning is logged about the missing schema file', () => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('schema file not found'),
      )
    })

    And('the section "time_tracking" is accepted without validation', () => {
      expect(validatedResult).toHaveProperty('time_tracking')
      expect(validatedResult.time_tracking).toEqual({ csv_file: 'tt.csv' })
    })
  })

  Scenario('Log message indicates no-schema acceptance', ({ Given, And, When, Then }) => {
    Given('a plugin "marp" is discovered without configSchema', () => {
      plugins = [
        { name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' },
      ]
    })

    And('the response contains section "marp"', () => {
      // Set up in When step
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            marp: { theme: 'default' },
          },
        },
        plugins,
      )
    })

    Then('an info-level log is emitted containing "marp" and "no schema" and "accepted"', () => {
      const infoCalls = vi.mocked(mockLogger.info).mock.calls
      const allInfoLogs = infoCalls.map((call) => String(call[0])).join(' ')
      expect(allInfoLogs).toContain('marp')
      expect(allInfoLogs).toContain('no schema')
      expect(allInfoLogs).toContain('accepted')
    })
  })
})

/**
 * Acceptance Tests for US-CFG-023: Section-Level Error Handling
 *
 * Validates that the SchemaValidator skips invalid sections while keeping
 * valid ones, logs warnings with section name and error details, and
 * continues validation after encountering an invalid section.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-023-section-error-handling.feature - Gherkin scenarios
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
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-023-section-error-handling.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let plugins: PluginDescriptor[]
  let validatedResult: ValidatedConfig

  const jiraSchema = {
    type: 'object',
    properties: {
      jira: {
        type: 'object',
        properties: {
          project: { type: 'string' },
        },
        required: ['project'],
      },
    },
  }

  const timeTrackingSchema = {
    type: 'object',
    properties: {
      time_tracking: {
        type: 'object',
        properties: {
          csv_file: { type: 'string' },
          global_default: {
            type: 'object',
            properties: {
              issue_key: { type: 'string', pattern: '^[A-Z][A-Z0-9]+-[0-9]+$' },
            },
          },
        },
        required: ['csv_file'],
      },
    },
  }

  function setupSchemaMap(schemas: Record<string, object>): void {
    vi.mocked(readFileSync).mockImplementation((filePath: any) => {
      const pathStr = String(filePath)
      for (const [pluginName, schema] of Object.entries(schemas)) {
        if (pathStr.includes(pluginName)) {
          return JSON.stringify(schema)
        }
      }
      throw new Error('ENOENT: no such file or directory')
    })
  }

  Background(({ Given, And }) => {
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

    And('plugin schemas exist for "time_tracking" and "jira"', () => {
      setupSchemaMap({ jira: jiraSchema, 'time-tracking': timeTrackingSchema })
      plugins = [
        { name: 'jira', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/jira' },
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/time-tracking' },
      ]
    })
  })

  Scenario('Invalid section is skipped, valid section is kept', ({ Given, When, Then, And }) => {
    let sections: Record<string, unknown>

    Given('the response contains sections:', (_ctx, table: Array<Record<string, string>>) => {
      sections = {}
      for (const row of table) {
        if (row.section === 'jira' && row.valid === 'yes') {
          sections.jira = { project: 'COPSPA' }
        } else if (row.section === 'jira' && row.valid === 'no') {
          sections.jira = { project: 42 }
        } else if (row.section === 'time_tracking' && row.valid === 'yes') {
          sections.time_tracking = { csv_file: 'tt.csv' }
        } else if (row.section === 'time_tracking' && row.valid === 'no') {
          sections.time_tracking = { csv_file: 123 }
        }
      }
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        { version: '0.1.0', config: sections },
        plugins,
      )
    })

    Then('the section "jira" is included in the validated result', () => {
      expect(validatedResult).toHaveProperty('jira')
    })

    And('the section "time_tracking" is excluded from the validated result', () => {
      expect(validatedResult).not.toHaveProperty('time_tracking')
    })

    And('a warning is logged for "time_tracking" containing the validation errors', () => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('time_tracking'),
      )
    })
  })

  Scenario('All sections valid - all are kept', ({ Given, When, Then, And }) => {
    let sections: Record<string, unknown>

    Given('the response contains sections:', (_ctx, table: Array<Record<string, string>>) => {
      sections = {}
      for (const row of table) {
        if (row.section === 'jira') {
          sections.jira = { project: 'COPSPA' }
        } else if (row.section === 'time_tracking') {
          sections.time_tracking = { csv_file: 'tt.csv' }
        }
      }
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        { version: '0.1.0', config: sections },
        plugins,
      )
    })

    Then('the section "jira" is included in the validated result', () => {
      expect(validatedResult).toHaveProperty('jira')
    })

    And('the section "time_tracking" is included in the validated result', () => {
      expect(validatedResult).toHaveProperty('time_tracking')
    })

    And('no warnings are logged', () => {
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  Scenario('All sections invalid - empty config returned', ({ Given, When, Then, And }) => {
    let sections: Record<string, unknown>

    Given('the response contains sections:', (_ctx, table: Array<Record<string, string>>) => {
      sections = {}
      for (const row of table) {
        if (row.section === 'jira') {
          sections.jira = { project: 42 }
        } else if (row.section === 'time_tracking') {
          sections.time_tracking = { csv_file: 123 }
        }
      }
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        { version: '0.1.0', config: sections },
        plugins,
      )
    })

    Then('the validated config contains no sections', () => {
      expect(Object.keys(validatedResult)).toHaveLength(0)
    })

    And('a warning is logged for "jira"', () => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('jira'),
      )
    })

    And('a warning is logged for "time_tracking"', () => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('time_tracking'),
      )
    })
  })

  Scenario('Warning log includes section name and error details', ({ Given, When, Then, And }) => {
    Given('the section "time_tracking" fails validation with error:', (_ctx, docString: string) => {
      // The docString describes the expected error pattern.
      // We set up a response that will produce this specific error.
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            time_tracking: {
              csv_file: 'tt.csv',
              global_default: { issue_key: 'invalid-key' },
            },
          },
        },
        plugins,
      )
    })

    Then('the warning log contains "time_tracking"', () => {
      const warnCalls = vi.mocked(mockLogger.warn).mock.calls
      const allWarnings = warnCalls.map((call) => String(call[0])).join(' ')
      expect(allWarnings).toContain('time_tracking')
    })

    And('the warning log contains "issue_key"', () => {
      const warnCalls = vi.mocked(mockLogger.warn).mock.calls
      const allWarnings = warnCalls.map((call) => String(call[0])).join(' ')
      expect(allWarnings).toContain('issue_key')
    })

    And('the warning log contains "pattern"', () => {
      const warnCalls = vi.mocked(mockLogger.warn).mock.calls
      const allWarnings = warnCalls.map((call) => String(call[0])).join(' ')
      expect(allWarnings).toContain('pattern')
    })
  })

  Scenario('Validation continues after encountering an invalid section', ({ Given, When, Then, And }) => {
    Given('the response contains 3 sections in order: "jira", "time_tracking", "marp"', () => {
      // Sections will be set up in subsequent steps
    })

    And('"jira" is valid', () => {
      // jira section with valid data — set up in When step
    })

    And('"time_tracking" is invalid', () => {
      // time_tracking section with invalid data — set up in When step
    })

    And('"marp" has no schema', () => {
      // marp is a known plugin but has no schema — add it to plugins
      plugins.push({ name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' })
    })

    When('the response is validated', () => {
      validatedResult = validator.validateResponse(
        {
          version: '0.1.0',
          config: {
            jira: { project: 'COPSPA' },
            time_tracking: { csv_file: 123 },
            marp: { theme: 'default' },
          },
        },
        plugins,
      )
    })

    Then('the section "jira" is included', () => {
      expect(validatedResult).toHaveProperty('jira')
    })

    And('the section "time_tracking" is excluded', () => {
      expect(validatedResult).not.toHaveProperty('time_tracking')
    })

    And('the section "marp" is included', () => {
      expect(validatedResult).toHaveProperty('marp')
    })

    And('exactly 1 warning is logged', () => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(1)
    })
  })
})

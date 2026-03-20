/**
 * Acceptance Tests for US-CFG-025: Filter Unknown Sections
 *
 * Validates that the SchemaValidator filters out config sections that do not
 * correspond to any discovered plugin, logs warnings for removed sections,
 * and correctly handles hyphen-to-underscore key mapping.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-025-filter-unknown-sections.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'
import type { ValidatedConfig } from '../../../../src/types/ValidatedConfig.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-025-filter-unknown-sections.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let plugins: PluginDescriptor[]
  let config: Record<string, unknown>
  let filteredConfig: Record<string, unknown>

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
      config = {}
      filteredConfig = {}
    })

    And('the following plugins are discovered:', (_ctx, table: Array<Record<string, string>>) => {
      plugins = table.map((row) => ({
        name: row.pluginName,
        version: '1.0.0',
        configSchema: null,
        path: `/plugins/${row.pluginName}`,
      }))
    })
  })

  Scenario('Known section is kept', ({ Given, When, Then }) => {
    Given('the response contains section "time_tracking"', () => {
      config = { time_tracking: { csv_file: 'tt.csv' } }
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the section "time_tracking" is kept', () => {
      expect(filteredConfig).toHaveProperty('time_tracking')
      expect(filteredConfig.time_tracking).toEqual({ csv_file: 'tt.csv' })
    })
  })

  Scenario('Unknown section is removed', ({ Given, When, Then, And }) => {
    Given('the response contains section "unknown_plugin"', () => {
      config = { unknown_plugin: { key: 'value' } }
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the section "unknown_plugin" is removed', () => {
      expect(filteredConfig).not.toHaveProperty('unknown_plugin')
    })

    And('a warning is logged containing "unknown_plugin" and "not recognized"', () => {
      const warnCalls = vi.mocked(mockLogger.warn).mock.calls
      const allWarnings = warnCalls.map((call) => String(call[0])).join(' ')
      expect(allWarnings).toContain('unknown_plugin')
      expect(allWarnings).toContain('not recognized')
    })
  })

  Scenario('Mix of known and unknown sections', ({ Given, When, Then, And }) => {
    Given('the response contains sections:', (_ctx, table: Array<Record<string, string>>) => {
      config = {}
      for (const row of table) {
        config[row.section] = { data: true }
      }
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the following sections are kept:', (_ctx, table: Array<Record<string, string>>) => {
      for (const row of table) {
        expect(filteredConfig).toHaveProperty(row.section)
      }
    })

    And('the following sections are removed:', (_ctx, table: Array<Record<string, string>>) => {
      for (const row of table) {
        expect(filteredConfig).not.toHaveProperty(row.section)
      }
    })
  })

  Scenario('Section key mapping uses hyphen-to-underscore conversion', ({ Given, And, When, Then }) => {
    Given('the plugin "time-tracking" is discovered', () => {
      // Already in plugins from Background
    })

    And('the response contains section "time_tracking"', () => {
      config = { time_tracking: { csv_file: 'tt.csv' } }
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the section "time_tracking" is recognized as belonging to plugin "time-tracking"', () => {
      expect(filteredConfig).toHaveProperty('time_tracking')
    })

    And('the section is kept', () => {
      expect(filteredConfig.time_tracking).toEqual({ csv_file: 'tt.csv' })
    })
  })

  Scenario('All sections are unknown', ({ Given, When, Then, And }) => {
    Given('the response contains only sections not matching any discovered plugin:', (_ctx, table: Array<Record<string, string>>) => {
      config = {}
      for (const row of table) {
        config[row.section] = { data: true }
      }
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the validated config contains no sections', () => {
      expect(Object.keys(filteredConfig)).toHaveLength(0)
    })

    And('warnings are logged for each unknown section', () => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(2)
    })
  })

  Scenario('Empty response config', ({ Given, When, Then, And }) => {
    Given('the response config object is empty', () => {
      config = {}
    })

    When('unknown sections are filtered', () => {
      filteredConfig = validator.filterUnknownSections(config, plugins)
    })

    Then('the validated config contains no sections', () => {
      expect(Object.keys(filteredConfig)).toHaveLength(0)
    })

    And('no warnings are logged', () => {
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })
})

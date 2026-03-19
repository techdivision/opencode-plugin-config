/**
 * Acceptance Tests for US-CFG-005: Protected Fields ($schema, version)
 *
 * Tests that $schema and version fields are preserved during merge.
 * Verifies PROTECTED_FIELDS constant and merge cascade behavior.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'
import { PROTECTED_FIELDS } from '../../../../src/types/PluginConfig.js'

function getNestedField(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-005-protected-fields.feature',
)

describeFeature(feature, ({ Scenario }) => {
  let merger: ConfigMerger
  let globalConfig: Record<string, unknown>
  let projectConfig: Record<string, unknown>
  let mergedConfig: Record<string, unknown>

  Scenario(
    '$schema field from project config is preserved during merge',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        merger = new ConfigMerger()
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config "$schema" equals "./schemas/opencode-project.schema.json"',
        () => {
          expect(mergedConfig.$schema).toBe(
            './schemas/opencode-project.schema.json',
          )
        },
      )
    },
  )

  Scenario(
    'version field from project config is preserved during merge',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        merger = new ConfigMerger()
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then('the merged config "version" equals "2.0.0"', () => {
        expect(mergedConfig.version).toBe('2.0.0')
      })

      And('the project version takes precedence', () => {
        expect(mergedConfig.version).not.toBe('1.0.0')
      })
    },
  )

  Scenario(
    'Protected fields are defined as immutable in TypeScript types',
    ({ Given, When, Then, And }) => {
      Given('the PluginConfig TypeScript types are defined', () => {
        // PROTECTED_FIELDS is imported from PluginConfig
      })

      When('I inspect the protected fields constant', () => {
        // PROTECTED_FIELDS is already available
      })

      Then('it contains "$schema"', () => {
        expect(PROTECTED_FIELDS).toContain('$schema')
      })

      And('it contains "version"', () => {
        expect(PROTECTED_FIELDS).toContain('version')
      })

      And(
        'these fields are documented as never overwritten by remote config',
        () => {
          expect(PROTECTED_FIELDS).toHaveLength(2)
          expect(PROTECTED_FIELDS).toEqual(['$schema', 'version'])
        },
      )
    },
  )

  Scenario(
    'Protected fields survive the full merge cascade',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        merger = new ConfigMerger()
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config "$schema" equals "./schemas/opencode-project.schema.json"',
        () => {
          expect(mergedConfig.$schema).toBe(
            './schemas/opencode-project.schema.json',
          )
        },
      )

      And('the merged config "version" equals "1.0.0"', () => {
        expect(mergedConfig.version).toBe('1.0.0')
      })

      And(
        'the merged config "time_tracking.csv_file" equals "project.csv"',
        () => {
          expect(
            getNestedField(mergedConfig, 'time_tracking.csv_file'),
          ).toBe('project.csv')
        },
      )
    },
  )
})

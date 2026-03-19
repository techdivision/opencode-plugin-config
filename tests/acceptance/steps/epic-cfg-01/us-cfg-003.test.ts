/**
 * Acceptance Tests for US-CFG-003: Deep-Merge Global and Project Configuration
 *
 * Tests ConfigLoader merge behavior using real ConfigMerger (acceptance test).
 * Verifies deep-merge semantics: project overrides global, arrays replace, etc.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'

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
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-003-deep-merge-configs.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let merger: ConfigMerger
  let globalConfig: Record<string, unknown>
  let projectConfig: Record<string, unknown>
  let mergedConfig: Record<string, unknown>

  Background(({ Given }) => {
    Given(
      'the deepmerge library is configured with custom array-merge strategy',
      () => {
        merger = new ConfigMerger()
        globalConfig = {}
        projectConfig = {}
        mergedConfig = {}
      },
    )
  })

  Scenario(
    'Project scalar value overrides global scalar value',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config "time_tracking.csv_file" equals ".opencode/time_tracking/time-tracking.csv"',
        () => {
          expect(getNestedField(mergedConfig, 'time_tracking.csv_file')).toBe(
            '.opencode/time_tracking/time-tracking.csv',
          )
        },
      )
    },
  )

  Scenario(
    'Deep nested objects are recursively merged',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config contains "time_tracking.pricing.ratio.input" with value 0.8',
        () => {
          expect(
            getNestedField(mergedConfig, 'time_tracking.pricing.ratio.input'),
          ).toBe(0.8)
        },
      )

      And(
        'the merged config contains "time_tracking.csv_file" with value ".opencode/time_tracking/time-tracking.csv"',
        () => {
          expect(getNestedField(mergedConfig, 'time_tracking.csv_file')).toBe(
            '.opencode/time_tracking/time-tracking.csv',
          )
        },
      )

      And(
        'the merged config contains "time_tracking.valid_projects" with value ["COPSPA"]',
        () => {
          expect(
            getNestedField(mergedConfig, 'time_tracking.valid_projects'),
          ).toEqual(['COPSPA'])
        },
      )
    },
  )

  Scenario(
    'Project array replaces global array completely (no concatenation)',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config "time_tracking.valid_projects" equals ["COPSPA"]',
        () => {
          expect(
            getNestedField(mergedConfig, 'time_tracking.valid_projects'),
          ).toEqual(['COPSPA'])
        },
      )

      And(
        'the merged config "time_tracking.valid_projects" does NOT contain "GLOBAL-A"',
        () => {
          const arr = getNestedField(
            mergedConfig,
            'time_tracking.valid_projects',
          ) as unknown[]
          expect(arr).not.toContain('GLOBAL-A')
        },
      )

      And(
        'the merged config "time_tracking.valid_projects" does NOT contain "GLOBAL-B"',
        () => {
          const arr = getNestedField(
            mergedConfig,
            'time_tracking.valid_projects',
          ) as unknown[]
          expect(arr).not.toContain('GLOBAL-B')
        },
      )
    },
  )

  Scenario(
    'Global-only values are preserved when project has no override',
    ({ Given, When, Then, And }) => {
      Given('the global config contains:', (ctx, docString: string) => {
        globalConfig = JSON.parse(docString)
      })

      And('the project config contains:', (ctx, docString: string) => {
        projectConfig = JSON.parse(docString)
      })

      When('the ConfigLoader merges global and project config', () => {
        mergedConfig = merger.merge(globalConfig, projectConfig)
      })

      Then(
        'the merged config contains "time_tracking.pricing.ratio.input" with value 0.8',
        () => {
          expect(
            getNestedField(mergedConfig, 'time_tracking.pricing.ratio.input'),
          ).toBe(0.8)
        },
      )

      And(
        'the merged config contains "jira.project" with value "COPSPA"',
        () => {
          expect(getNestedField(mergedConfig, 'jira.project')).toBe('COPSPA')
        },
      )
    },
  )

  Scenario('Both configs are empty', ({ Given, When, Then, And }) => {
    Given('the global config is an empty object {}', () => {
      globalConfig = {}
    })

    And('the project config is an empty object {}', () => {
      projectConfig = {}
    })

    When('the ConfigLoader merges global and project config', () => {
      mergedConfig = merger.merge(globalConfig, projectConfig)
    })

    Then('the merged config is an empty object {}', () => {
      expect(mergedConfig).toEqual({})
    })
  })

  Scenario('Only global config exists', ({ Given, When, Then, And }) => {
    Given('the global config contains:', (ctx, docString: string) => {
      globalConfig = JSON.parse(docString)
    })

    And('no project config exists', () => {
      projectConfig = {}
    })

    When('the ConfigLoader merges global and project config', () => {
      mergedConfig = merger.merge(globalConfig, projectConfig)
    })

    Then(
      'the merged config "config.sync_url" equals "https://n8n.example.com/webhook/oc-config-sync"',
      () => {
        expect(getNestedField(mergedConfig, 'config.sync_url')).toBe(
          'https://n8n.example.com/webhook/oc-config-sync',
        )
      },
    )
  })

  Scenario('Only project config exists', ({ Given, When, Then, And }) => {
    Given('no global config exists', () => {
      globalConfig = {}
    })

    And('the project config contains:', (ctx, docString: string) => {
      projectConfig = JSON.parse(docString)
    })

    When('the ConfigLoader merges global and project config', () => {
      mergedConfig = merger.merge(globalConfig, projectConfig)
    })

    Then('the merged config "jira.project" equals "COPSPA"', () => {
      expect(getNestedField(mergedConfig, 'jira.project')).toBe('COPSPA')
    })
  })
})

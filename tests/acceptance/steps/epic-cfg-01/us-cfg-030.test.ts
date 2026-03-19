/**
 * Acceptance Tests for US-CFG-030: ConfigMerger Deep-Merge
 *
 * Tests the central deep-merge service with local-precedence semantics.
 * Uses vitest-cucumber with loadFeature/describeFeature format.
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
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-030-config-merger-deep-merge.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let merger: ConfigMerger
  let remoteConfig: Record<string, unknown>
  let localConfig: Record<string, unknown>
  let result: Record<string, unknown>

  Background(({ Given }) => {
    Given('the ConfigMerger service is initialized', () => {
      merger = new ConfigMerger()
      remoteConfig = {}
      localConfig = {}
      result = {}
    })
  })

  Scenario(
    'Local scalar values override remote scalar values',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.merge(remoteConfig, localConfig)
      })

      Then('the result field "jira.project" is "LOCAL-PROJ"', () => {
        expect(getNestedField(result, 'jira.project')).toBe('LOCAL-PROJ')
      })

      And(
        'the result field "jira.base_url" is "https://local.atlassian.net"',
        () => {
          expect(getNestedField(result, 'jira.base_url')).toBe(
            'https://local.atlassian.net',
          )
        },
      )

      And(
        'the result field "jira.workflow.status.open.name" is "Open"',
        () => {
          expect(
            getNestedField(result, 'jira.workflow.status.open.name'),
          ).toBe('Open')
        },
      )
    },
  )

  Scenario(
    'Remote-only values are adopted as new defaults',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.merge(remoteConfig, localConfig)
      })

      Then('the result field "jira.project" is "COPSPA"', () => {
        expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
      })

      And(
        'the result field "jira.workflow.status.open.id" is "1"',
        () => {
          expect(
            getNestedField(result, 'jira.workflow.status.open.id'),
          ).toBe('1')
        },
      )

      And(
        'the result field "jira.tempo.account_field_id" is "customfield_10039"',
        () => {
          expect(
            getNestedField(result, 'jira.tempo.account_field_id'),
          ).toBe('customfield_10039')
        },
      )
    },
  )

  Scenario(
    'Local arrays replace remote arrays completely',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.merge(remoteConfig, localConfig)
      })

      Then(
        'the result field "time_tracking.valid_projects" is an array with 1 element',
        () => {
          const arr = getNestedField(
            result,
            'time_tracking.valid_projects',
          ) as unknown[]
          expect(arr).toHaveLength(1)
        },
      )

      And('the array contains "COPSPA"', () => {
        const arr = getNestedField(
          result,
          'time_tracking.valid_projects',
        ) as unknown[]
        expect(arr).toContain('COPSPA')
      })

      And('the array does not contain "PROJ-A"', () => {
        const arr = getNestedField(
          result,
          'time_tracking.valid_projects',
        ) as unknown[]
        expect(arr).not.toContain('PROJ-A')
      })
    },
  )

  Scenario(
    'Protected fields are removed from remote config before merge',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.mergeWithProtectedFields(
          remoteConfig,
          localConfig,
          PROTECTED_FIELDS,
        )
      })

      Then(
        'the result field "$schema" is "https://local-schema-url"',
        () => {
          expect(result.$schema).toBe('https://local-schema-url')
        },
      )

      And('the result field "version" is "1.0.0"', () => {
        expect(result.version).toBe('1.0.0')
      })

      And('the result field "jira.project" is "COPSPA"', () => {
        expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
      })

      And(
        'the result field "jira.base_url" is "https://local.atlassian.net"',
        () => {
          expect(getNestedField(result, 'jira.base_url')).toBe(
            'https://local.atlassian.net',
          )
        },
      )
    },
  )

  Scenario(
    'Deep nested objects are merged recursively',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.merge(remoteConfig, localConfig)
      })

      Then(
        'the result field "time_tracking.pricing.ratio.input" is 0.9',
        () => {
          expect(
            getNestedField(result, 'time_tracking.pricing.ratio.input'),
          ).toBe(0.9)
        },
      )

      And(
        'the result field "time_tracking.pricing.ratio.output" is 0.1',
        () => {
          expect(
            getNestedField(result, 'time_tracking.pricing.ratio.output'),
          ).toBe(0.1)
        },
      )

      And(
        'the result field "time_tracking.pricing.default.input" is 3',
        () => {
          expect(
            getNestedField(result, 'time_tracking.pricing.default.input'),
          ).toBe(3)
        },
      )

      And(
        'the result field "time_tracking.pricing.periods" is an array with 1 element',
        () => {
          const periods = getNestedField(
            result,
            'time_tracking.pricing.periods',
          ) as unknown[]
          expect(periods).toHaveLength(1)
        },
      )
    },
  )

  Scenario(
    'Empty remote config results in local config unchanged',
    ({ Given, When, Then, And }) => {
      Given('a remote config:', (ctx, docString: string) => {
        remoteConfig = JSON.parse(docString)
      })

      And('a local config:', (ctx, docString: string) => {
        localConfig = JSON.parse(docString)
      })

      When('the ConfigMerger performs the deep-merge', () => {
        result = merger.merge(remoteConfig, localConfig)
      })

      Then('the result equals the local config', () => {
        expect(result).toEqual(localConfig)
      })
    },
  )
})

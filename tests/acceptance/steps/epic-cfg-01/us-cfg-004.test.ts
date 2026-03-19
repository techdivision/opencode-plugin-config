/**
 * Acceptance Tests for US-CFG-004: Environment Variable Placeholder Resolution
 *
 * Tests ConfigLoader.resolveEnvVars() with real environment variables.
 * Verifies {env:VAR} placeholder resolution, preservation, and non-recursion.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ConfigLoader } from '../../../../src/services/ConfigLoader.js'
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
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-004-env-var-resolution.feature',
)

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  let loader: ConfigLoader
  let config: Record<string, unknown>
  let resolved: Record<string, unknown>
  const envVarsToClean: string[] = []

  AfterEachScenario(() => {
    for (const varName of envVarsToClean) {
      delete process.env[varName]
    }
    envVarsToClean.length = 0
  })

  Scenario(
    'Resolve a single {env:VAR} placeholder',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      And(
        'the environment variable "OC_CONFIG_SYNC_TOKEN" is set to "my-secret-token"',
        () => {
          process.env.OC_CONFIG_SYNC_TOKEN = 'my-secret-token'
          envVarsToClean.push('OC_CONFIG_SYNC_TOKEN')
        },
      )

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then('the config "config.sync_token" equals "my-secret-token"', () => {
        expect(getNestedField(resolved, 'config.sync_token')).toBe(
          'my-secret-token',
        )
      })
    },
  )

  Scenario(
    'Resolve multiple {env:VAR} placeholders in different values',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      And(
        'the environment variable "OC_CONFIG_SYNC_URL" is set to "https://n8n.example.com/webhook/oc-config-sync"',
        () => {
          process.env.OC_CONFIG_SYNC_URL =
            'https://n8n.example.com/webhook/oc-config-sync'
          envVarsToClean.push('OC_CONFIG_SYNC_URL')
        },
      )

      And(
        'the environment variable "OC_CONFIG_SYNC_TOKEN" is set to "my-secret-token"',
        () => {
          process.env.OC_CONFIG_SYNC_TOKEN = 'my-secret-token'
          envVarsToClean.push('OC_CONFIG_SYNC_TOKEN')
        },
      )

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then(
        'the config "config.sync_url" equals "https://n8n.example.com/webhook/oc-config-sync"',
        () => {
          expect(getNestedField(resolved, 'config.sync_url')).toBe(
            'https://n8n.example.com/webhook/oc-config-sync',
          )
        },
      )

      And(
        'the config "config.sync_token" equals "my-secret-token"',
        () => {
          expect(getNestedField(resolved, 'config.sync_token')).toBe(
            'my-secret-token',
          )
        },
      )
    },
  )

  Scenario(
    'Resolve {env:VAR} in deeply nested config values',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      And(
        'the environment variable "TT_TEMPO_API_TOKEN" is set to "tempo-api-key-123"',
        () => {
          process.env.TT_TEMPO_API_TOKEN = 'tempo-api-key-123'
          envVarsToClean.push('TT_TEMPO_API_TOKEN')
        },
      )

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then(
        'the config "time_tracking.sync.tempo.api_token" equals "tempo-api-key-123"',
        () => {
          expect(
            getNestedField(resolved, 'time_tracking.sync.tempo.api_token'),
          ).toBe('tempo-api-key-123')
        },
      )
    },
  )

  Scenario(
    'Unresolvable {env:VAR} placeholder (variable not set)',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      And('the environment variable "NONEXISTENT_VAR" is NOT set', () => {
        delete process.env.NONEXISTENT_VAR
      })

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then(
        'the config "config.sync_token" equals "{env:NONEXISTENT_VAR}"',
        () => {
          expect(getNestedField(resolved, 'config.sync_token')).toBe(
            '{env:NONEXISTENT_VAR}',
          )
        },
      )

      And('the original placeholder is preserved unchanged', () => {
        expect(getNestedField(resolved, 'config.sync_token')).toBe(
          '{env:NONEXISTENT_VAR}',
        )
      })
    },
  )

  Scenario(
    'Non-string values are not affected by env resolution',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then(
        'the config "time_tracking.pricing.ratio.input" equals 0.8',
        () => {
          expect(
            getNestedField(resolved, 'time_tracking.pricing.ratio.input'),
          ).toBe(0.8)
        },
      )

      And(
        'the config "time_tracking.valid_projects" equals ["COPSPA"]',
        () => {
          expect(
            getNestedField(resolved, 'time_tracking.valid_projects'),
          ).toEqual(['COPSPA'])
        },
      )
    },
  )

  Scenario(
    'Only simple replacement, no recursive resolution',
    ({ Given, When, Then, And }) => {
      Given('the merged config contains:', (ctx, docString: string) => {
        loader = new ConfigLoader(new ConfigMerger())
        config = JSON.parse(docString)
      })

      And(
        'the environment variable "REDIRECT_VAR" is set to "{env:ANOTHER_VAR}"',
        () => {
          process.env.REDIRECT_VAR = '{env:ANOTHER_VAR}'
          envVarsToClean.push('REDIRECT_VAR')
        },
      )

      And(
        'the environment variable "ANOTHER_VAR" is set to "final-value"',
        () => {
          process.env.ANOTHER_VAR = 'final-value'
          envVarsToClean.push('ANOTHER_VAR')
        },
      )

      When('the ConfigLoader resolves environment variables', () => {
        resolved = loader.resolveEnvVars(config)
      })

      Then(
        'the config "config.sync_url" equals "{env:ANOTHER_VAR}"',
        () => {
          expect(getNestedField(resolved, 'config.sync_url')).toBe(
            '{env:ANOTHER_VAR}',
          )
        },
      )

      And('the resolution is NOT recursive', () => {
        expect(getNestedField(resolved, 'config.sync_url')).not.toBe(
          'final-value',
        )
      })
    },
  )
})

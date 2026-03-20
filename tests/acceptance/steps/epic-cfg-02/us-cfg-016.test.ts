/**
 * Acceptance tests for US-CFG-016: sync_url + sync_token resolution cascade.
 *
 * @remarks
 * Tests the Gherkin scenarios from us-cfg-016-sync-url-resolution.feature.
 * The ConfigSyncer reads sync_url/sync_token from the already env-resolved
 * local config, with fallback to process.env.
 *
 * Note: Environment variable cleanup is done at the start of each scenario
 * (not via afterEach) because vitest-cucumber runs afterEach after each STEP,
 * not after each scenario.
 *
 * Note: resolveSyncUrl() and resolveSyncToken() are private methods (internal
 * to syncConfig). Since syncConfig() is still a stub (US-CFG-014), we test
 * the private methods via type-casting as a temporary measure. Once syncConfig()
 * is implemented, these tests should be refactored to test through the public API.
 *
 * @see us-cfg-016-sync-url-resolution.feature
 * @see ConfigSyncer
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ConfigSyncer } from '../../../../src/services/ConfigSyncer.js'
import { ConfigLoader } from '../../../../src/services/ConfigLoader.js'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-02/us-cfg-016-sync-url-resolution.feature',
)

/**
 * Type alias for accessing private resolution methods during testing.
 *
 * @remarks
 * Temporary workaround until syncConfig() is fully implemented (US-CFG-014).
 */
type ConfigSyncerTestAccess = {
  resolveSyncUrl(localConfig: Record<string, unknown>): string | null
  resolveSyncToken(localConfig: Record<string, unknown>): string | null
}

/**
 * Clean up environment variables used in sync resolution tests.
 * Called at the start of each scenario to ensure a clean state.
 */
function cleanEnvVars(): void {
  delete process.env.OC_CONFIG_SYNC_URL
  delete process.env.OC_CONFIG_SYNC_TOKEN
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let syncer: ConfigSyncerTestAccess
  let localConfig: Record<string, unknown>
  let resolvedUrl: string | null
  let resolvedToken: string | null

  Scenario('Resolve sync_url directly from local config', ({ Given, When, Then }) => {
    Given('the local config contains:', (ctx, docString: string) => {
      cleanEnvVars()
      const rawConfig = JSON.parse(docString)
      const loader = new ConfigLoader(new ConfigMerger())
      localConfig = loader.resolveEnvVars(rawConfig)
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is "https://n8n.example.com/webhook/oc-config-sync"', () => {
      expect(resolvedUrl).toBe('https://n8n.example.com/webhook/oc-config-sync')
    })
  })

  Scenario('Resolve sync_url from {env:VAR} pattern in config', ({ Given, When, Then, And }) => {
    Given('the local config contains:', (ctx, docString: string) => {
      cleanEnvVars()
      localConfig = JSON.parse(docString)
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_URL is "https://resolved.example.com/webhook"', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://resolved.example.com/webhook'
      // Simulate ConfigLoader env resolution — placeholder gets resolved
      const loader = new ConfigLoader(new ConfigMerger())
      localConfig = loader.resolveEnvVars(localConfig)
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is "https://resolved.example.com/webhook"', () => {
      expect(resolvedUrl).toBe('https://resolved.example.com/webhook')
    })
  })

  Scenario('Resolve sync_url from {env:VAR} when env var is not set', ({ Given, When, Then, And }) => {
    Given('the local config contains:', (ctx, docString: string) => {
      cleanEnvVars()
      localConfig = JSON.parse(docString)
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_URL is not set', () => {
      delete process.env.OC_CONFIG_SYNC_URL
      // Simulate ConfigLoader env resolution — placeholder stays unresolved
      const loader = new ConfigLoader(new ConfigMerger())
      localConfig = loader.resolveEnvVars(localConfig)
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is null', () => {
      expect(resolvedUrl).toBeNull()
    })

    And('the webhook is skipped', () => {
      expect(resolvedUrl).toBeNull()
    })
  })

  Scenario('Fallback to process.env.OC_CONFIG_SYNC_URL when config has no sync_url', ({ Given, When, Then, And }) => {
    Given('the local config does not contain a "config.sync_url" field', () => {
      cleanEnvVars()
      localConfig = { jira: { project: 'COPSPA' } }
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_URL is "https://fallback.example.com/webhook"', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://fallback.example.com/webhook'
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is "https://fallback.example.com/webhook"', () => {
      expect(resolvedUrl).toBe('https://fallback.example.com/webhook')
    })
  })

  Scenario('Skip webhook when no sync_url is available from any source', ({ Given, When, Then, And }) => {
    Given('the local config does not contain a "config.sync_url" field', () => {
      cleanEnvVars()
      localConfig = {}
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_URL is not set', () => {
      delete process.env.OC_CONFIG_SYNC_URL
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is null', () => {
      expect(resolvedUrl).toBeNull()
    })

    And('the webhook is skipped', () => {
      expect(resolvedUrl).toBeNull()
    })

    And('the ConfigSyncer returns null', () => {
      expect(resolvedUrl).toBeNull()
    })
  })

  Scenario('Resolve sync_token via {env:VAR} pattern', ({ Given, When, Then, And }) => {
    Given('the local config contains:', (ctx, docString: string) => {
      cleanEnvVars()
      localConfig = JSON.parse(docString)
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_TOKEN is "my-secret-token"', () => {
      process.env.OC_CONFIG_SYNC_TOKEN = 'my-secret-token'
      // Simulate ConfigLoader env resolution
      const loader = new ConfigLoader(new ConfigMerger())
      localConfig = loader.resolveEnvVars(localConfig)
    })

    When('the ConfigSyncer resolves the sync_token', () => {
      resolvedToken = syncer.resolveSyncToken(localConfig)
    })

    Then('the resolved sync_token is "my-secret-token"', () => {
      expect(resolvedToken).toBe('my-secret-token')
    })
  })

  ScenarioOutline('sync_url resolution cascade priority', ({ Given, When, Then, And }, variables) => {
    Given('the local config sync_url is "<config_value>"', () => {
      cleanEnvVars()
      const configValue = variables['config_value'] as string
      if (configValue) {
        localConfig = { config: { sync_url: configValue } }
      } else {
        localConfig = {}
      }
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('process.env.OC_CONFIG_SYNC_URL is "<env_value>"', () => {
      const envValue = variables['env_value'] as string
      if (envValue) {
        process.env.OC_CONFIG_SYNC_URL = envValue
      } else {
        delete process.env.OC_CONFIG_SYNC_URL
      }
      // Simulate ConfigLoader env resolution on the config
      const loader = new ConfigLoader(new ConfigMerger())
      localConfig = loader.resolveEnvVars(localConfig)
    })

    When('the ConfigSyncer resolves the sync_url', () => {
      resolvedUrl = syncer.resolveSyncUrl(localConfig)
    })

    Then('the resolved sync_url is "<result>"', () => {
      const expectedResult = variables['result'] as string
      if (expectedResult === 'null') {
        expect(resolvedUrl).toBeNull()
      } else {
        expect(resolvedUrl).toBe(expectedResult)
      }
    })
  })
})

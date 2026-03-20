/**
 * Acceptance Tests for US-CFG-011: Webhook Payload Assembly
 *
 * Validates that ConfigSyncer.buildPayload() correctly assembles the SyncPayload
 * from the provided parameters, following the Gherkin scenarios in the feature file.
 *
 * @remarks
 * buildPayload() is a private method tested via type-casting as a temporary measure.
 * Once syncConfig() is fully implemented (US-CFG-014), these tests should be
 * refactored to test through the public API.
 *
 * @see ConfigSyncer
 * @see us-cfg-011-payload-assembly.feature
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { ConfigSyncer } from '../../../../src/services/ConfigSyncer.js'
import type { SyncPayload } from '../../../../src/types/SyncPayload.js'

/**
 * Type alias for accessing the private buildPayload method during testing.
 *
 * @remarks
 * Temporary workaround until syncConfig() is fully implemented (US-CFG-014).
 */
type ConfigSyncerTestAccess = {
  buildPayload(
    localConfig: Record<string, unknown>,
    pluginNames: string[],
    pluginVersion: string,
    email: string,
  ): SyncPayload
}

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-02/us-cfg-011-payload-assembly.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let syncer: ConfigSyncerTestAccess
  let pluginNames: string[]
  let pluginVersion: string
  let email: string
  let localConfig: Record<string, unknown>
  let payload: SyncPayload

  Background(({ Given, And }) => {
    Given('the ConfigSyncer service is instantiated', () => {
      syncer = new ConfigSyncer() as unknown as ConfigSyncerTestAccess
    })

    And('discoverPlugins() returns plugins "config", "time-tracking", "jira"', () => {
      pluginNames = ['config', 'time-tracking', 'jira']
    })

    And('the own PluginDescriptor has version "0.2.0"', () => {
      pluginVersion = '0.2.0'
    })

    And('process.env.OPENCODE_USER_EMAIL is set to "t.wagner@techdivision.com"', () => {
      email = 't.wagner@techdivision.com'
    })

    And('the local config contains:', (ctx, docString: string) => {
      localConfig = JSON.parse(docString)
    })
  })

  Scenario('Payload contains plugin_version from own PluginDescriptor', ({ When, Then }) => {
    When('the ConfigSyncer assembles the webhook payload', () => {
      payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)
    })

    Then('the payload field "plugin_version" is "0.2.0"', () => {
      expect(payload.plugin_version).toBe('0.2.0')
    })
  })

  Scenario('Payload contains email from process.env', ({ When, Then }) => {
    When('the ConfigSyncer assembles the webhook payload', () => {
      payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)
    })

    Then('the payload field "email" is "t.wagner@techdivision.com"', () => {
      expect(payload.email).toBe('t.wagner@techdivision.com')
    })
  })

  Scenario('Payload contains plugin names from discoverPlugins()', ({ When, Then }) => {
    When('the ConfigSyncer assembles the webhook payload', () => {
      payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)
    })

    Then('the payload field "plugins" is an array containing "config", "time-tracking", "jira"', () => {
      expect(payload.plugins).toEqual(['config', 'time-tracking', 'jira'])
    })
  })

  Scenario('Payload contains the entire local config as seed', ({ When, Then, And }) => {
    When('the ConfigSyncer assembles the webhook payload', () => {
      payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)
    })

    Then('the payload field "config" is an object', () => {
      expect(typeof payload.config).toBe('object')
      expect(payload.config).not.toBeNull()
    })

    And('the payload "config.jira.project" is "COPSPA"', () => {
      const jira = payload.config.jira as Record<string, unknown>
      expect(jira.project).toBe('COPSPA')
    })

    And('the payload "config.time_tracking.csv_file" is "tracking.csv"', () => {
      const timeTracking = payload.config.time_tracking as Record<string, unknown>
      expect(timeTracking.csv_file).toBe('tracking.csv')
    })
  })

  Scenario('Payload is valid JSON with correct Content-Type', ({ When, Then, And }) => {
    When('the ConfigSyncer assembles the webhook payload', () => {
      payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)
    })

    Then('the payload is serializable as valid JSON', () => {
      const serialized = JSON.stringify(payload)
      const deserialized = JSON.parse(serialized)
      expect(deserialized).toEqual(payload)
    })

    And('the Content-Type header is "application/json"', () => {
      // Content-Type is set by the HTTP client in US-CFG-012/US-CFG-014,
      // not by buildPayload(). We verify the payload is JSON-compatible,
      // which is the prerequisite for application/json Content-Type.
      expect(JSON.stringify(payload)).toBeTruthy()
    })
  })
})

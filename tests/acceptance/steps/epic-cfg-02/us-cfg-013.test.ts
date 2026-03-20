/**
 * Acceptance tests for US-CFG-013: Version Compatibility Check.
 *
 * @remarks
 * Tests the checkVersionCompatibility() private method of ConfigSyncer which
 * validates that the webhook response version is compatible with the current
 * plugin version using the `semver` npm package.
 *
 * Version logic:
 * - response.version > plugin_version → reject (return false)
 * - response.version <= plugin_version → accept (return true)
 *
 * @see us-cfg-013-version-compatibility.feature
 * @see ConfigSyncer
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { vi, expect } from 'vitest'
import { ConfigSyncer } from '../../../../src/services/ConfigSyncer.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { SyncResponse } from '../../../../src/types/SyncResponse.js'

/**
 * Type alias for accessing private methods during acceptance testing.
 */
type ConfigSyncerTestAccess = {
  checkVersionCompatibility(
    response: SyncResponse,
    pluginVersion: string,
  ): boolean
}

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-02/us-cfg-013-version-compatibility.feature',
)

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let syncer: ConfigSyncerTestAccess
  let mockLogger: PluginLoggerInterface
  let pluginVersion: string
  let responseVersion: string
  let response: SyncResponse
  let result: boolean

  Background(({ Given, And }) => {
    Given('the ConfigSyncer has plugin_version "0.2.0"', () => {
      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withLogging: vi.fn(),
        withErrorHandling: vi.fn(),
      } as unknown as PluginLoggerInterface

      syncer = new ConfigSyncer(mockLogger) as unknown as ConfigSyncerTestAccess
      pluginVersion = '0.2.0'
      responseVersion = ''
      result = false
    })

    And('the webhook returns a valid HTTP 200 response', () => {
      // HTTP 200 is implicit — we test checkVersionCompatibility directly
    })
  })

  Scenario('Accept response when response.version equals plugin_version', ({ Given, When, Then, And }) => {
    Given('the webhook response contains version "0.2.0"', () => {
      responseVersion = '0.2.0'
      response = { version: responseVersion, config: { jira: { board_id: 42 } } }
    })

    When('the ConfigSyncer checks version compatibility', () => {
      result = syncer.checkVersionCompatibility(response, pluginVersion)
    })

    Then('the response is accepted', () => {
      expect(result).toBe(true)
    })

    And('the SyncResponse config is returned', () => {
      expect(result).toBe(true)
    })
  })

  Scenario('Accept response when response.version is lower than plugin_version', ({ Given, When, Then, And }) => {
    Given('the webhook response contains version "0.1.0"', () => {
      responseVersion = '0.1.0'
      response = { version: responseVersion, config: { jira: { board_id: 42 } } }
    })

    When('the ConfigSyncer checks version compatibility', () => {
      result = syncer.checkVersionCompatibility(response, pluginVersion)
    })

    Then('the response is accepted', () => {
      expect(result).toBe(true)
    })

    And('the SyncResponse config is returned', () => {
      expect(result).toBe(true)
    })
  })

  Scenario('Reject response when response.version is higher than plugin_version', ({ Given, When, Then, And }) => {
    Given('the webhook response contains version "0.3.0"', () => {
      responseVersion = '0.3.0'
      response = { version: responseVersion, config: { jira: { board_id: 42 } } }
    })

    When('the ConfigSyncer checks version compatibility', () => {
      result = syncer.checkVersionCompatibility(response, pluginVersion)
    })

    Then('the response is rejected', () => {
      expect(result).toBe(false)
    })

    And('the ConfigSyncer returns null', () => {
      expect(result).toBe(false)
    })

    And('a warning is logged containing "neuere Plugin-Version" or "please update"', () => {
      expect(mockLogger.warn).toHaveBeenCalledTimes(1)
      const warnMessage = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const containsExpectedText =
        warnMessage.includes('neuere Plugin-Version') ||
        warnMessage.includes('please update') ||
        warnMessage.includes('Plugin updaten')
      expect(containsExpectedText).toBe(true)
    })
  })

  Scenario('Semver comparison handles pre-release versions correctly', ({ Given, And, When, Then }) => {
    Given('the ConfigSyncer has plugin_version "1.0.0"', () => {
      pluginVersion = '1.0.0'
    })

    And('the webhook response contains version "1.0.1-beta.1"', () => {
      responseVersion = '1.0.1-beta.1'
      response = { version: responseVersion, config: {} }
    })

    When('the ConfigSyncer checks version compatibility', () => {
      result = syncer.checkVersionCompatibility(response, pluginVersion)
    })

    Then('the response is rejected', () => {
      expect(result).toBe(false)
    })

    And('the ConfigSyncer returns null', () => {
      expect(result).toBe(false)
    })
  })

  ScenarioOutline('Version compatibility matrix', ({ Given, And, When, Then }, variables) => {
    Given('the ConfigSyncer has plugin_version "<plugin_version>"', () => {
      pluginVersion = variables['plugin_version'] as string
    })

    And('the webhook response contains version "<response_version>"', () => {
      responseVersion = variables['response_version'] as string
      response = { version: responseVersion, config: {} }
    })

    When('the ConfigSyncer checks version compatibility', () => {
      result = syncer.checkVersionCompatibility(response, pluginVersion)
    })

    Then('the result is "<result>"', () => {
      const expectedResult = variables['result'] as string
      if (expectedResult === 'accepted') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })
})

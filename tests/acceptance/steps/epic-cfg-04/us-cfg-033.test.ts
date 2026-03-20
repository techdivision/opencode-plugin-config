/**
 * Acceptance Tests for US-CFG-033: Consumer Helper Functions
 *
 * Tests that getProjectConfig() and getPluginConfig(name) helper functions
 * correctly implement the fallback chain and plugin section extraction.
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 *
 * Note: We use vi.spyOn for fs functions instead of vi.mock('node:fs')
 * because loadFeature needs real filesystem access to read the .feature file.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'

import { getProjectConfig } from '../../../../src/helpers/getProjectConfig.js'
import { getPluginConfig } from '../../../../src/helpers/getPluginConfig.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-033-consumer-helper-functions.feature',
)

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  let result: Record<string, unknown>
  let originalEnv: string | undefined
  let existsSyncSpy: ReturnType<typeof vi.spyOn>
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>

  BeforeEachScenario(() => {
    originalEnv = process.env.OPENCODE_PROJECT_CONFIG
    delete process.env.OPENCODE_PROJECT_CONFIG
    existsSyncSpy = vi.spyOn(fs, 'existsSync')
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync')
  })

  AfterEachScenario(() => {
    if (originalEnv !== undefined) {
      process.env.OPENCODE_PROJECT_CONFIG = originalEnv
    } else {
      delete process.env.OPENCODE_PROJECT_CONFIG
    }
    vi.restoreAllMocks()
  })

  // --- Scenario 1: getProjectConfig returns parsed config from process.env ---

  Scenario(
    'getProjectConfig returns parsed config from process.env',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is set to:', (_ctx, docString: string) => {
        process.env.OPENCODE_PROJECT_CONFIG = docString
      })

      When('I call getProjectConfig()', () => {
        result = getProjectConfig()
      })

      Then('I receive an object with keys "jira" and "time_tracking"', () => {
        expect(result).toHaveProperty('jira')
        expect(result).toHaveProperty('time_tracking')
      })

      And('the "jira.project" value is "COPSPA"', () => {
        const jira = result.jira as Record<string, unknown>
        expect(jira.project).toBe('COPSPA')
      })
    },
  )

  // --- Scenario 2: getProjectConfig falls back to local file ---

  Scenario(
    'getProjectConfig falls back to local file when process.env is not set',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is not set', () => {
        delete process.env.OPENCODE_PROJECT_CONFIG
      })

      And('a local file ".opencode/opencode-project.json" exists with:', (_ctx, docString: string) => {
        existsSyncSpy.mockReturnValue(true)
        readFileSyncSpy.mockReturnValue(docString)
      })

      When('I call getProjectConfig()', () => {
        result = getProjectConfig()
      })

      Then('I receive an object with key "jira"', () => {
        expect(result).toHaveProperty('jira')
      })

      And('the "jira.project" value is "LOCAL-PROJ"', () => {
        const jira = result.jira as Record<string, unknown>
        expect(jira.project).toBe('LOCAL-PROJ')
      })
    },
  )

  // --- Scenario 3: getProjectConfig returns empty object ---

  Scenario(
    'getProjectConfig returns empty object when no config available',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is not set', () => {
        delete process.env.OPENCODE_PROJECT_CONFIG
      })

      And('no local file ".opencode/opencode-project.json" exists', () => {
        existsSyncSpy.mockReturnValue(false)
      })

      When('I call getProjectConfig()', () => {
        result = getProjectConfig()
      })

      Then('I receive an empty object {}', () => {
        expect(result).toEqual({})
      })
    },
  )

  // --- Scenario 4: getProjectConfig handles invalid JSON gracefully ---

  Scenario(
    'getProjectConfig handles invalid JSON in process.env gracefully',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is set to "not-valid-json{{"', () => {
        process.env.OPENCODE_PROJECT_CONFIG = 'not-valid-json{{'
      })

      And('a local file ".opencode/opencode-project.json" exists with:', (_ctx, docString: string) => {
        existsSyncSpy.mockReturnValue(true)
        readFileSyncSpy.mockReturnValue(docString)
      })

      When('I call getProjectConfig()', () => {
        result = getProjectConfig()
      })

      Then('I receive the local file content as fallback', () => {
        expect(result).toHaveProperty('jira')
      })

      And('the "jira.project" value is "FALLBACK"', () => {
        const jira = result.jira as Record<string, unknown>
        expect(jira.project).toBe('FALLBACK')
      })
    },
  )

  // --- Scenario 5: getPluginConfig returns a specific plugin section ---

  Scenario(
    'getPluginConfig returns a specific plugin section',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is set to:', (_ctx, docString: string) => {
        process.env.OPENCODE_PROJECT_CONFIG = docString
      })

      When('I call getPluginConfig("time-tracking")', () => {
        result = getPluginConfig('time-tracking')
      })

      Then('I receive the "time_tracking" section', () => {
        expect(result).toBeDefined()
        expect(Object.keys(result).length).toBeGreaterThan(0)
      })

      And('the "csv_file" value is ".opencode/tt.csv"', () => {
        expect(result.csv_file).toBe('.opencode/tt.csv')
      })
    },
  )

  // --- Scenario 6: getPluginConfig converts plugin name to section key ---

  Scenario(
    'getPluginConfig converts plugin name to section key',
    ({ Given, When, Then, And }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is set to:', (_ctx, docString: string) => {
        process.env.OPENCODE_PROJECT_CONFIG = docString
      })

      When('I call getPluginConfig("time-tracking")', () => {
        result = getPluginConfig('time-tracking')
      })

      Then('the plugin name "time-tracking" is converted to section key "time_tracking"', () => {
        // The conversion is verified by the fact that we get the section
        expect(result).toBeDefined()
        expect(Object.keys(result).length).toBeGreaterThan(0)
      })

      And('the returned section contains "csv_file"', () => {
        expect(result).toHaveProperty('csv_file')
      })
    },
  )

  // --- Scenario 7: getPluginConfig returns empty object for unknown plugin ---

  Scenario(
    'getPluginConfig returns empty object for unknown plugin',
    ({ Given, When, Then }) => {
      Given('process.env.OPENCODE_PROJECT_CONFIG is set to:', (_ctx, docString: string) => {
        process.env.OPENCODE_PROJECT_CONFIG = docString
      })

      When('I call getPluginConfig("unknown-plugin")', () => {
        result = getPluginConfig('unknown-plugin')
      })

      Then('I receive an empty object {}', () => {
        expect(result).toEqual({})
      })
    },
  )
})

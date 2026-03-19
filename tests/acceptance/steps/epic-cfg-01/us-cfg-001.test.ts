/**
 * Acceptance Tests for US-CFG-001: Read Global Configuration
 *
 * Tests ConfigLoader.readGlobalConfig() with spied filesystem.
 * Verifies graceful degradation when file or directory is missing.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'
import { ConfigLoader } from '../../../../src/services/ConfigLoader.js'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-001-read-global-config.feature',
)

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  let loader: ConfigLoader
  let result: Record<string, unknown>
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>

  BeforeEachScenario(() => {
    loader = new ConfigLoader(new ConfigMerger())
    result = {}
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync')
  })

  AfterEachScenario(() => {
    readFileSyncSpy.mockRestore()
  })

  Scenario('Read existing global config file', ({ Given, When, Then, And }) => {
    Given(
      'a global config file exists at "~/.config/opencode/opencode-project.json"',
      () => {
        // File existence is set up via the mock in the And step
      },
    )

    And('it contains valid JSON:', (ctx, docString: string) => {
      readFileSyncSpy.mockReturnValue(docString)
    })

    When('the ConfigLoader reads the global config', () => {
      result = loader.readGlobalConfig()
    })

    Then(
      'the result contains the key "config" with a "sync_url" value',
      () => {
        expect(result).toHaveProperty('config')
        const config = result.config as Record<string, unknown>
        expect(config).toHaveProperty('sync_url')
      },
    )

    And(
      'the result contains the key "time_tracking" with nested "pricing" values',
      () => {
        expect(result).toHaveProperty('time_tracking')
        const timeTracking = result.time_tracking as Record<string, unknown>
        expect(timeTracking).toHaveProperty('pricing')
      },
    )
  })

  Scenario('Global config file does not exist', ({ Given, When, Then, And }) => {
    Given(
      'no global config file exists at "~/.config/opencode/opencode-project.json"',
      () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        readFileSyncSpy.mockImplementation(() => {
          throw error
        })
      },
    )

    When('the ConfigLoader reads the global config', () => {
      result = loader.readGlobalConfig()
    })

    Then('the result is an empty object {}', () => {
      expect(result).toEqual({})
    })

    And('no error is thrown', () => {
      expect(() => loader.readGlobalConfig()).not.toThrow()
    })
  })

  Scenario(
    'Global config directory does not exist',
    ({ Given, When, Then, And }) => {
      Given('the directory "~/.config/opencode/" does not exist', () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        readFileSyncSpy.mockImplementation(() => {
          throw error
        })
      })

      When('the ConfigLoader reads the global config', () => {
        result = loader.readGlobalConfig()
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And('no error is thrown', () => {
        expect(() => loader.readGlobalConfig()).not.toThrow()
      })
    },
  )
})

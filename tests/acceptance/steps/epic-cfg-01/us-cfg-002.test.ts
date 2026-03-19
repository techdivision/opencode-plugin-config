/**
 * Acceptance Tests for US-CFG-002: Read Project Configuration
 *
 * Tests ConfigLoader.readProjectConfig() with spied filesystem.
 * Verifies graceful degradation when file or directory is missing.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'
import { ConfigLoader } from '../../../../src/services/ConfigLoader.js'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-002-read-project-config.feature',
)

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  let loader: ConfigLoader
  let result: Record<string, unknown>
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>
  const projectDir = '/my/project'

  BeforeEachScenario(() => {
    loader = new ConfigLoader(new ConfigMerger())
    result = {}
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync')
  })

  AfterEachScenario(() => {
    readFileSyncSpy.mockRestore()
  })

  Scenario('Read existing project config file', ({ Given, When, Then, And }) => {
    Given(
      'a project config file exists at "<project>/.opencode/opencode-project.json"',
      () => {
        // File existence is set up via the mock in the And step
      },
    )

    And('it contains valid JSON:', (ctx, docString: string) => {
      readFileSyncSpy.mockReturnValue(docString)
    })

    When('the ConfigLoader reads the project config', () => {
      result = loader.readProjectConfig(projectDir)
    })

    Then(
      'the result contains the key "jira" with "project" value "COPSPA"',
      () => {
        expect(result).toHaveProperty('jira')
        const jira = result.jira as Record<string, unknown>
        expect(jira.project).toBe('COPSPA')
      },
    )

    And(
      'the result contains the key "time_tracking" with nested values',
      () => {
        expect(result).toHaveProperty('time_tracking')
      },
    )
  })

  Scenario(
    'Project config file does not exist',
    ({ Given, When, Then, And }) => {
      Given(
        'no project config file exists at "<project>/.opencode/opencode-project.json"',
        () => {
          const error = new Error('ENOENT') as NodeJS.ErrnoException
          error.code = 'ENOENT'
          readFileSyncSpy.mockImplementation(() => {
            throw error
          })
        },
      )

      When('the ConfigLoader reads the project config', () => {
        result = loader.readProjectConfig(projectDir)
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And('no error is thrown', () => {
        expect(() => loader.readProjectConfig(projectDir)).not.toThrow()
      })
    },
  )

  Scenario(
    'Project .opencode directory does not exist',
    ({ Given, When, Then, And }) => {
      Given('the directory "<project>/.opencode/" does not exist', () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        readFileSyncSpy.mockImplementation(() => {
          throw error
        })
      })

      When('the ConfigLoader reads the project config', () => {
        result = loader.readProjectConfig(projectDir)
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And('no error is thrown', () => {
        expect(() => loader.readProjectConfig(projectDir)).not.toThrow()
      })
    },
  )
})

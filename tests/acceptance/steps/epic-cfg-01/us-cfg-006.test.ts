/**
 * Acceptance Tests for US-CFG-006: Error Handling for Config Files
 *
 * Tests graceful error handling with spied filesystem.
 * Verifies that the plugin never crashes and always provides a usable config.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'
import { ConfigLoader } from '../../../../src/services/ConfigLoader.js'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'
import type { PluginLogger } from '../../../../src/utils/PluginLogger.js'

function createMockLogger(): PluginLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withLogging: vi.fn((fn) => fn),
    withErrorHandling: vi.fn((fn) => fn),
  }
}

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
  'tests/acceptance/gherkin/epic-cfg-01/us-cfg-006-error-handling.feature',
)

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  let loader: ConfigLoader
  let mockLogger: PluginLogger
  let result: Record<string, unknown>
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>

  BeforeEachScenario(() => {
    mockLogger = createMockLogger()
    loader = new ConfigLoader(new ConfigMerger(), mockLogger)
    result = {}
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync')
  })

  AfterEachScenario(() => {
    readFileSyncSpy.mockRestore()
  })

  Scenario(
    'Config file contains invalid JSON',
    ({ Given, When, Then, And }) => {
      Given('a config file exists with content:', (ctx, docString: string) => {
        readFileSyncSpy.mockReturnValue(docString)
      })

      When('the ConfigLoader reads this config file', () => {
        result = loader.readGlobalConfig()
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And(
        'a warning is logged with message containing "invalid JSON"',
        () => {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('invalid JSON'),
            expect.any(Object),
          )
        },
      )

      And('no error is thrown', () => {
        expect(() => loader.readGlobalConfig()).not.toThrow()
      })
    },
  )

  Scenario(
    'Config file is completely empty',
    ({ Given, When, Then, And }) => {
      Given('a config file exists with empty content ""', () => {
        readFileSyncSpy.mockReturnValue('')
      })

      When('the ConfigLoader reads this config file', () => {
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

  Scenario(
    'Config file contains valid JSON but is not an object',
    ({ Given, When, Then, And }) => {
      Given('a config file exists with content:', (ctx, docString: string) => {
        readFileSyncSpy.mockReturnValue(docString)
      })

      When('the ConfigLoader reads this config file', () => {
        result = loader.readGlobalConfig()
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And(
        'a warning is logged with message containing "not a JSON object"',
        () => {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('not a JSON object'),
            expect.any(Object),
          )
        },
      )
    },
  )

  Scenario(
    'Config file has no read permissions',
    ({ Given, When, Then, And }) => {
      Given('a config file exists but has no read permissions', () => {
        const error = new Error('EACCES') as NodeJS.ErrnoException
        error.code = 'EACCES'
        readFileSyncSpy.mockImplementation(() => {
          throw error
        })
      })

      When('the ConfigLoader reads this config file', () => {
        result = loader.readGlobalConfig()
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And(
        'a warning is logged with message containing "permission" or "access"',
        () => {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('permission'),
            expect.any(Object),
          )
        },
      )

      And('no error is thrown', () => {
        expect(() => loader.readGlobalConfig()).not.toThrow()
      })
    },
  )

  Scenario(
    'Both config files are missing - empty fallback',
    ({ Given, When, Then, And }) => {
      Given('no global config file exists', () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        readFileSyncSpy.mockImplementation(() => {
          throw error
        })
      })

      And('no project config file exists', () => {
        // Already handled by the mock above (all readFileSync calls throw ENOENT)
      })

      When('the ConfigLoader loads the local config cascade', () => {
        result = loader.loadLocalConfig('/my/project')
      })

      Then('the result is an empty object {}', () => {
        expect(result).toEqual({})
      })

      And('no error is thrown', () => {
        expect(() => loader.loadLocalConfig('/my/project')).not.toThrow()
      })

      And('the plugin continues without interruption', () => {
        // If we reach this point, the plugin did not crash
        expect(result).toBeDefined()
      })
    },
  )

  Scenario(
    'Global config invalid, project config valid',
    ({ Given, When, Then, And }) => {
      Given('the global config file contains invalid JSON', () => {
        // Will be set up with mock sequence below
      })

      And(
        'the project config file contains valid JSON:',
        (ctx, docString: string) => {
          readFileSyncSpy
            .mockReturnValueOnce('{ invalid json')
            .mockReturnValueOnce(docString)
        },
      )

      When('the ConfigLoader loads the local config cascade', () => {
        result = loader.loadLocalConfig('/my/project')
      })

      Then(
        'the merged config contains "jira.project" with value "COPSPA"',
        () => {
          expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
        },
      )

      And('a warning is logged for the global config file', () => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('invalid JSON'),
          expect.any(Object),
        )
      })

      And('the project config is used as the sole source', () => {
        expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
      })
    },
  )

  Scenario(
    'Global config valid, project config invalid',
    ({ Given, When, Then, And }) => {
      Given(
        'the global config file contains valid JSON:',
        (ctx, docString: string) => {
          readFileSyncSpy
            .mockReturnValueOnce(docString)
            .mockReturnValueOnce('{ invalid json')
        },
      )

      And('the project config file contains invalid JSON', () => {
        // Already set up in the mock sequence above
      })

      When('the ConfigLoader loads the local config cascade', () => {
        result = loader.loadLocalConfig('/my/project')
      })

      Then(
        'the merged config contains "time_tracking.pricing.default.input" with value 3',
        () => {
          expect(
            getNestedField(result, 'time_tracking.pricing.default.input'),
          ).toBe(3)
        },
      )

      And('a warning is logged for the project config file', () => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('invalid JSON'),
          expect.any(Object),
        )
      })

      And('the global config is used as the sole source', () => {
        expect(
          getNestedField(result, 'time_tracking.pricing.default.input'),
        ).toBe(3)
      })
    },
  )
})

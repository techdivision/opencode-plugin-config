/**
 * Acceptance Tests for US-CFG-020: Webhook Response Structure Validation
 *
 * Validates that the SchemaValidator correctly validates the structural
 * integrity of webhook responses before they enter the config merge pipeline.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-020-response-structure-validation.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { PluginDescriptor } from '../../../../src/types/PluginDescriptor.js'
import type { SyncResponse } from '../../../../src/types/SyncResponse.js'
import type { ValidatedConfig } from '../../../../src/types/ValidatedConfig.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-020-response-structure-validation.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let rawInput: unknown
  let result: ValidatedConfig
  let validationError: Error | null

  Background(({ Given }) => {
    Given('the SchemaValidator service is initialized', () => {
      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withLogging: vi.fn(),
        withErrorHandling: vi.fn(),
      }
      validator = new SchemaValidator(mockLogger)
      rawInput = null
      result = {}
      validationError = null
    })
  })

  Scenario('Valid response with version and config fields', ({ Given, When, Then, And }) => {
    let plugins: PluginDescriptor[]

    Given('a webhook response with the following JSON:', (_ctx, docString: string) => {
      rawInput = JSON.parse(docString)
      // Provide matching plugins so sections are not filtered by US-CFG-025
      const config = (rawInput as Record<string, unknown>).config as Record<string, unknown>
      plugins = Object.keys(config).map((key) => ({
        name: key.replace(/_/g, '-'),
        version: '1.0.0',
        configSchema: null,
        path: `/plugins/${key}`,
      }))
    })

    When('the response structure is validated', () => {
      try {
        result = validator.validateResponse(rawInput as SyncResponse, plugins)
        validationError = null
      } catch (error) {
        validationError = error as Error
      }
    })

    Then('the structure validation passes', () => {
      expect(validationError).toBeNull()
    })

    And('the config object is returned for section-level validation', () => {
      expect(result).toEqual({ time_tracking: { csv_file: 'tt.csv' } })
    })
  })

  Scenario('Response is not valid JSON', ({ Given, When, Then, And }) => {
    Given('a webhook response body that is not valid JSON:', (_ctx, docString: string) => {
      rawInput = docString
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "invalid JSON"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('invalid json')
    })

    And('the entire response is discarded', () => {
      expect(result).toEqual({})
    })
  })

  Scenario('Response is a JSON array instead of object', ({ Given, When, Then, And }) => {
    Given('a webhook response with the following JSON:', (_ctx, docString: string) => {
      rawInput = JSON.parse(docString)
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "must be a JSON object"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('must be a json object')
    })
  })

  Scenario('Response is missing the version field', ({ Given, When, Then, And }) => {
    Given('a webhook response with the following JSON:', (_ctx, docString: string) => {
      rawInput = JSON.parse(docString)
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "version"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('version')
    })
  })

  Scenario('Response is missing the config field', ({ Given, When, Then, And }) => {
    Given('a webhook response with the following JSON:', (_ctx, docString: string) => {
      rawInput = JSON.parse(docString)
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "config"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('config')
    })
  })

  Scenario('Config field is not an object', ({ Given, When, Then, And }) => {
    Given('a webhook response with the following JSON:', (_ctx, docString: string) => {
      rawInput = JSON.parse(docString)
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "config must be an object"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('config must be an object')
    })
  })

  Scenario('Response with null body', ({ Given, When, Then, And }) => {
    Given('a webhook response body that is null', () => {
      rawInput = null
    })

    When('the response structure is validated', () => {
      result = validator.validateResponse(rawInput as SyncResponse, [])
    })

    Then('the structure validation fails', () => {
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    And('an error is returned with message containing "invalid JSON"', () => {
      const warnCall = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(warnCall.toLowerCase()).toContain('invalid json')
    })
  })
})

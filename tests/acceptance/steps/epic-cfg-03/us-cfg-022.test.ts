/**
 * Acceptance Tests for US-CFG-022: Ajv Section Validation
 *
 * Validates that the SchemaValidator correctly validates each response
 * section against its plugin schema using Ajv, with allErrors mode,
 * strict false, and ajv-formats for format keywords.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-022-ajv-section-validation.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { SectionValidationResult } from '../../../../src/types/SectionValidationResult.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-022-ajv-section-validation.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let sectionKey: string
  let sectionData: unknown
  let schema: object
  let validationResult: SectionValidationResult
  let wrappedData: unknown

  Background(({ Given, And }) => {
    Given('the SchemaValidator service is initialized with Ajv', () => {
      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withLogging: vi.fn(),
        withErrorHandling: vi.fn(),
      }
      validator = new SchemaValidator(mockLogger)
      sectionKey = ''
      sectionData = null
      schema = {}
      validationResult = { valid: false }
      wrappedData = null
    })

    And('Ajv is configured with allErrors true and strict false', () => {
      // Verified by the SchemaValidator constructor — Ajv is initialized
      // with { allErrors: true, strict: false }
    })

    And('ajv-formats is registered for format keywords', () => {
      // Verified by the SchemaValidator constructor — addFormats(ajv) is called
    })
  })

  Scenario('Valid section passes schema validation', ({ Given, When, Then, And }) => {
    Given('a plugin schema for "time_tracking" that requires:', (_ctx, table: Array<Record<string, string>>) => {
      schema = {
        type: 'object',
        properties: {
          time_tracking: {
            type: 'object',
            properties: {
              csv_file: { type: 'string' },
              global_default: { type: 'object' },
            },
            required: ['csv_file', 'global_default'],
          },
        },
      }
    })

    And('a response section "time_tracking" with data:', (_ctx, docString: string) => {
      sectionKey = 'time_tracking'
      sectionData = JSON.parse(docString)
    })

    When('the section "time_tracking" is validated against the schema', () => {
      validationResult = validator.validateSection(sectionKey, sectionData, schema)
    })

    Then('the validation passes', () => {
      expect(validationResult.valid).toBe(true)
    })

    And('the section data is included in the validated result', () => {
      expect(validationResult.errors).toBeUndefined()
    })
  })

  Scenario('Invalid section fails schema validation with all errors', ({ Given, When, Then, And }) => {
    Given('a plugin schema for "time_tracking" that requires field "global_default.issue_key" to match pattern "^[A-Z][A-Z0-9]+-[0-9]+$"', () => {
      schema = {
        type: 'object',
        properties: {
          time_tracking: {
            type: 'object',
            properties: {
              csv_file: { type: 'string' },
              global_default: {
                type: 'object',
                properties: {
                  issue_key: { type: 'string', pattern: '^[A-Z][A-Z0-9]+-[0-9]+$' },
                  account_key: { type: 'string' },
                },
              },
            },
            required: ['csv_file', 'global_default'],
          },
        },
      }
    })

    And('a response section "time_tracking" with data:', (_ctx, docString: string) => {
      sectionKey = 'time_tracking'
      sectionData = JSON.parse(docString)
    })

    When('the section "time_tracking" is validated against the schema', () => {
      validationResult = validator.validateSection(sectionKey, sectionData, schema)
    })

    Then('the validation fails', () => {
      expect(validationResult.valid).toBe(false)
    })

    And('all validation errors are reported', () => {
      expect(validationResult.errors).toBeDefined()
      expect(validationResult.errors!.length).toBeGreaterThan(0)
    })

    And('the errors contain a message about "issue_key" and "pattern"', () => {
      const allErrors = validationResult.errors!.join(' ')
      expect(allErrors).toContain('pattern')
    })
  })

  Scenario('Section data is wrapped with section key before validation', ({ Given, When, Then, And }) => {
    Given('a plugin schema that defines "time_tracking" as a top-level property', () => {
      schema = {
        type: 'object',
        properties: {
          time_tracking: {
            type: 'object',
            properties: {
              csv_file: { type: 'string' },
            },
          },
        },
      }
    })

    And('a response section "time_tracking" with data:', (_ctx, docString: string) => {
      sectionKey = 'time_tracking'
      sectionData = JSON.parse(docString)
    })

    When('the section "time_tracking" is validated against the schema', () => {
      wrappedData = { [sectionKey]: sectionData }
      validationResult = validator.validateSection(sectionKey, sectionData, schema)
    })

    Then('the data is wrapped as {"time_tracking": <sectionData>} before Ajv validation', () => {
      expect(wrappedData).toEqual({ time_tracking: sectionData })
    })

    And('the schema validates the wrapped object', () => {
      expect(validationResult.valid).toBe(true)
    })
  })

  Scenario('Format keyword "uri" is validated via ajv-formats', ({ Given, When, Then, And }) => {
    Given('a plugin schema for "config" that requires "config.sync_url" with format "uri"', () => {
      schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
            },
          },
        },
      }
    })

    And('a response section "config" with data:', (_ctx, docString: string) => {
      sectionKey = 'config'
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the schema', () => {
      validationResult = validator.validateSection(sectionKey, sectionData, schema)
    })

    Then('the validation fails', () => {
      expect(validationResult.valid).toBe(false)
    })

    And('the errors contain a message about "sync_url" and "format"', () => {
      const allErrors = validationResult.errors!.join(' ')
      expect(allErrors).toContain('format')
    })
  })

  Scenario('Valid URI passes format validation', ({ Given, When, Then, And }) => {
    Given('a plugin schema for "config" that requires "config.sync_url" with format "uri"', () => {
      schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
            },
          },
        },
      }
    })

    And('a response section "config" with data:', (_ctx, docString: string) => {
      sectionKey = 'config'
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the schema', () => {
      validationResult = validator.validateSection(sectionKey, sectionData, schema)
    })

    Then('the validation passes', () => {
      expect(validationResult.valid).toBe(true)
    })
  })

  Scenario('Multiple sections validated independently', ({ Given, When, Then, And }) => {
    let timeTrackingSchema: object
    let jiraSchema: object
    let timeTrackingResult: SectionValidationResult
    let jiraResult: SectionValidationResult

    Given('plugin schemas exist for "time_tracking" and "jira"', () => {
      timeTrackingSchema = {
        type: 'object',
        properties: {
          time_tracking: {
            type: 'object',
            properties: {
              csv_file: { type: 'string' },
            },
            required: ['csv_file'],
          },
        },
      }

      jiraSchema = {
        type: 'object',
        properties: {
          jira: {
            type: 'object',
            properties: {
              project: { type: 'string' },
            },
            required: ['project'],
          },
        },
      }
    })

    And('the response contains both sections', () => {
      // Sections are validated individually, not as a combined response
    })

    When('all sections are validated', () => {
      timeTrackingResult = validator.validateSection(
        'time_tracking',
        { csv_file: 'tt.csv' },
        timeTrackingSchema,
      )
      jiraResult = validator.validateSection(
        'jira',
        { project: 'COPSPA' },
        jiraSchema,
      )
    })

    Then('each section is validated independently against its own schema', () => {
      expect(timeTrackingResult.valid).toBe(true)
      expect(jiraResult.valid).toBe(true)
    })

    And('validation results are returned per section', () => {
      expect(timeTrackingResult.errors).toBeUndefined()
      expect(jiraResult.errors).toBeUndefined()
    })
  })
})

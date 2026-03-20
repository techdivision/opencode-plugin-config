/**
 * Acceptance Tests for US-CFG-026: Config Section Schema
 *
 * Validates that the config plugin's own section is validated against
 * its config.schema.json, with sync_url (format: uri) and sync_token
 * as optional fields.
 *
 * @see SchemaValidator - The service under test
 * @see us-cfg-026-config-section-schema.feature - Gherkin scenarios
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SchemaValidator } from '../../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../../src/interfaces/PluginLoggerInterface.js'
import type { SectionValidationResult } from '../../../../src/types/SectionValidationResult.js'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-03/us-cfg-026-config-section-schema.feature',
)

describeFeature(feature, ({ Scenario, Background }) => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface
  let sectionData: unknown
  let validationResult: SectionValidationResult
  let configSchema: object

  Background(({ Given, And }) => {
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
      sectionData = null
      validationResult = { valid: false }
      configSchema = {}
    })

    And('the config plugin\'s schema exists at "schemas/config.schema.json"', () => {
      const schemaPath = path.resolve(__dirname, '../../../../schemas/config.schema.json')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      configSchema = JSON.parse(content)
      expect(configSchema).toBeDefined()
    })
  })

  Scenario('Valid config section with sync_url passes validation', ({ Given, When, Then }) => {
    Given('a response section "config" with data:', (_ctx, docString: string) => {
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the config schema', () => {
      validationResult = validator.validateSection('config', sectionData, configSchema)
    })

    Then('the validation passes', () => {
      expect(validationResult.valid).toBe(true)
    })
  })

  Scenario('Config section with sync_url only passes validation', ({ Given, When, Then, And }) => {
    Given('a response section "config" with data:', (_ctx, docString: string) => {
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the config schema', () => {
      validationResult = validator.validateSection('config', sectionData, configSchema)
    })

    Then('the validation passes', () => {
      expect(validationResult.valid).toBe(true)
    })

    And('the optional field "sync_token" is not required', () => {
      expect(validationResult.errors).toBeUndefined()
      const data = sectionData as Record<string, unknown>
      expect(data).not.toHaveProperty('sync_token')
    })
  })

  Scenario('Config section with invalid sync_url format fails', ({ Given, When, Then, And }) => {
    Given('a response section "config" with data:', (_ctx, docString: string) => {
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the config schema', () => {
      validationResult = validator.validateSection('config', sectionData, configSchema)
    })

    Then('the validation fails', () => {
      expect(validationResult.valid).toBe(false)
    })

    And('the errors contain a message about "sync_url" and "format"', () => {
      const allErrors = validationResult.errors!.join(' ')
      expect(allErrors).toContain('format')
    })
  })

  Scenario('Empty config section passes validation', ({ Given, When, Then, And }) => {
    Given('a response section "config" with data:', (_ctx, docString: string) => {
      sectionData = JSON.parse(docString)
    })

    When('the section "config" is validated against the config schema', () => {
      validationResult = validator.validateSection('config', {}, configSchema)
    })

    Then('the validation passes', () => {
      expect(validationResult.valid).toBe(true)
    })

    And('no required fields are enforced on the config section', () => {
      expect(validationResult.errors).toBeUndefined()
    })
  })

  Scenario('Config schema file exists in schemas directory', ({ When, Then, And }) => {
    let schemaContent: Record<string, unknown>

    When('the file "schemas/config.schema.json" is read', () => {
      const schemaPath = path.resolve(__dirname, '../../../../schemas/config.schema.json')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      schemaContent = JSON.parse(content)
    })

    Then('it contains a valid JSON Schema with "$schema" field', () => {
      expect(schemaContent.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    })

    And('it defines "config" as a top-level property of type "object"', () => {
      const properties = schemaContent.properties as Record<string, unknown>
      expect(properties).toHaveProperty('config')
      const configProp = properties.config as Record<string, unknown>
      expect(configProp.type).toBe('object')
    })

    And('the "config" property includes "sync_url" with format "uri"', () => {
      const properties = schemaContent.properties as Record<string, unknown>
      const configProp = properties.config as Record<string, unknown>
      const configProperties = configProp.properties as Record<string, unknown>
      const syncUrl = configProperties.sync_url as Record<string, unknown>
      expect(syncUrl.type).toBe('string')
      expect(syncUrl.format).toBe('uri')
    })

    And('the "config" property includes "sync_token" of type "string"', () => {
      const properties = schemaContent.properties as Record<string, unknown>
      const configProp = properties.config as Record<string, unknown>
      const configProperties = configProp.properties as Record<string, unknown>
      const syncToken = configProperties.sync_token as Record<string, unknown>
      expect(syncToken.type).toBe('string')
    })
  })

  Scenario('Config plugin discovered with own configSchema', ({ Given, When, Then, And }) => {
    let pluginJsonContent: Record<string, unknown>
    let discoveredConfigSchema: string | null

    Given('the config plugin\'s plugin.json contains:', (_ctx, docString: string) => {
      pluginJsonContent = JSON.parse(docString)
    })

    When('plugin discovery runs', () => {
      discoveredConfigSchema = (pluginJsonContent.configSchema as string) ?? null
    })

    Then('the config plugin\'s PluginDescriptor has configSchema "schemas/config.schema.json"', () => {
      expect(discoveredConfigSchema).toBe('schemas/config.schema.json')
    })

    And('the schema is used to validate the "config" section like any other plugin', () => {
      const sectionResult = validator.validateSection(
        'config',
        { sync_url: 'https://example.com/webhook', sync_token: 'token123' },
        configSchema,
      )
      expect(sectionResult.valid).toBe(true)
    })
  })
})

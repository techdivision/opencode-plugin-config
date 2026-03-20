/**
 * Unit Tests for SchemaValidator service.
 *
 * Tests the structural validation of webhook responses:
 * - Valid responses return the config object
 * - Invalid responses (non-JSON, arrays, missing fields) return empty object
 * - Logger receives warning messages on validation failures
 *
 * Tests the plugin schema resolution (US-CFG-021):
 * - Schema path correctly composed from descriptor path + configSchema
 * - Section key derivation (hyphens → underscores)
 * - Plugins without configSchema silently skipped
 * - Missing schema files produce warning and are skipped
 * - Invalid JSON schema files produce warning and are skipped
 * - Schema map built from multiple plugins
 *
 * Tests the Ajv section validation (US-CFG-022):
 * - Valid section passes schema validation
 * - Invalid section fails with all errors reported
 * - Section data is wrapped with section key before validation
 * - URI format validated via ajv-formats
 * - Valid URI passes format validation
 * - Multiple sections validated independently
 * - validateResponse integrates section validation
 *
 * @see SchemaValidator - The service under test
 * @see SchemaValidatorInterface - The interface contract
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchemaValidator } from '../../../src/services/SchemaValidator.js'
import type { PluginLoggerInterface } from '../../../src/interfaces/PluginLoggerInterface.js'
import type { SyncResponse } from '../../../src/types/SyncResponse.js'
import type { PluginDescriptor } from '../../../src/types/PluginDescriptor.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(),
  }
})

import { readFileSync } from 'node:fs'

describe('SchemaValidator', () => {
  let validator: SchemaValidator
  let mockLogger: PluginLoggerInterface

  const emptyPlugins: PluginDescriptor[] = []

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withLogging: vi.fn(),
      withErrorHandling: vi.fn(),
    }
    validator = new SchemaValidator(mockLogger)
    vi.mocked(readFileSync).mockReset()
  })

  describe('validateResponse', () => {
    it('should return the config object for a valid response', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const response: SyncResponse = {
        version: '0.1.0',
        config: { time_tracking: { csv_file: 'tt.csv' } },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toEqual({ time_tracking: { csv_file: 'tt.csv' } })
    })

    it('should return empty object for non-JSON input (simulated as invalid structure)', () => {
      const invalidInput = 'this is not json {{{' as unknown as SyncResponse

      const result = validator.validateResponse(invalidInput, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return empty object when response is a JSON array', () => {
      const arrayInput = [1, 2, 3] as unknown as SyncResponse

      const result = validator.validateResponse(arrayInput, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return empty object when version field is missing', () => {
      const noVersion = { config: { time_tracking: {} } } as unknown as SyncResponse

      const result = validator.validateResponse(noVersion, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return empty object when config field is missing', () => {
      const noConfig = { version: '0.1.0' } as unknown as SyncResponse

      const result = validator.validateResponse(noConfig, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return empty object when config field is not an object', () => {
      const stringConfig = { version: '0.1.0', config: 'not an object' } as unknown as SyncResponse

      const result = validator.validateResponse(stringConfig, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return empty object when response is null', () => {
      const nullInput = null as unknown as SyncResponse

      const result = validator.validateResponse(nullInput, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should only include sections that pass schema validation', () => {
      const schema = {
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

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/tt' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: { time_tracking: { csv_file: 'tt.csv' } },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toEqual({ time_tracking: { csv_file: 'tt.csv' } })
    })

    it('should exclude sections that fail schema validation', () => {
      const schema = {
        type: 'object',
        properties: {
          time_tracking: {
            type: 'object',
            properties: {
              csv_file: { type: 'number' },
            },
            required: ['csv_file'],
          },
        },
      }

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/tt' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: { time_tracking: { csv_file: 'not-a-number' } },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('time_tracking'),
      )
    })

    it('should filter out sections not matching any discovered plugin (US-CFG-025)', () => {
      const response: SyncResponse = {
        version: '0.1.0',
        config: { unknown_section: { key: 'value' } },
      }

      const result = validator.validateResponse(response, emptyPlugins)

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown_section'),
      )
    })

    it('should log info (not warning) when accepting a section without schema (US-CFG-024)', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: { marp: { theme: 'default' } },
      }

      validator.validateResponse(response, plugins)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('marp'),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('no schema'),
      )
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should accept section when plugin declares configSchema but file is missing (US-CFG-024)', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/time-tracking' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: { time_tracking: { csv_file: 'tt.csv' } },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toEqual({ time_tracking: { csv_file: 'tt.csv' } })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('schema file not found'),
      )
    })

    it('should handle mix of sections with and without schema (US-CFG-024)', () => {
      const schema = {
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

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        if (String(filePath).includes('time-tracking')) {
          return JSON.stringify(schema)
        }
        throw new Error('ENOENT: no such file or directory')
      })

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/time-tracking' },
        { name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          time_tracking: { csv_file: 'tt.csv' },
          marp: { theme: 'default' },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toHaveProperty('time_tracking')
      expect(result).toHaveProperty('marp')
      expect(Object.keys(result)).toHaveLength(2)
    })
  })

  describe('deriveSectionKey', () => {
    it('should replace hyphens with underscores', () => {
      const result = validator.deriveSectionKey('time-tracking')

      expect(result).toBe('time_tracking')
    })

    it('should return name unchanged when no hyphens present', () => {
      const result = validator.deriveSectionKey('marp')

      expect(result).toBe('marp')
    })

    it('should replace multiple hyphens', () => {
      const result = validator.deriveSectionKey('my-cool-plugin')

      expect(result).toBe('my_cool_plugin')
    })
  })

  describe('buildSchemaMap', () => {
    it('should compose schema path from descriptor path and configSchema', () => {
      const schema = { type: 'object', properties: {} }
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/path/to/opencode-plugin-time-tracking' },
      ]

      validator.buildSchemaMap(plugins)

      expect(readFileSync).toHaveBeenCalledWith(
        '/path/to/opencode-plugin-time-tracking/schemas/config.schema.json',
        'utf-8',
      )
    })

    it('should use section key as map key', () => {
      const schema = { type: 'object', properties: {} }
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(schema))

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/path/to/plugin' },
      ]

      const result = validator.buildSchemaMap(plugins)

      expect(result.has('time_tracking')).toBe(true)
      expect(result.get('time_tracking')).toEqual(schema)
    })

    it('should skip plugin without configSchema', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'shell-env', version: '1.0.0', configSchema: null, path: '/path/to/plugin' },
      ]

      const result = validator.buildSchemaMap(plugins)

      expect(result.size).toBe(0)
      expect(readFileSync).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should log warning and skip when schema file does not exist', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/path/to/plugin' },
      ]

      const result = validator.buildSchemaMap(plugins)

      expect(result.size).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('schema file not found'),
      )
    })

    it('should log warning and skip when schema file contains invalid JSON', () => {
      vi.mocked(readFileSync).mockReturnValue('{ invalid json :::')

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/path/to/plugin' },
      ]

      const result = validator.buildSchemaMap(plugins)

      expect(result.size).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid schema JSON'),
      )
    })

    it('should build map from multiple plugins', () => {
      const timeTrackingSchema = { type: 'object', properties: { csv_file: { type: 'string' } } }
      const configSchema = { type: 'object', properties: { project: { type: 'string' } } }

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        if (String(filePath).includes('time-tracking')) {
          return JSON.stringify(timeTrackingSchema)
        }
        if (String(filePath).includes('config')) {
          return JSON.stringify(configSchema)
        }
        throw new Error('ENOENT: no such file or directory')
      })

      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/time-tracking' },
        { name: 'config', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' },
        { name: 'shell-env', version: '1.0.0', configSchema: null, path: '/plugins/shell-env' },
      ]

      const result = validator.buildSchemaMap(plugins)

      expect(result.size).toBe(2)
      expect(result.has('time_tracking')).toBe(true)
      expect(result.has('config')).toBe(true)
      expect(result.has('shell_env')).toBe(false)
      expect(result.get('time_tracking')).toEqual(timeTrackingSchema)
      expect(result.get('config')).toEqual(configSchema)
    })
  })

  describe('validateSection', () => {
    it('should return valid true for data matching the schema', () => {
      const schema = {
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

      const sectionData = {
        csv_file: 'tracking.csv',
        global_default: { issue_key: 'COPSPA-5', account_key: 'TD_KS_1100' },
      }

      const result = validator.validateSection('time_tracking', sectionData, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should return valid false with all errors for invalid data', () => {
      const schema = {
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
                },
              },
            },
            required: ['csv_file', 'global_default'],
          },
        },
      }

      const sectionData = {
        csv_file: 'tracking.csv',
        global_default: { issue_key: 'invalid', account_key: 'TD_KS_1100' },
      }

      const result = validator.validateSection('time_tracking', sectionData, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.errors!.some((e: string) => e.includes('issue_key') || e.includes('pattern'))).toBe(true)
    })

    it('should wrap section data with section key before validation', () => {
      const schema = {
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

      const sectionData = { csv_file: 'tracking.csv' }

      const result = validator.validateSection('time_tracking', sectionData, schema)

      expect(result.valid).toBe(true)
    })

    it('should fail validation for invalid URI format via ajv-formats', () => {
      const schema = {
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

      const sectionData = { sync_url: 'not-a-valid-uri' }

      const result = validator.validateSection('config', sectionData, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some((e: string) => e.includes('sync_url') || e.includes('format'))).toBe(true)
    })

    it('should pass validation for valid URI format via ajv-formats', () => {
      const schema = {
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

      const sectionData = { sync_url: 'https://n8n.example.com/webhook/oc-config-sync' }

      const result = validator.validateSection('config', sectionData, schema)

      expect(result.valid).toBe(true)
    })

    it('should validate multiple sections independently', () => {
      const timeTrackingSchema = {
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

      const jiraSchema = {
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

      const validTimeTracking = { csv_file: 'tt.csv' }
      const validJira = { project: 'COPSPA' }

      const result1 = validator.validateSection('time_tracking', validTimeTracking, timeTrackingSchema)
      const result2 = validator.validateSection('jira', validJira, jiraSchema)

      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(true)
    })
  })

  describe('filterUnknownSections (US-CFG-025)', () => {
    it('should keep sections matching discovered plugins', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { time_tracking: { csv_file: 'tt.csv' } }

      const result = validator.filterUnknownSections(config, plugins)

      expect(result).toEqual({ time_tracking: { csv_file: 'tt.csv' } })
    })

    it('should remove sections not matching any discovered plugin', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { evil_plugin: { key: 'value' } }

      const result = validator.filterUnknownSections(config, plugins)

      expect(result).toEqual({})
    })

    it('should log warning for each removed section', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { evil_plugin: { key: 'value' }, another_unknown: { data: true } }

      validator.filterUnknownSections(config, plugins)

      expect(mockLogger.warn).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('evil_plugin'),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('another_unknown'),
      )
    })

    it('should use hyphen-to-underscore conversion for plugin name matching', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { time_tracking: { csv_file: 'tt.csv' } }

      const result = validator.filterUnknownSections(config, plugins)

      expect(result).toHaveProperty('time_tracking')
    })

    it('should return empty object when all sections are unknown', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { evil_plugin: { key: 'value' }, another_unknown: { data: true } }

      const result = validator.filterUnknownSections(config, plugins)

      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should return empty object for empty config', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]

      const result = validator.filterUnknownSections({}, plugins)

      expect(Object.keys(result)).toHaveLength(0)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should handle mix of known and unknown sections', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
        { name: 'config', version: '1.0.0', configSchema: null, path: '/plugins/config' },
      ]
      const config = {
        time_tracking: { csv_file: 'tt.csv' },
        config: { project: 'COPSPA' },
        evil_plugin: { key: 'value' },
      }

      const result = validator.filterUnknownSections(config, plugins)

      expect(result).toHaveProperty('time_tracking')
      expect(result).toHaveProperty('config')
      expect(result).not.toHaveProperty('evil_plugin')
    })

    it('should not log warnings when no sections are removed', () => {
      const plugins: PluginDescriptor[] = [
        { name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/plugins/tt' },
      ]
      const config = { time_tracking: { csv_file: 'tt.csv' } }

      validator.filterUnknownSections(config, plugins)

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should include "not recognized" in warning message', () => {
      const plugins: PluginDescriptor[] = []
      const config = { unknown_section: { key: 'value' } }

      validator.filterUnknownSections(config, plugins)

      const warnCalls = vi.mocked(mockLogger.warn).mock.calls
      const allWarnings = warnCalls.map((call) => String(call[0])).join(' ')
      expect(allWarnings).toContain('not recognized')
    })
  })

  describe('section-level error handling (US-CFG-023)', () => {
    const jiraSchema = {
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

    const timeTrackingSchema = {
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
              },
            },
          },
          required: ['csv_file'],
        },
      },
    }

    function createPlugins(...names: string[]): PluginDescriptor[] {
      return names.map((name) => ({
        name,
        version: '1.0.0',
        configSchema: 'schemas/config.schema.json',
        path: `/plugins/${name}`,
      }))
    }

    function setupSchemaMap(schemas: Record<string, object>): void {
      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath)
        for (const [pluginName, schema] of Object.entries(schemas)) {
          if (pathStr.includes(pluginName)) {
            return JSON.stringify(schema)
          }
        }
        throw new Error('ENOENT: no such file or directory')
      })
    }

    it('should keep valid sections and skip invalid sections in a mixed response', () => {
      setupSchemaMap({ jira: jiraSchema, 'time-tracking': timeTrackingSchema })

      const plugins = createPlugins('jira', 'time-tracking')
      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { project: 'COPSPA' },
          time_tracking: { csv_file: 123 },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toHaveProperty('jira')
      expect(result).not.toHaveProperty('time_tracking')
    })

    it('should keep all sections when all are valid', () => {
      setupSchemaMap({ jira: jiraSchema, 'time-tracking': timeTrackingSchema })

      const plugins = createPlugins('jira', 'time-tracking')
      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { project: 'COPSPA' },
          time_tracking: { csv_file: 'tt.csv' },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toHaveProperty('jira')
      expect(result).toHaveProperty('time_tracking')
    })

    it('should return empty object when all sections are invalid', () => {
      setupSchemaMap({ jira: jiraSchema, 'time-tracking': timeTrackingSchema })

      const plugins = createPlugins('jira', 'time-tracking')
      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { project: 42 },
          time_tracking: { csv_file: 123 },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toEqual({})
    })

    it('should log warning with section name and Ajv error details for invalid sections', () => {
      setupSchemaMap({ 'time-tracking': timeTrackingSchema })

      const plugins = createPlugins('time-tracking')
      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          time_tracking: {
            csv_file: 'tt.csv',
            global_default: { issue_key: 'invalid-key' },
          },
        },
      }

      validator.validateResponse(response, plugins)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('time_tracking'),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pattern'),
      )
    })

    it('should continue validation after encountering an invalid section', () => {
      setupSchemaMap({ jira: jiraSchema, 'time-tracking': timeTrackingSchema })

      const plugins: PluginDescriptor[] = [
        ...createPlugins('jira', 'time-tracking'),
        { name: 'marp', version: '1.0.0', configSchema: null, path: '/plugins/marp' },
      ]
      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          jira: { project: 'COPSPA' },
          time_tracking: { csv_file: 123 },
          marp: { theme: 'default' },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toHaveProperty('jira')
      expect(result).not.toHaveProperty('time_tracking')
      expect(result).toHaveProperty('marp')
    })
  })

  describe('config section schema (US-CFG-026)', () => {
    it('should exist as a valid JSON file at schemas/config.schema.json', () => {
      const fs = require('node:fs')
      const path = require('node:path')
      const schemaPath = path.resolve(__dirname, '../../../schemas/config.schema.json')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      const schema = JSON.parse(content)

      expect(schema).toBeDefined()
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.type).toBe('object')
    })

    it('should define "config" as a top-level property with sync_url and sync_token', () => {
      const fs = require('node:fs')
      const path = require('node:path')
      const schemaPath = path.resolve(__dirname, '../../../schemas/config.schema.json')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      const schema = JSON.parse(content)

      expect(schema.properties).toHaveProperty('config')
      expect(schema.properties.config.type).toBe('object')
      expect(schema.properties.config.properties).toHaveProperty('sync_url')
      expect(schema.properties.config.properties.sync_url.format).toBe('uri')
      expect(schema.properties.config.properties).toHaveProperty('sync_token')
      expect(schema.properties.config.properties.sync_token.type).toBe('string')
    })

    it('should validate a valid config section with sync_url and sync_token', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
              sync_token: { type: 'string' },
            },
          },
        },
      }

      const sectionData = {
        sync_url: 'https://n8n.example.com/webhook/oc-config-sync',
        sync_token: 'my-secret-token',
      }

      const result = validator.validateSection('config', sectionData, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should validate a config section with only sync_url (sync_token optional)', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
              sync_token: { type: 'string' },
            },
          },
        },
      }

      const sectionData = {
        sync_url: 'https://n8n.example.com/webhook/oc-config-sync',
      }

      const result = validator.validateSection('config', sectionData, schema)

      expect(result.valid).toBe(true)
    })

    it('should fail validation for invalid sync_url (not a URI)', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
              sync_token: { type: 'string' },
            },
          },
        },
      }

      const sectionData = {
        sync_url: 'not-a-valid-uri',
      }

      const result = validator.validateSection('config', sectionData, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some((e: string) => e.includes('format'))).toBe(true)
    })

    it('should validate an empty config section (no required fields)', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
              sync_token: { type: 'string' },
            },
          },
        },
      }

      const result = validator.validateSection('config', {}, schema)

      expect(result.valid).toBe(true)
    })

    it('should integrate with discovery when config plugin has configSchema', () => {
      const configSchema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              sync_url: { type: 'string', format: 'uri' },
              sync_token: { type: 'string' },
            },
          },
        },
      }

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(configSchema))

      const plugins: PluginDescriptor[] = [
        { name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json', path: '/plugins/config' },
      ]

      const response: SyncResponse = {
        version: '0.1.0',
        config: {
          config: {
            sync_url: 'https://n8n.example.com/webhook/oc-config-sync',
            sync_token: 'my-secret-token',
          },
        },
      }

      const result = validator.validateResponse(response, plugins)

      expect(result).toHaveProperty('config')
      expect(result.config).toEqual({
        sync_url: 'https://n8n.example.com/webhook/oc-config-sync',
        sync_token: 'my-secret-token',
      })
    })
  })
})

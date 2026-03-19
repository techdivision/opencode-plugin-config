/**
 * Unit Tests for ConfigLoader (US-CFG-001, 002, 003, 004, 005, 006)
 *
 * Tests reading global/project configs, deep-merge, env-var resolution,
 * protected fields, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ConfigLoader } from '../../../src/services/ConfigLoader.js'
import type { IConfigMerger } from '../../../src/services/interfaces/IConfigMerger.js'
import type { PluginLogger } from '../../../src/utils/logger.js'

// Mock fs module
vi.mock('node:fs')

function createMockMerger(): IConfigMerger {
  return {
    merge: vi.fn((base, override) => ({ ...base, ...override })),
    mergeWithProtectedFields: vi.fn((base, override) => ({ ...base, ...override }))
  }
}

function createMockLogger(): PluginLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withLogging: vi.fn((fn) => fn),
    withErrorHandling: vi.fn((fn) => fn)
  }
}

describe('ConfigLoader', () => {
  let mockMerger: IConfigMerger
  let mockLogger: PluginLogger
  let loader: ConfigLoader

  beforeEach(() => {
    mockMerger = createMockMerger()
    mockLogger = createMockLogger()
    loader = new ConfigLoader(mockMerger, mockLogger)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // US-CFG-001: Read Global Config
  // ============================================================
  describe('readGlobalConfig() [US-CFG-001]', () => {
    it('should read and parse existing global config file', () => {
      const configData = {
        config: { sync_url: 'https://n8n.example.com/webhook/oc-config-sync' },
        time_tracking: { pricing: { ratio: { input: 0.8, output: 0.2 } } }
      }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configData))

      const result = loader.readGlobalConfig()

      expect(result).toEqual(configData)
      const expectedPath = path.join(os.homedir(), '.config/opencode/opencode-project.json')
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8')
    })

    it('should return empty object when config file does not exist', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
    })

    it('should return empty object when config directory does not exist', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
    })
  })

  // ============================================================
  // US-CFG-002: Read Project Config
  // ============================================================
  describe('readProjectConfig() [US-CFG-002]', () => {
    it('should read and parse existing project config file', () => {
      const configData = {
        jira: { project: 'COPSPA', base_url: 'https://techdivision.atlassian.net' },
        time_tracking: { csv_file: '.opencode/time_tracking/time-tracking.csv' }
      }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configData))

      const result = loader.readProjectConfig('/my/project')

      expect(result).toEqual(configData)
      const expectedPath = path.join('/my/project', '.opencode/opencode-project.json')
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8')
    })

    it('should return empty object when project config file does not exist', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })

      const result = loader.readProjectConfig('/my/project')

      expect(result).toEqual({})
    })

    it('should return empty object when .opencode directory does not exist', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })

      const result = loader.readProjectConfig('/my/project')

      expect(result).toEqual({})
    })
  })

  // ============================================================
  // US-CFG-003: Deep-Merge + loadLocalConfig facade
  // ============================================================
  describe('loadLocalConfig() [US-CFG-003]', () => {
    it('should orchestrate readGlobal → readProject → merge → resolveEnvVars', () => {
      const globalConfig = { time_tracking: { csv_file: 'global.csv' } }
      const projectConfig = { jira: { project: 'COPSPA' } }
      const mergedConfig = { time_tracking: { csv_file: 'global.csv' }, jira: { project: 'COPSPA' } }

      // First call = global, second call = project
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(globalConfig))
        .mockReturnValueOnce(JSON.stringify(projectConfig))

      vi.mocked(mockMerger.merge).mockReturnValue(mergedConfig)

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith(globalConfig, projectConfig)
      expect(result).toEqual(mergedConfig)
    })

    it('should return empty object when both configs are empty', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })
      vi.mocked(mockMerger.merge).mockReturnValue({})

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith({}, {})
      expect(result).toEqual({})
    })

    it('should use only global config when project config is missing', () => {
      const globalConfig = { config: { sync_url: 'https://n8n.example.com' } }

      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(globalConfig))
        .mockImplementationOnce(() => {
          const error = new Error('ENOENT') as NodeJS.ErrnoException
          error.code = 'ENOENT'
          throw error
        })

      vi.mocked(mockMerger.merge).mockReturnValue(globalConfig)

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith(globalConfig, {})
    })

    it('should use only project config when global config is missing', () => {
      const projectConfig = { jira: { project: 'COPSPA' } }

      vi.mocked(fs.readFileSync)
        .mockImplementationOnce(() => {
          const error = new Error('ENOENT') as NodeJS.ErrnoException
          error.code = 'ENOENT'
          throw error
        })
        .mockReturnValueOnce(JSON.stringify(projectConfig))

      vi.mocked(mockMerger.merge).mockReturnValue(projectConfig)

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith({}, projectConfig)
    })
  })

  // ============================================================
  // US-CFG-004: Environment Variable Resolution
  // ============================================================
  describe('resolveEnvVars() [US-CFG-004]', () => {
    it('should resolve a single {env:VAR} placeholder', () => {
      process.env.OC_CONFIG_SYNC_TOKEN = 'my-secret-token'

      const config = { config: { sync_token: '{env:OC_CONFIG_SYNC_TOKEN}' } }
      const result = loader.resolveEnvVars(config) as any

      expect(result.config.sync_token).toBe('my-secret-token')

      delete process.env.OC_CONFIG_SYNC_TOKEN
    })

    it('should resolve multiple {env:VAR} placeholders in different values', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://n8n.example.com/webhook/oc-config-sync'
      process.env.OC_CONFIG_SYNC_TOKEN = 'my-secret-token'

      const config = {
        config: {
          sync_url: '{env:OC_CONFIG_SYNC_URL}',
          sync_token: '{env:OC_CONFIG_SYNC_TOKEN}'
        }
      }
      const result = loader.resolveEnvVars(config) as any

      expect(result.config.sync_url).toBe('https://n8n.example.com/webhook/oc-config-sync')
      expect(result.config.sync_token).toBe('my-secret-token')

      delete process.env.OC_CONFIG_SYNC_URL
      delete process.env.OC_CONFIG_SYNC_TOKEN
    })

    it('should resolve {env:VAR} in deeply nested config values', () => {
      process.env.TT_TEMPO_API_TOKEN = 'tempo-api-key-123'

      const config = {
        time_tracking: {
          sync: {
            tempo: {
              api_token: '{env:TT_TEMPO_API_TOKEN}'
            }
          }
        }
      }
      const result = loader.resolveEnvVars(config) as any

      expect(result.time_tracking.sync.tempo.api_token).toBe('tempo-api-key-123')

      delete process.env.TT_TEMPO_API_TOKEN
    })

    it('should preserve original placeholder when env var is not set', () => {
      delete process.env.NONEXISTENT_VAR

      const config = { config: { sync_token: '{env:NONEXISTENT_VAR}' } }
      const result = loader.resolveEnvVars(config) as any

      expect(result.config.sync_token).toBe('{env:NONEXISTENT_VAR}')
    })

    it('should not affect non-string values', () => {
      const config = {
        time_tracking: {
          pricing: { ratio: { input: 0.8, output: 0.2 } },
          valid_projects: ['COPSPA']
        }
      }
      const result = loader.resolveEnvVars(config) as any

      expect(result.time_tracking.pricing.ratio.input).toBe(0.8)
      expect(result.time_tracking.valid_projects).toEqual(['COPSPA'])
    })

    it('should NOT resolve recursively - only simple replacement', () => {
      process.env.REDIRECT_VAR = '{env:ANOTHER_VAR}'
      process.env.ANOTHER_VAR = 'final-value'

      const config = { config: { sync_url: '{env:REDIRECT_VAR}' } }
      const result = loader.resolveEnvVars(config) as any

      expect(result.config.sync_url).toBe('{env:ANOTHER_VAR}')

      delete process.env.REDIRECT_VAR
      delete process.env.ANOTHER_VAR
    })
  })

  // ============================================================
  // US-CFG-006: Error Handling
  // ============================================================
  describe('Error Handling [US-CFG-006]', () => {
    it('should return empty object and log warning for invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json content, missing quotes')

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid JSON'),
        expect.any(Object)
      )
    })

    it('should return empty object for completely empty file', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('')

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
    })

    it('should return empty object and log warning for valid JSON that is not an object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('["this", "is", "an", "array"]')

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not a JSON object'),
        expect.any(Object)
      )
    })

    it('should return empty object and log warning for permission errors', () => {
      const error = new Error('EACCES') as NodeJS.ErrnoException
      error.code = 'EACCES'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })

      const result = loader.readGlobalConfig()

      expect(result).toEqual({})
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('permission'),
        expect.any(Object)
      )
    })

    it('should handle both configs missing without error', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw error })
      vi.mocked(mockMerger.merge).mockReturnValue({})

      const result = loader.loadLocalConfig('/my/project')

      expect(result).toEqual({})
    })

    it('should use project config alone when global config is invalid', () => {
      const projectConfig = { jira: { project: 'COPSPA' } }

      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce('{ invalid json')
        .mockReturnValueOnce(JSON.stringify(projectConfig))

      vi.mocked(mockMerger.merge).mockReturnValue(projectConfig)

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith({}, projectConfig)
    })

    it('should use global config alone when project config is invalid', () => {
      const globalConfig = { time_tracking: { pricing: { default: { input: 3, output: 15 } } } }

      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(globalConfig))
        .mockReturnValueOnce('{ invalid json')

      vi.mocked(mockMerger.merge).mockReturnValue(globalConfig)

      const result = loader.loadLocalConfig('/my/project')

      expect(mockMerger.merge).toHaveBeenCalledWith(globalConfig, {})
    })
  })
})

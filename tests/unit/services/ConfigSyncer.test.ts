/**
 * Unit tests for ConfigSyncer — sync_url and sync_token resolution.
 *
 * @remarks
 * Tests the resolution cascade:
 * 1. Value from already env-resolved localConfig.config.sync_url/sync_token
 * 2. Fallback to process.env.OC_CONFIG_SYNC_URL / OC_CONFIG_SYNC_TOKEN
 * 3. null when neither source provides a value
 *
 * Note: resolveSyncUrl() and resolveSyncToken() are private methods (internal
 * to syncConfig). Since syncConfig() is still a stub (US-CFG-014), we test
 * the private methods via type-casting as a temporary measure. Once syncConfig()
 * is implemented, these tests should be refactored to test through the public API.
 *
 * @see ConfigSyncer
 * @see us-cfg-016-sync-url-resolution.feature
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigSyncer } from '../../../src/services/ConfigSyncer.js'
import type { PluginLogger } from '../../../src/utils/logger.js'

/**
 * Type alias for accessing private resolution methods during testing.
 *
 * @remarks
 * Temporary workaround until syncConfig() is fully implemented (US-CFG-014).
 * These methods are private because they are internal to the sync workflow,
 * but need to be tested in isolation while the public API is still a stub.
 */
type ConfigSyncerTestAccess = {
  resolveSyncUrl(localConfig: Record<string, unknown>): string | null
  resolveSyncToken(localConfig: Record<string, unknown>): string | null
}

describe('ConfigSyncer', () => {
  let syncer: ConfigSyncerTestAccess
  let mockLogger: PluginLogger

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withLogging: vi.fn(),
      withErrorHandling: vi.fn(),
    } as unknown as PluginLogger

    syncer = new ConfigSyncer(mockLogger) as unknown as ConfigSyncerTestAccess
  })

  afterEach(() => {
    delete process.env.OC_CONFIG_SYNC_URL
    delete process.env.OC_CONFIG_SYNC_TOKEN
  })

  describe('resolveSyncUrl', () => {
    it('should return sync_url directly from config when present', () => {
      const localConfig = {
        config: { sync_url: 'https://n8n.example.com/webhook/oc-config-sync' },
      }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBe('https://n8n.example.com/webhook/oc-config-sync')
    })

    it('should fallback to process.env.OC_CONFIG_SYNC_URL when config has no sync_url', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://fallback.example.com/webhook'
      const localConfig = { jira: { project: 'COPSPA' } }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBe('https://fallback.example.com/webhook')
    })

    it('should fallback to process.env when config section exists but has no sync_url', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://fallback.example.com/webhook'
      const localConfig = { config: { other_key: 'value' } }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBe('https://fallback.example.com/webhook')
    })

    it('should return null when no sync_url is available from any source', () => {
      const localConfig = {}

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBeNull()
    })

    it('should return null when config has unresolved {env:VAR} placeholder and env var is not set', () => {
      const localConfig = {
        config: { sync_url: '{env:OC_CONFIG_SYNC_URL}' },
      }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBeNull()
    })

    it('should prefer config value over process.env', () => {
      process.env.OC_CONFIG_SYNC_URL = 'https://from-env.example.com'
      const localConfig = {
        config: { sync_url: 'https://from-config.example.com/webhook' },
      }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBe('https://from-config.example.com/webhook')
    })

    it('should handle empty config object', () => {
      const localConfig = {}

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBeNull()
    })

    it('should handle config section that is not an object', () => {
      const localConfig = { config: 'not-an-object' }

      const result = syncer.resolveSyncUrl(localConfig)

      expect(result).toBeNull()
    })
  })

  describe('resolveSyncToken', () => {
    it('should return sync_token directly from config when present', () => {
      const localConfig = {
        config: { sync_token: 'my-secret-token' },
      }

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBe('my-secret-token')
    })

    it('should fallback to process.env.OC_CONFIG_SYNC_TOKEN when config has no sync_token', () => {
      process.env.OC_CONFIG_SYNC_TOKEN = 'env-secret-token'
      const localConfig = {}

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBe('env-secret-token')
    })

    it('should return null when no sync_token is available from any source', () => {
      const localConfig = {}

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBeNull()
    })

    it('should return null when config has unresolved {env:VAR} placeholder and env var is not set', () => {
      const localConfig = {
        config: { sync_token: '{env:OC_CONFIG_SYNC_TOKEN}' },
      }

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBeNull()
    })

    it('should prefer config value over process.env', () => {
      process.env.OC_CONFIG_SYNC_TOKEN = 'env-token'
      const localConfig = {
        config: { sync_token: 'config-token' },
      }

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBe('config-token')
    })

    it('should handle missing sync_token gracefully (OK per spec)', () => {
      const localConfig = {
        config: { sync_url: 'https://example.com/webhook' },
      }

      const result = syncer.resolveSyncToken(localConfig)

      expect(result).toBeNull()
    })
  })

  describe('constructor', () => {
    it('should accept logger as constructor parameter', () => {
      const syncerWithLogger = new ConfigSyncer(mockLogger)
      expect(syncerWithLogger).toBeInstanceOf(ConfigSyncer)
    })

    it('should accept optional logger (undefined)', () => {
      const syncerWithoutLogger = new ConfigSyncer()
      expect(syncerWithoutLogger).toBeInstanceOf(ConfigSyncer)
    })
  })
})

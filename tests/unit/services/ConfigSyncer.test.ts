/**
 * Unit tests for ConfigSyncer — sync_url/sync_token resolution, payload assembly, and HTTP POST.
 *
 * @remarks
 * Tests the resolution cascade:
 * 1. Value from already env-resolved localConfig.config.sync_url/sync_token
 * 2. Fallback to process.env.OC_CONFIG_SYNC_URL / OC_CONFIG_SYNC_TOKEN
 * 3. null when neither source provides a value
 *
 * Also tests buildPayload() (US-CFG-011) which assembles the SyncPayload
 * from the provided parameters, and postToWebhook() (US-CFG-012) which
 * sends the HTTP POST request to the webhook endpoint.
 *
 * Note: resolveSyncUrl(), resolveSyncToken(), buildPayload() and postToWebhook()
 * are private methods (internal to syncConfig). Since syncConfig() is still a stub
 * (US-CFG-014), we test the private methods via type-casting as a temporary
 * measure. Once syncConfig() is implemented, these tests should be refactored
 * to test through the public API.
 *
 * @see ConfigSyncer
 * @see us-cfg-016-sync-url-resolution.feature
 * @see us-cfg-011-payload-assembly.feature
 * @see us-cfg-012-http-post-webhook.feature
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigSyncer } from '../../../src/services/ConfigSyncer.js'
import type { PluginLogger } from '../../../src/utils/logger.js'
import type { SyncPayload } from '../../../src/types/SyncPayload.js'
import type { SyncResponse } from '../../../src/types/SyncResponse.js'

/**
 * Type alias for accessing private methods during testing.
 *
 * @remarks
 * Temporary workaround until syncConfig() is fully implemented (US-CFG-014).
 * These methods are private because they are internal to the sync workflow,
 * but need to be tested in isolation while the public API is still a stub.
 */
type ConfigSyncerTestAccess = {
  resolveSyncUrl(localConfig: Record<string, unknown>): string | null
  resolveSyncToken(localConfig: Record<string, unknown>): string | null
  buildPayload(
    localConfig: Record<string, unknown>,
    pluginNames: string[],
    pluginVersion: string,
    email: string,
  ): SyncPayload
  postToWebhook(
    syncUrl: string,
    payload: SyncPayload,
    syncToken: string | null,
  ): Promise<SyncResponse>
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

  describe('buildPayload [US-CFG-011]', () => {
    it('should set plugin_version from the pluginVersion parameter', () => {
      const payload = syncer.buildPayload({}, [], '0.2.0', 'user@example.com')

      expect(payload.plugin_version).toBe('0.2.0')
    })

    it('should set email from the email parameter', () => {
      const payload = syncer.buildPayload({}, [], '0.1.0', 't.wagner@techdivision.com')

      expect(payload.email).toBe('t.wagner@techdivision.com')
    })

    it('should set plugins from the pluginNames parameter', () => {
      const pluginNames = ['config', 'time-tracking', 'jira']

      const payload = syncer.buildPayload({}, pluginNames, '0.1.0', 'user@example.com')

      expect(payload.plugins).toEqual(['config', 'time-tracking', 'jira'])
    })

    it('should set config from the localConfig parameter', () => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: 'tracking.csv' },
      }

      const payload = syncer.buildPayload(localConfig, [], '0.1.0', 'user@example.com')

      expect(payload.config).toEqual({
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: 'tracking.csv' },
      })
    })

    it('should return a valid SyncPayload with all four fields', () => {
      const localConfig = { jira: { project: 'COPSPA' } }
      const pluginNames = ['config', 'time-tracking']
      const pluginVersion = '0.2.0'
      const email = 't.wagner@techdivision.com'

      const payload = syncer.buildPayload(localConfig, pluginNames, pluginVersion, email)

      expect(payload).toEqual({
        plugin_version: '0.2.0',
        email: 't.wagner@techdivision.com',
        plugins: ['config', 'time-tracking'],
        config: { jira: { project: 'COPSPA' } },
      })
    })

    it('should handle empty plugins array', () => {
      const payload = syncer.buildPayload({}, [], '0.1.0', 'user@example.com')

      expect(payload.plugins).toEqual([])
    })

    it('should handle empty config object', () => {
      const payload = syncer.buildPayload({}, [], '0.1.0', 'user@example.com')

      expect(payload.config).toEqual({})
    })

    it('should produce a JSON-serializable payload', () => {
      const localConfig = {
        jira: { project: 'COPSPA' },
        nested: { deep: { value: true } },
      }

      const payload = syncer.buildPayload(localConfig, ['config'], '0.1.0', 'user@example.com')
      const serialized = JSON.stringify(payload)
      const deserialized = JSON.parse(serialized)

      expect(deserialized).toEqual(payload)
    })

    it('should preserve nested config structure', () => {
      const localConfig = {
        jira: { project: 'COPSPA', board: { id: 42 } },
        time_tracking: { csv_file: 'tracking.csv' },
      }

      const payload = syncer.buildPayload(localConfig, [], '0.1.0', 'user@example.com')

      expect(payload.config.jira).toEqual({ project: 'COPSPA', board: { id: 42 } })
    })
  })

  describe('postToWebhook [US-CFG-012]', () => {
    const testSyncUrl = 'https://n8n.example.com/webhook/oc-config-sync'
    const testPayload: SyncPayload = {
      plugin_version: '0.1.0',
      email: 'user@example.com',
      plugins: ['config'],
      config: { jira: { project: 'COPSPA' } },
    }
    const testSyncResponse: SyncResponse = {
      version: '0.1.0',
      config: { jira: { board_id: 42 } },
    }

    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should send a POST request to the given sync_url', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe(testSyncUrl)
      expect(options.method).toBe('POST')
    })

    it('should set Content-Type header to application/json', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('should send the payload as JSON-serialized body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      const [, options] = fetchMock.mock.calls[0]
      expect(JSON.parse(options.body)).toEqual(testPayload)
    })

    it('should include Authorization header with Bearer token when sync_token is provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, 'my-secret-token')

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer my-secret-token')
    })

    it('should not include Authorization header when sync_token is null', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Authorization']).toBeUndefined()
    })

    it('should parse and return the response as SyncResponse', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      const result = await syncer.postToWebhook(testSyncUrl, testPayload, null)

      expect(result).toEqual(testSyncResponse)
    })

    it('should throw an error when response is not ok (HTTP 500)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(
        syncer.postToWebhook(testSyncUrl, testPayload, null),
      ).rejects.toThrow('HTTP 500: Internal Server Error')
    })

    it('should throw an error when response is not ok (HTTP 404)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(
        syncer.postToWebhook(testSyncUrl, testPayload, null),
      ).rejects.toThrow('HTTP 404: Not Found')
    })

    it('should throw an error when response is not ok (HTTP 401)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(
        syncer.postToWebhook(testSyncUrl, testPayload, null),
      ).rejects.toThrow('HTTP 401: Unauthorized')
    })

    it('should pass an AbortSignal to fetch for timeout control', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      const [, options] = fetchMock.mock.calls[0]
      expect(options.signal).toBeInstanceOf(AbortSignal)
    })

    it('should abort the request after 5 seconds via AbortController', async () => {
      vi.useFakeTimers()

      fetchMock.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
      })

      const promise = syncer.postToWebhook(testSyncUrl, testPayload, null)

      vi.advanceTimersByTime(5000)

      await expect(promise).rejects.toThrow()

      vi.useRealTimers()
    })

    it('should use native fetch() (no external HTTP library)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testSyncResponse),
      })

      await syncer.postToWebhook(testSyncUrl, testPayload, null)

      expect(fetchMock).toHaveBeenCalledTimes(1)
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

/**
 * Unit Tests for SyncPayload Type (US-CFG-010)
 *
 * Validates that the SyncPayload interface enforces all required fields
 * with correct types at compile time.
 */
import { describe, it, expect } from 'vitest'
import type { SyncPayload } from '../../../src/types/SyncPayload.js'

describe('SyncPayload Type [US-CFG-010]', () => {
  describe('required fields', () => {
    it('should accept a valid SyncPayload with all required fields', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'user@example.com',
        plugins: ['config', 'time-tracking'],
        config: { jira: { project: 'COPSPA' } },
      }

      expect(payload.plugin_version).toBe('0.1.0')
      expect(payload.email).toBe('user@example.com')
      expect(payload.plugins).toEqual(['config', 'time-tracking'])
      expect(payload.config).toEqual({ jira: { project: 'COPSPA' } })
    })

    it('should have plugin_version as string type', () => {
      const payload: SyncPayload = {
        plugin_version: '1.2.3',
        email: 'test@test.com',
        plugins: [],
        config: {},
      }

      expect(typeof payload.plugin_version).toBe('string')
    })

    it('should have email as string type', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'dev@company.com',
        plugins: [],
        config: {},
      }

      expect(typeof payload.email).toBe('string')
    })

    it('should have plugins as string array type', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'test@test.com',
        plugins: ['plugin-a', 'plugin-b', 'plugin-c'],
        config: {},
      }

      expect(Array.isArray(payload.plugins)).toBe(true)
      payload.plugins.forEach((plugin) => {
        expect(typeof plugin).toBe('string')
      })
    })

    it('should have config as Record<string, unknown> type', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'test@test.com',
        plugins: [],
        config: { nested: { deep: true }, count: 42 },
      }

      expect(typeof payload.config).toBe('object')
      expect(payload.config).not.toBeNull()
    })

    it('should accept empty plugins array', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'test@test.com',
        plugins: [],
        config: {},
      }

      expect(payload.plugins).toEqual([])
    })

    it('should accept empty config object', () => {
      const payload: SyncPayload = {
        plugin_version: '0.1.0',
        email: 'test@test.com',
        plugins: [],
        config: {},
      }

      expect(payload.config).toEqual({})
    })
  })
})

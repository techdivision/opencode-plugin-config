/**
 * Unit Tests for SyncResponse Type (US-CFG-010)
 *
 * Validates that the SyncResponse interface enforces all required fields
 * with correct types at compile time.
 */
import { describe, it, expect } from 'vitest'
import type { SyncResponse } from '../../../src/types/SyncResponse.js'

describe('SyncResponse Type [US-CFG-010]', () => {
  describe('required fields', () => {
    it('should accept a valid SyncResponse with all required fields', () => {
      const response: SyncResponse = {
        version: '0.1.0',
        config: { jira: { project: 'COPSPA' } },
      }

      expect(response.version).toBe('0.1.0')
      expect(response.config).toEqual({ jira: { project: 'COPSPA' } })
    })

    it('should have version as string type', () => {
      const response: SyncResponse = {
        version: '2.0.0',
        config: {},
      }

      expect(typeof response.version).toBe('string')
    })

    it('should have config as Record<string, unknown> type', () => {
      const response: SyncResponse = {
        version: '0.1.0',
        config: { time_tracking: { enabled: true }, jira: { url: 'https://jira.example.com' } },
      }

      expect(typeof response.config).toBe('object')
      expect(response.config).not.toBeNull()
    })

    it('should accept minimal valid response with empty config', () => {
      const response: SyncResponse = {
        version: '0.1.0',
        config: {},
      }

      expect(response.version).toBe('0.1.0')
      expect(response.config).toEqual({})
    })

    it('should accept config with deeply nested objects', () => {
      const response: SyncResponse = {
        version: '1.0.0',
        config: {
          jira: {
            project: 'COPSPA',
            workflow: {
              transitions: {
                start_work: { from: 'selected', to: 'in_progress' },
              },
            },
          },
        },
      }

      expect(response.config).toBeDefined()
    })
  })
})

/**
 * Unit Tests for ConfigSyncerInterface (US-CFG-010)
 *
 * Validates that the ConfigSyncerInterface defines the correct
 * method signature for syncConfig().
 */
import { describe, it, expect } from 'vitest'
import type { ConfigSyncerInterface } from '../../../src/interfaces/ConfigSyncerInterface.js'
import type { SyncResponse } from '../../../src/types/SyncResponse.js'

describe('ConfigSyncerInterface [US-CFG-010]', () => {
  describe('syncConfig method signature', () => {
    it('should define syncConfig with correct parameter types', async () => {
      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (
          _localConfig: Record<string, unknown>,
          _pluginNames: string[],
          _pluginVersion: string,
        ): Promise<SyncResponse | null> => {
          return { version: '0.1.0', config: {} }
        },
      }

      const result = await mockSyncer.syncConfig(
        { jira: { project: 'TEST' } },
        ['config', 'time-tracking'],
        '0.1.0',
      )

      expect(result).toEqual({ version: '0.1.0', config: {} })
    })

    it('should allow syncConfig to return null for graceful degradation', async () => {
      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (): Promise<SyncResponse | null> => {
          return null
        },
      }

      const result = await mockSyncer.syncConfig({}, [], '0.1.0')

      expect(result).toBeNull()
    })

    it('should return a Promise', () => {
      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (): Promise<SyncResponse | null> => null,
      }

      const result = mockSyncer.syncConfig({}, [], '0.1.0')

      expect(result).toBeInstanceOf(Promise)
    })

    it('should accept localConfig as Record<string, unknown>', async () => {
      const complexConfig: Record<string, unknown> = {
        jira: { project: 'COPSPA', url: 'https://jira.example.com' },
        time_tracking: { enabled: true },
        nested: { deep: { value: 42 } },
      }

      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (localConfig): Promise<SyncResponse | null> => {
          return { version: '0.1.0', config: localConfig }
        },
      }

      const result = await mockSyncer.syncConfig(complexConfig, [], '0.1.0')

      expect(result?.config).toEqual(complexConfig)
    })

    it('should accept pluginNames as string array', async () => {
      let capturedPlugins: string[] = []

      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (
          _localConfig,
          pluginNames,
        ): Promise<SyncResponse | null> => {
          capturedPlugins = pluginNames
          return null
        },
      }

      await mockSyncer.syncConfig(
        {},
        ['config', 'time-tracking', 'shell-env'],
        '0.1.0',
      )

      expect(capturedPlugins).toEqual(['config', 'time-tracking', 'shell-env'])
    })

    it('should accept pluginVersion as string', async () => {
      let capturedVersion = ''

      const mockSyncer: ConfigSyncerInterface = {
        syncConfig: async (
          _localConfig,
          _pluginNames,
          pluginVersion,
        ): Promise<SyncResponse | null> => {
          capturedVersion = pluginVersion
          return null
        },
      }

      await mockSyncer.syncConfig({}, [], '1.2.3')

      expect(capturedVersion).toBe('1.2.3')
    })
  })
})

/**
 * Unit Tests for PluginDiscovery service.
 *
 * @remarks
 * Tests the plugin discovery logic that scans global and local
 * node_modules directories for OpenCode plugins.
 *
 * All filesystem access is mocked to isolate the unit under test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import { PluginDiscovery } from '../../../src/utils/PluginDiscovery.js'
import type { PluginDescriptor } from '../../../src/types/PluginDescriptor.js'
import {
  GLOBAL_PLUGIN_PATH,
  LOCAL_PLUGIN_PATH,
} from '../../../src/utils/PluginDiscovery.js'

vi.mock('node:fs')
vi.mock('node:os')

describe('PluginDiscovery', () => {
  let discovery: PluginDiscovery

  beforeEach(() => {
    discovery = new PluginDiscovery()
    vi.mocked(os.homedir).mockReturnValue('/home/testuser')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('discoverPlugins', () => {
    it('should return an empty Map when no node_modules directories exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = discovery.discoverPlugins('/project')

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('should discover plugins from global node_modules', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') return true
        if (path === '/project/.opencode/node_modules') return false
        if (path.endsWith('package.json')) return true
        if (path.endsWith('plugin.json')) return true
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') {
          return ['@techdivision'] as any
        }
        if (path === '/home/testuser/.config/opencode/node_modules/@techdivision') {
          return ['opencode-plugin-config'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('package.json')) {
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-config',
            version: '0.1.0',
            opencode: { plugin: true },
          })
        }
        if (path.endsWith('plugin.json')) {
          return JSON.stringify({
            name: 'config',
            version: '0.1.0',
            configSchema: 'schemas/config.schema.json',
          })
        }
        return '{}'
      })

      const result = discovery.discoverPlugins('/project')

      expect(result.size).toBe(1)
      expect(result.has('config')).toBe(true)
      const descriptor = result.get('config')!
      expect(descriptor.name).toBe('config')
      expect(descriptor.version).toBe('0.1.0')
      expect(descriptor.configSchema).toBe('schemas/config.schema.json')
    })

    it('should discover plugins from local node_modules', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') return false
        if (path === '/project/.opencode/node_modules') return true
        if (path.endsWith('package.json')) return true
        if (path.endsWith('plugin.json')) return true
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/project/.opencode/node_modules') {
          return ['@techdivision'] as any
        }
        if (path === '/project/.opencode/node_modules/@techdivision') {
          return ['opencode-plugin-time-tracking'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('package.json')) {
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-time-tracking',
            version: '1.4.0',
            opencode: { plugin: true },
          })
        }
        if (path.endsWith('plugin.json')) {
          return JSON.stringify({
            name: 'time-tracking',
            version: '1.4.0',
            configSchema: 'schemas/config.schema.json',
          })
        }
        return '{}'
      })

      const result = discovery.discoverPlugins('/project')

      expect(result.size).toBe(1)
      expect(result.has('time-tracking')).toBe(true)
    })

    it('should give local plugins priority over global plugins', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('node_modules')) return true
        if (path.endsWith('package.json')) return true
        if (path.endsWith('plugin.json')) return true
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('node_modules')) {
          return ['@techdivision'] as any
        }
        if (path.endsWith('@techdivision')) {
          return ['opencode-plugin-config'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      let callCount = 0
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('package.json')) {
          callCount++
          const isLocal = path.includes('.opencode')
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-config',
            version: isLocal ? '0.2.0' : '0.1.0',
            opencode: { plugin: true },
          })
        }
        if (path.endsWith('plugin.json')) {
          const isLocal = path.includes('.opencode')
          return JSON.stringify({
            name: 'config',
            version: isLocal ? '0.2.0' : '0.1.0',
            configSchema: 'schemas/config.schema.json',
          })
        }
        return '{}'
      })

      const result = discovery.discoverPlugins('/project')

      expect(result.size).toBe(1)
      const descriptor = result.get('config')!
      // Local (0.2.0) should override global (0.1.0)
      expect(descriptor.version).toBe('0.2.0')
    })

    it('should skip packages without opencode.plugin marker', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') return true
        if (path === '/project/.opencode/node_modules') return false
        if (path.endsWith('package.json')) return true
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('node_modules')) {
          return ['some-regular-package'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      vi.mocked(fs.readFileSync).mockImplementation(() => {
        return JSON.stringify({
          name: 'some-regular-package',
          version: '1.0.0',
          // No opencode.plugin marker
        })
      })

      const result = discovery.discoverPlugins('/project')

      expect(result.size).toBe(0)
    })

    it('should handle missing plugin.json gracefully', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') return true
        if (path === '/project/.opencode/node_modules') return false
        if (path.endsWith('package.json')) return true
        if (path.endsWith('plugin.json')) return false
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') {
          return ['@techdivision'] as any
        }
        if (path.endsWith('@techdivision')) {
          return ['opencode-plugin-config'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const path = String(p)
        if (path.endsWith('package.json')) {
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-config',
            version: '0.1.0',
            opencode: { plugin: true },
          })
        }
        throw new Error('ENOENT: no such file')
      })

      const result = discovery.discoverPlugins('/project')

      // Plugin should still be discovered, using package.json data as fallback
      expect(result.size).toBe(1)
      const descriptor = result.get('opencode-plugin-config')!
      expect(descriptor.version).toBe('0.1.0')
      expect(descriptor.configSchema).toBeNull()
    })

    it('should handle filesystem errors gracefully and return empty Map', () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = discovery.discoverPlugins('/project')

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('should handle scoped packages (@org/package)', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') return true
        if (path === '/project/.opencode/node_modules') return false
        if (path.endsWith('package.json')) return true
        if (path.endsWith('plugin.json')) return true
        return false
      })

      vi.mocked(fs.readdirSync).mockImplementation((p) => {
        const path = String(p)
        if (path === '/home/testuser/.config/opencode/node_modules') {
          return ['@techdivision'] as any
        }
        if (path.endsWith('@techdivision')) {
          return ['opencode-plugin-config', 'opencode-plugin-time-tracking'] as any
        }
        return [] as any
      })

      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const path = String(p)
        if (path.includes('opencode-plugin-config') && path.endsWith('package.json')) {
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-config',
            version: '0.1.0',
            opencode: { plugin: true },
          })
        }
        if (path.includes('opencode-plugin-config') && path.endsWith('plugin.json')) {
          return JSON.stringify({ name: 'config', version: '0.1.0', configSchema: 'schemas/config.schema.json' })
        }
        if (path.includes('opencode-plugin-time-tracking') && path.endsWith('package.json')) {
          return JSON.stringify({
            name: '@techdivision/opencode-plugin-time-tracking',
            version: '1.4.0',
            opencode: { plugin: true },
          })
        }
        if (path.includes('opencode-plugin-time-tracking') && path.endsWith('plugin.json')) {
          return JSON.stringify({ name: 'time-tracking', version: '1.4.0', configSchema: null })
        }
        return '{}'
      })

      const result = discovery.discoverPlugins('/project')

      expect(result.size).toBe(2)
      expect(result.has('config')).toBe(true)
      expect(result.has('time-tracking')).toBe(true)
    })
  })

  describe('constants', () => {
    it('should export GLOBAL_PLUGIN_PATH', () => {
      expect(GLOBAL_PLUGIN_PATH).toBe('.config/opencode/node_modules')
    })

    it('should export LOCAL_PLUGIN_PATH', () => {
      expect(LOCAL_PLUGIN_PATH).toBe('.opencode/node_modules')
    })
  })
})

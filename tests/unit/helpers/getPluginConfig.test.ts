/**
 * Unit Tests for getPluginConfig helper function.
 *
 * @remarks
 * Tests that getPluginConfig correctly:
 * - Returns a specific plugin section by name
 * - Converts hyphenated plugin names to underscore section keys
 * - Returns empty object for unknown plugins
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/helpers/getProjectConfig.js', () => ({
  getProjectConfig: vi.fn(),
}))

import { getPluginConfig } from '../../../src/helpers/getPluginConfig.js'
import { getProjectConfig } from '../../../src/helpers/getProjectConfig.js'

describe('getPluginConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a specific plugin section by name', () => {
    const fullConfig = {
      jira: { project: 'COPSPA' },
      time_tracking: { csv_file: '.opencode/tt.csv' },
    }
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('time_tracking')

    expect(result).toEqual({ csv_file: '.opencode/tt.csv' })
  })

  it('should convert hyphenated plugin name to underscore section key', () => {
    const fullConfig = {
      time_tracking: { csv_file: '.opencode/tt.csv' },
    }
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('time-tracking')

    expect(result).toEqual({ csv_file: '.opencode/tt.csv' })
  })

  it('should return empty object for unknown plugin', () => {
    const fullConfig = {
      jira: { project: 'COPSPA' },
    }
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('unknown-plugin')

    expect(result).toEqual({})
  })

  it('should handle plugin names with multiple hyphens', () => {
    const fullConfig = {
      my_complex_plugin: { enabled: true },
    }
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('my-complex-plugin')

    expect(result).toEqual({ enabled: true })
  })

  it('should handle plugin names already using underscores', () => {
    const fullConfig = {
      time_tracking: { csv_file: '.opencode/tt.csv' },
    }
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('time_tracking')

    expect(result).toEqual({ csv_file: '.opencode/tt.csv' })
  })

  it('should return empty object when getProjectConfig returns empty object', () => {
    vi.mocked(getProjectConfig).mockReturnValue({})

    const result = getPluginConfig('any-plugin')

    expect(result).toEqual({})
  })

  it('should return empty object when section value is not an object', () => {
    const fullConfig = {
      simple_value: 'not-an-object' as unknown,
    } as Record<string, unknown>
    vi.mocked(getProjectConfig).mockReturnValue(fullConfig)

    const result = getPluginConfig('simple-value')

    expect(result).toEqual({})
  })
})

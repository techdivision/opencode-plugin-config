/**
 * Unit Tests for getProjectConfig helper function.
 *
 * @remarks
 * Tests the fallback chain:
 * 1. process.env.OPENCODE_PROJECT_CONFIG → parse JSON
 * 2. Local file .opencode/opencode-project.json → read and parse
 * 3. Empty object {}
 *
 * All filesystem access is mocked to isolate the unit under test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'

vi.mock('node:fs')

import { getProjectConfig } from '../../../src/helpers/getProjectConfig.js'

describe('getProjectConfig', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.OPENCODE_PROJECT_CONFIG
    delete process.env.OPENCODE_PROJECT_CONFIG
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENCODE_PROJECT_CONFIG = originalEnv
    } else {
      delete process.env.OPENCODE_PROJECT_CONFIG
    }
  })

  it('should return parsed config from process.env.OPENCODE_PROJECT_CONFIG', () => {
    const config = { jira: { project: 'COPSPA' }, time_tracking: { csv_file: '.opencode/tt.csv' } }
    process.env.OPENCODE_PROJECT_CONFIG = JSON.stringify(config)

    const result = getProjectConfig()

    expect(result).toEqual(config)
  })

  it('should fall back to local file when process.env is not set', () => {
    const localConfig = { jira: { project: 'LOCAL-PROJ' } }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(localConfig))
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const result = getProjectConfig()

    expect(result).toEqual(localConfig)
  })

  it('should return empty object when no config available', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const result = getProjectConfig()

    expect(result).toEqual({})
  })

  it('should fall back to local file when process.env contains invalid JSON', () => {
    process.env.OPENCODE_PROJECT_CONFIG = 'not-valid-json{{'
    const fallbackConfig = { jira: { project: 'FALLBACK' } }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fallbackConfig))
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const result = getProjectConfig()

    expect(result).toEqual(fallbackConfig)
  })

  it('should return empty object when process.env is invalid JSON and no local file exists', () => {
    process.env.OPENCODE_PROJECT_CONFIG = 'not-valid-json{{'
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const result = getProjectConfig()

    expect(result).toEqual({})
  })

  it('should return empty object when local file contains invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('invalid-json{{')

    const result = getProjectConfig()

    expect(result).toEqual({})
  })

  it('should return empty object when local file read throws an error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const result = getProjectConfig()

    expect(result).toEqual({})
  })
})

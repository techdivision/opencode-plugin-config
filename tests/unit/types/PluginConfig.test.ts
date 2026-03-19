/**
 * Unit Tests for PluginConfig Types (US-CFG-005)
 *
 * Tests protected fields constant and config path definitions.
 */
import { describe, it, expect } from 'vitest'
import {
  PROTECTED_FIELDS,
  GLOBAL_CONFIG_PATH,
  PROJECT_CONFIG_PATH,
  ENV_VAR_PATTERN
} from '../../../src/types/PluginConfig.js'

describe('PluginConfig Types [US-CFG-005]', () => {
  describe('PROTECTED_FIELDS', () => {
    it('should contain "$schema"', () => {
      expect(PROTECTED_FIELDS).toContain('$schema')
    })

    it('should contain "version"', () => {
      expect(PROTECTED_FIELDS).toContain('version')
    })

    it('should contain exactly 2 fields', () => {
      expect(PROTECTED_FIELDS).toHaveLength(2)
    })

    it('should be a readonly array', () => {
      // TypeScript enforces readonly at compile time
      // At runtime, we verify it's an array
      expect(Array.isArray(PROTECTED_FIELDS)).toBe(true)
    })
  })

  describe('Config Paths', () => {
    it('should define global config path', () => {
      expect(GLOBAL_CONFIG_PATH).toBe('.config/opencode/opencode-project.json')
    })

    it('should define project config path', () => {
      expect(PROJECT_CONFIG_PATH).toBe('.opencode/opencode-project.json')
    })
  })

  describe('ENV_VAR_PATTERN', () => {
    it('should match {env:VAR} pattern', () => {
      const match = '{env:MY_VAR}'.match(ENV_VAR_PATTERN)
      expect(match).not.toBeNull()
    })

    it('should capture the variable name', () => {
      const regex = new RegExp(ENV_VAR_PATTERN.source, ENV_VAR_PATTERN.flags)
      const match = regex.exec('{env:MY_VAR}')
      expect(match?.[1]).toBe('MY_VAR')
    })

    it('should not match strings without env prefix', () => {
      const match = '{MY_VAR}'.match(ENV_VAR_PATTERN)
      expect(match).toBeNull()
    })
  })
})

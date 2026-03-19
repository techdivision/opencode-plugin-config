/**
 * Acceptance Tests for US-CFG-030: ConfigMerger Deep-Merge
 *
 * Uses direct vitest describe/it because vitest-cucumber has issues
 * with special characters in step text (dots, slashes, dollar signs).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ConfigMerger } from '../../../../src/services/ConfigMerger.js'

function getNestedField(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

describe('Feature: ConfigMerger Deep-Merge [US-CFG-030]', () => {
  let merger: ConfigMerger

  beforeEach(() => {
    merger = new ConfigMerger()
  })

  describe('Scenario: Local scalar values override remote scalar values', () => {
    it('should override remote scalars with local scalars and preserve remote-only nested values', () => {
      const remote = {
        jira: {
          project: 'REMOTE-PROJ',
          base_url: 'https://remote.atlassian.net',
          workflow: { status: { open: { name: 'Open', id: '1' } } }
        }
      }
      const local = {
        jira: {
          project: 'LOCAL-PROJ',
          base_url: 'https://local.atlassian.net'
        }
      }

      const result = merger.merge(remote, local)

      expect(getNestedField(result, 'jira.project')).toBe('LOCAL-PROJ')
      expect(getNestedField(result, 'jira.base_url')).toBe('https://local.atlassian.net')
      expect(getNestedField(result, 'jira.workflow.status.open.name')).toBe('Open')
    })
  })

  describe('Scenario: Remote-only values are adopted as new defaults', () => {
    it('should adopt remote-only values while preserving local values', () => {
      const remote = {
        jira: {
          workflow: { status: { open: { name: 'Open', id: '1' } } },
          tempo: { account_field_id: 'customfield_10039' }
        }
      }
      const local = { jira: { project: 'COPSPA' } }

      const result = merger.merge(remote, local)

      expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
      expect(getNestedField(result, 'jira.workflow.status.open.id')).toBe('1')
      expect(getNestedField(result, 'jira.tempo.account_field_id')).toBe('customfield_10039')
    })
  })

  describe('Scenario: Local arrays replace remote arrays completely', () => {
    it('should replace remote array with local array (no concatenation)', () => {
      const remote = { time_tracking: { valid_projects: ['PROJ-A', 'PROJ-B', 'PROJ-C'] } }
      const local = { time_tracking: { valid_projects: ['COPSPA'] } }

      const result = merger.merge(remote, local)

      const arr = getNestedField(result, 'time_tracking.valid_projects') as unknown[]
      expect(arr).toHaveLength(1)
      expect(arr).toContain('COPSPA')
      expect(arr).not.toContain('PROJ-A')
    })
  })

  describe('Scenario: Protected fields are removed from remote config before merge', () => {
    it('should preserve local protected fields by removing them from remote', () => {
      const remote = {
        $schema: 'https://remote-schema-url',
        version: '0.1.0',
        jira: { project: 'COPSPA' }
      }
      const local = {
        $schema: 'https://local-schema-url',
        version: '1.0.0',
        jira: { base_url: 'https://local.atlassian.net' }
      }

      const result = merger.mergeWithProtectedFields(remote, local, ['$schema', 'version'])

      expect(result.$schema).toBe('https://local-schema-url')
      expect(result.version).toBe('1.0.0')
      expect(getNestedField(result, 'jira.project')).toBe('COPSPA')
      expect(getNestedField(result, 'jira.base_url')).toBe('https://local.atlassian.net')
    })
  })

  describe('Scenario: Deep nested objects are merged recursively', () => {
    it('should recursively merge nested objects with local precedence', () => {
      const remote = {
        time_tracking: {
          pricing: {
            ratio: { input: 0.8, output: 0.2 },
            default: { input: 3, output: 15 },
            periods: [{ from: '2025-11-01', models: {} }]
          }
        }
      }
      const local = {
        time_tracking: {
          pricing: {
            ratio: { input: 0.9, output: 0.1 }
          }
        }
      }

      const result = merger.merge(remote, local)

      expect(getNestedField(result, 'time_tracking.pricing.ratio.input')).toBe(0.9)
      expect(getNestedField(result, 'time_tracking.pricing.ratio.output')).toBe(0.1)
      expect(getNestedField(result, 'time_tracking.pricing.default.input')).toBe(3)
      const periods = getNestedField(result, 'time_tracking.pricing.periods') as unknown[]
      expect(periods).toHaveLength(1)
    })
  })

  describe('Scenario: Empty remote config results in local config unchanged', () => {
    it('should return local config unchanged when remote is empty', () => {
      const remote = {}
      const local = {
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: '.opencode/tt.csv' }
      }

      const result = merger.merge(remote, local)

      expect(result).toEqual(local)
    })
  })
})

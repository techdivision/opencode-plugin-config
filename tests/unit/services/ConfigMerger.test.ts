/**
 * Unit Tests for ConfigMerger (US-CFG-030)
 *
 * Tests the central deep-merge service with local-precedence semantics.
 */
import { describe, it, expect } from 'vitest'
import { ConfigMerger } from '../../../src/services/ConfigMerger.js'

describe('ConfigMerger', () => {
  const merger = new ConfigMerger()

  describe('merge()', () => {
    it('should override base scalar values with override scalar values', () => {
      const base = { jira: { project: 'REMOTE-PROJ', base_url: 'https://remote.atlassian.net' } }
      const override = { jira: { project: 'LOCAL-PROJ', base_url: 'https://local.atlassian.net' } }

      const result = merger.merge(base, override)

      expect(result.jira).toEqual({
        project: 'LOCAL-PROJ',
        base_url: 'https://local.atlassian.net'
      })
    })

    it('should adopt remote-only values as new defaults', () => {
      const base = {
        jira: {
          workflow: { status: { open: { name: 'Open', id: '1' } } },
          tempo: { account_field_id: 'customfield_10039' }
        }
      }
      const override = { jira: { project: 'COPSPA' } }

      const result = merger.merge(base, override) as any

      expect(result.jira.project).toBe('COPSPA')
      expect(result.jira.workflow.status.open.id).toBe('1')
      expect(result.jira.tempo.account_field_id).toBe('customfield_10039')
    })

    it('should replace base arrays with override arrays completely (no concatenation)', () => {
      const base = { time_tracking: { valid_projects: ['PROJ-A', 'PROJ-B', 'PROJ-C'] } }
      const override = { time_tracking: { valid_projects: ['COPSPA'] } }

      const result = merger.merge(base, override) as any

      expect(result.time_tracking.valid_projects).toEqual(['COPSPA'])
      expect(result.time_tracking.valid_projects).not.toContain('PROJ-A')
    })

    it('should deep-merge nested objects recursively', () => {
      const base = {
        time_tracking: {
          pricing: {
            ratio: { input: 0.8, output: 0.2 },
            default: { input: 3, output: 15 },
            periods: [{ from: '2025-11-01', models: {} }]
          }
        }
      }
      const override = {
        time_tracking: {
          pricing: {
            ratio: { input: 0.9, output: 0.1 }
          }
        }
      }

      const result = merger.merge(base, override) as any

      expect(result.time_tracking.pricing.ratio.input).toBe(0.9)
      expect(result.time_tracking.pricing.ratio.output).toBe(0.1)
      expect(result.time_tracking.pricing.default.input).toBe(3)
      expect(result.time_tracking.pricing.periods).toHaveLength(1)
    })

    it('should return override unchanged when base is empty', () => {
      const base = {}
      const override = {
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: '.opencode/tt.csv' }
      }

      const result = merger.merge(base, override)

      expect(result).toEqual(override)
    })

    it('should return base unchanged when override is empty', () => {
      const base = {
        jira: { project: 'COPSPA' },
        time_tracking: { csv_file: '.opencode/tt.csv' }
      }
      const override = {}

      const result = merger.merge(base, override)

      expect(result).toEqual(base)
    })

    it('should return empty object when both are empty', () => {
      const result = merger.merge({}, {})
      expect(result).toEqual({})
    })
  })

  describe('mergeWithProtectedFields()', () => {
    it('should remove protected fields from base before merge', () => {
      const base = {
        $schema: 'https://remote-schema-url',
        version: '0.1.0',
        jira: { project: 'COPSPA' }
      }
      const override = {
        $schema: 'https://local-schema-url',
        version: '1.0.0',
        jira: { base_url: 'https://local.atlassian.net' }
      }

      const result = merger.mergeWithProtectedFields(base, override, ['$schema', 'version'])

      expect(result.$schema).toBe('https://local-schema-url')
      expect(result.version).toBe('1.0.0')
      expect((result.jira as any).project).toBe('COPSPA')
      expect((result.jira as any).base_url).toBe('https://local.atlassian.net')
    })

    it('should preserve override protected fields when base has different values', () => {
      const base = { $schema: 'remote-schema', version: '0.5.0', data: 'remote' }
      const override = { $schema: 'local-schema', version: '1.0.0', data: 'local' }

      const result = merger.mergeWithProtectedFields(base, override, ['$schema', 'version'])

      expect(result.$schema).toBe('local-schema')
      expect(result.version).toBe('1.0.0')
      expect(result.data).toBe('local')
    })

    it('should not modify the original base object', () => {
      const base = { $schema: 'remote', version: '1.0', key: 'value' }
      const override = { $schema: 'local', version: '2.0' }

      merger.mergeWithProtectedFields(base, override, ['$schema', 'version'])

      expect(base.$schema).toBe('remote')
      expect(base.version).toBe('1.0')
    })
  })
})

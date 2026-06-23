// Acceptance Tests for US-CFG-007: Repo-Scaffolding
// Verifies that all required files and directories exist with correct content.
// Using direct vitest because the feature file contains glob patterns that
// vitest-cucumber cannot handle in step matching.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('.')

function getNestedField(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

describe('Feature: Repository Initialization and Project Scaffolding', () => {
  describe('Scenario: package.json exists with correct fields', () => {
    const filePath = path.join(ROOT, 'package.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(content) as Record<string, unknown>

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should have name "@techdivision/opencode-plugin-config"', () => {
      expect(json.name).toBe('@techdivision/opencode-plugin-config')
    })

    it('should have type "module"', () => {
      expect(json.type).toBe('module')
    })

    it('should have main "src/config.ts"', () => {
      expect(json.main).toBe('src/config.ts')
    })

    it('should have opencode.plugin = true', () => {
      expect(getNestedField(json, 'opencode.plugin')).toBe(true)
    })

    it('should have @opencode-ai/plugin dependency', () => {
      expect(json.dependencies).toHaveProperty('@opencode-ai/plugin')
    })

    it('should depend on the shared config-sync library', () => {
      expect(json.dependencies).toHaveProperty('@techdivision/lib-ts-config-sync')
    })

    it('should have @types/bun devDependency', () => {
      expect(json.devDependencies).toHaveProperty('@types/bun')
    })

    it('should have @types/node devDependency', () => {
      expect(json.devDependencies).toHaveProperty('@types/node')
    })

    it('should have typescript devDependency', () => {
      expect(json.devDependencies).toHaveProperty('typescript')
    })

    it('should have vitest devDependency', () => {
      expect(json.devDependencies).toHaveProperty('vitest')
    })

    it('should have vitest-cucumber devDependency', () => {
      expect(json.devDependencies).toHaveProperty('@amiceli/vitest-cucumber')
    })
  })

  describe('Scenario: plugin.json exists with correct metadata', () => {
    const filePath = path.join(ROOT, 'plugin.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(content) as Record<string, unknown>

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should have name "config"', () => {
      expect(json.name).toBe('config')
    })

    it('should have category "optional"', () => {
      expect(json.category).toBe('optional')
    })

    it('should have version "0.1.0"', () => {
      expect(json.version).toBe('0.1.0')
    })

    it('should have configSchema "schemas/config.schema.json"', () => {
      expect(json.configSchema).toBe('schemas/config.schema.json')
    })
  })

  describe('Scenario: tsconfig.json exists with correct compiler options', () => {
    const filePath = path.join(ROOT, 'tsconfig.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(content) as Record<string, unknown>

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should have compilerOptions.strict = true', () => {
      expect(getNestedField(json, 'compilerOptions.strict')).toBe(true)
    })

    it('should have compilerOptions.module = "ESNext"', () => {
      expect(getNestedField(json, 'compilerOptions.module')).toBe('ESNext')
    })

    it('should have compilerOptions.target = "ESNext"', () => {
      expect(getNestedField(json, 'compilerOptions.target')).toBe('ESNext')
    })

    it('should have compilerOptions.noEmit = true', () => {
      expect(getNestedField(json, 'compilerOptions.noEmit')).toBe(true)
    })

    it('should NOT have experimentalDecorators', () => {
      const compilerOptions = json.compilerOptions as Record<string, unknown>
      expect(compilerOptions).not.toHaveProperty('experimentalDecorators')
    })
  })

  describe('Scenario: vitest.config.ts exists with test configuration', () => {
    const filePath = path.join(ROOT, 'vitest.config.ts')
    const content = fs.readFileSync(filePath, 'utf-8')

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should include unit test pattern', () => {
      expect(content).toContain('tests/unit/**/*.test.ts')
    })

    it('should include integration test pattern', () => {
      expect(content).toContain('tests/integration/**/*.test.ts')
    })
  })

  describe('Scenario: .gitignore exists with required excludes', () => {
    const filePath = path.join(ROOT, '.gitignore')
    const content = fs.readFileSync(filePath, 'utf-8')

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should contain node_modules/', () => {
      expect(content).toContain('node_modules/')
    })

    it('should contain tmp/', () => {
      expect(content).toContain('tmp/')
    })

    it('should contain .env', () => {
      expect(content).toContain('.env')
    })
  })

  describe('Scenario: .env.example exists with required variables', () => {
    const filePath = path.join(ROOT, '.env.example')
    const content = fs.readFileSync(filePath, 'utf-8')

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should contain OC_CONFIG_SYNC_URL', () => {
      expect(content).toContain('OC_CONFIG_SYNC_URL')
    })

    it('should contain OC_CONFIG_SYNC_TOKEN', () => {
      expect(content).toContain('OC_CONFIG_SYNC_TOKEN')
    })

    it('should contain OPENCODE_USER_EMAIL', () => {
      expect(content).toContain('OPENCODE_USER_EMAIL')
    })
  })

  describe('Scenario: Config schema file exists', () => {
    const filePath = path.join(ROOT, 'schemas/config.schema.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(content) as Record<string, unknown>

    it('should exist', () => {
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('should be valid JSON', () => {
      expect(() => JSON.parse(content)).not.toThrow()
    })

    it('should have $schema containing json-schema.org', () => {
      expect(json.$schema).toContain('json-schema.org')
    })

    it('should have type "object"', () => {
      expect(json.type).toBe('object')
    })
  })

  describe('Scenario: Directory structure is complete', () => {
    const dirs = [
      'src/utils',
      'tests/acceptance',
      'tests/acceptance/gherkin',
      'schemas'
    ]

    for (const dir of dirs) {
      it(`should have directory "${dir}"`, () => {
        expect(fs.existsSync(path.join(ROOT, dir))).toBe(true)
      })
    }
  })
})

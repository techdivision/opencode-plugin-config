/**
 * Acceptance Tests for US-CFG-034: config-usage Skill Documentation
 *
 * Tests that the config-usage SKILL.md exists at the correct location
 * and documents the process.env usage pattern, helper function signatures,
 * and the 3-layer config cascade with merge rules.
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 *
 * @see us-cfg-034-config-usage-skill.feature
 * @see skills/config/config-usage/SKILL.md - The documented skill file
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-04/us-cfg-034-config-usage-skill.feature',
)

describeFeature(feature, ({ Scenario }) => {
  const skillPath = 'skills/config/config-usage/SKILL.md'
  let skillContent: string

  /**
   * Helper: load the SKILL.md content from disk.
   */
  function loadSkillContent(): void {
    const absolutePath = path.resolve(process.cwd(), skillPath)
    skillContent = fs.readFileSync(absolutePath, 'utf-8')
  }

  // --- Scenario 1: Skill file exists at correct location ---

  Scenario('Skill file exists at correct location', ({ Given, When, Then }) => {
    Given('the config plugin is installed', () => {
      // The config plugin is the current project — always installed
      expect(fs.existsSync('package.json')).toBe(true)
    })

    When('I look for the config-usage skill', () => {
      // Attempt to locate the skill file
    })

    Then('a file exists at "skills/config/config-usage/SKILL.md"', () => {
      const absolutePath = path.resolve(process.cwd(), skillPath)
      expect(fs.existsSync(absolutePath)).toBe(true)
    })
  })

  // --- Scenario 2: Skill documents process.env usage pattern ---

  Scenario('Skill documents process.env usage pattern', ({ Given, When, Then, And }) => {
    Given('the config-usage SKILL.md is loaded', () => {
      loadSkillContent()
    })

    When('I read the documentation', () => {
      expect(skillContent.length).toBeGreaterThan(0)
    })

    Then('it explains how to read process.env.OPENCODE_PROJECT_CONFIG', () => {
      expect(skillContent).toContain('process.env.OPENCODE_PROJECT_CONFIG')
    })

    And('it shows a JSON.parse example', () => {
      expect(skillContent).toContain('JSON.parse')
    })

    And('it explains the fallback to the local file', () => {
      expect(skillContent).toContain('.opencode/opencode-project.json')
    })
  })

  // --- Scenario 3: Skill documents getProjectConfig helper ---

  Scenario('Skill documents getProjectConfig helper', ({ Given, When, Then, And }) => {
    Given('the config-usage SKILL.md is loaded', () => {
      loadSkillContent()
    })

    When('I read the documentation', () => {
      expect(skillContent.length).toBeGreaterThan(0)
    })

    Then('it documents the getProjectConfig() function signature', () => {
      expect(skillContent).toContain('getProjectConfig()')
    })

    And('it documents the getPluginConfig(name) function signature', () => {
      expect(skillContent).toContain('getPluginConfig(')
    })

    And('it shows import examples from "@techdivision/opencode-plugin-config"', () => {
      expect(skillContent).toContain('@techdivision/opencode-plugin-config')
    })
  })

  // --- Scenario 4: Skill documents the config cascade and merge order ---

  Scenario(
    'Skill documents the config cascade and merge order',
    ({ Given, When, Then, And }) => {
      Given('the config-usage SKILL.md is loaded', () => {
        loadSkillContent()
      })

      When('I read the documentation', () => {
        expect(skillContent.length).toBeGreaterThan(0)
      })

      Then('it explains the 3-layer config cascade (Global, Project, Remote)', () => {
        expect(skillContent).toContain('Global')
        expect(skillContent).toContain('Project')
        expect(skillContent).toContain('Remote')
      })

      And('it explains that local values always win over remote values', () => {
        expect(skillContent).toMatch(/local.*win|local.*override|local.*precedence/i)
      })

      And('it explains that arrays are replaced, not concatenated', () => {
        expect(skillContent).toMatch(/array.*replace|array.*overwrite/i)
      })
    },
  )
})

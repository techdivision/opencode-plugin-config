Feature: config-usage Skill Documentation
  As a Plugin Developer
  I want to read the config-usage skill documentation
  So that I know how to access the merged project config from my plugin

  Scenario: Skill file exists at correct location
    Given the config plugin is installed
    When I look for the config-usage skill
    Then a file exists at "skills/config/config-usage/SKILL.md"

  Scenario: Skill documents process.env usage pattern
    Given the config-usage SKILL.md is loaded
    When I read the documentation
    Then it explains how to read process.env.OPENCODE_PROJECT_CONFIG
    And it shows a JSON.parse example
    And it explains the fallback to the local file

  Scenario: Skill documents getProjectConfig helper
    Given the config-usage SKILL.md is loaded
    When I read the documentation
    Then it documents the getProjectConfig() function signature
    And it documents the getPluginConfig(name) function signature
    And it shows import examples from "@techdivision/opencode-plugin-config"

  Scenario: Skill documents the config cascade and merge order
    Given the config-usage SKILL.md is loaded
    When I read the documentation
    Then it explains the 3-layer config cascade (Global, Project, Remote)
    And it explains that local values always win over remote values
    And it explains that arrays are replaced, not concatenated

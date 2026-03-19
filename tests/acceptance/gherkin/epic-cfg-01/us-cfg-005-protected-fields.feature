Feature: Protected Fields ($schema, version)
  As a System (ConfigLoader)
  I want $schema and version to be protected from merge overwrites
  So that local config integrity is guaranteed

  Scenario: $schema field from project config is preserved during merge
    Given the global config contains:
      """
      {
        "$schema": "./schemas/opencode-project.schema.json",
        "time_tracking": { "csv_file": "global.csv" }
      }
      """
    And the project config contains:
      """
      {
        "$schema": "./schemas/opencode-project.schema.json",
        "time_tracking": { "csv_file": "project.csv" }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "$schema" equals "./schemas/opencode-project.schema.json"

  Scenario: version field from project config is preserved during merge
    Given the global config contains:
      """
      {
        "version": "1.0.0"
      }
      """
    And the project config contains:
      """
      {
        "version": "2.0.0",
        "jira": { "project": "COPSPA" }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "version" equals "2.0.0"
    And the project version takes precedence

  Scenario: Protected fields are defined as immutable in TypeScript types
    Given the PluginConfig TypeScript types are defined
    When I inspect the protected fields constant
    Then it contains "$schema"
    And it contains "version"
    And these fields are documented as never overwritten by remote config

  Scenario: Protected fields survive the full merge cascade
    Given the global config contains:
      """
      {
        "$schema": "./schemas/opencode-project.schema.json",
        "version": "1.0.0",
        "time_tracking": { "csv_file": "global.csv" }
      }
      """
    And the project config contains:
      """
      {
        "time_tracking": { "csv_file": "project.csv" }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "$schema" equals "./schemas/opencode-project.schema.json"
    And the merged config "version" equals "1.0.0"
    And the merged config "time_tracking.csv_file" equals "project.csv"

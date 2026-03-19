Feature: Plugin Schema Resolution
  As a System (SchemaValidator)
  I want to resolve JSON schema files from PluginDescriptor metadata
  So that each section can be validated against its plugin's schema

  Background:
    Given the SchemaValidator service is initialized

  Scenario: Resolve schema from PluginDescriptor with configSchema
    Given a PluginDescriptor with the following properties:
      | pluginName   | time-tracking                          |
      | rootDir      | /path/to/opencode-plugin-time-tracking |
      | configSchema | schemas/config.schema.json             |
    When the schema is resolved for this plugin
    Then the schema path is "/path/to/opencode-plugin-time-tracking/schemas/config.schema.json"
    And the section key is "time_tracking"

  Scenario: Derive section key from plugin name with hyphens
    Given a PluginDescriptor with pluginName "time-tracking"
    When the section key is derived
    Then the section key is "time_tracking"

  Scenario: Derive section key from plugin name without hyphens
    Given a PluginDescriptor with pluginName "marp"
    When the section key is derived
    Then the section key is "marp"

  Scenario: Skip plugin without configSchema
    Given a PluginDescriptor with the following properties:
      | pluginName   | shell-env |
      | rootDir      | /path/to  |
      | configSchema | null      |
    When the schema is resolved for this plugin
    Then no schema is returned
    And no error is raised

  Scenario: Schema file does not exist on disk
    Given a PluginDescriptor with the following properties:
      | pluginName   | time-tracking                          |
      | rootDir      | /path/to/opencode-plugin-time-tracking |
      | configSchema | schemas/config.schema.json             |
    And the schema file does not exist at the resolved path
    When the schema is resolved for this plugin
    Then a warning is logged containing "schema file not found"
    And the section is treated as having no schema

  Scenario: Schema file contains invalid JSON
    Given a PluginDescriptor with the following properties:
      | pluginName   | time-tracking                          |
      | rootDir      | /path/to/opencode-plugin-time-tracking |
      | configSchema | schemas/config.schema.json             |
    And the schema file contains invalid JSON
    When the schema is resolved for this plugin
    Then a warning is logged containing "invalid schema JSON"
    And the section is treated as having no schema

  Scenario: Build schema map from multiple plugins
    Given the following PluginDescriptors are discovered:
      | pluginName    | configSchema               |
      | time-tracking | schemas/config.schema.json |
      | config        | schemas/config.schema.json |
      | shell-env     | null                       |
    When the schema map is built
    Then the map contains 2 entries
    And the map contains key "time_tracking"
    And the map contains key "config"
    And the map does not contain key "shell_env"

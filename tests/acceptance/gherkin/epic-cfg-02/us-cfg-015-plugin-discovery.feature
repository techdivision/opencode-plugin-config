Feature: Plugin Discovery via discoverPlugins()
  As a System (Entry Point)
  I want to call discoverPlugins() in the entry point and pass results to services
  So that both ConfigSyncer and SchemaValidator use the same discovery data

  Background:
    Given the project directory contains installed plugins

  Scenario: Discover plugins and extract names for payload
    Given discoverPlugins() returns a Map with entries:
      | pluginName     | version | configSchema               |
      | config         | 0.2.0   | schemas/config.schema.json |
      | time-tracking  | 1.4.0   | schemas/config.schema.json |
      | jira           | 2.0.0   | null                       |
      | shell-env      | 1.2.0   | null                       |
    When the entry point extracts plugin names
    Then the plugins list contains "config", "time-tracking", "jira", "shell-env"

  Scenario: Extract own plugin version from discovery result
    Given discoverPlugins() returns a Map with entry "config" having version "0.2.0"
    When the entry point reads its own plugin version
    Then the plugin_version is "0.2.0"

  Scenario: Own discovery implementation without external dependency
    Given the entry point imports PluginDiscovery
    Then the import source is "src/utils/PluginDiscovery"
    And no dependency on opencode-cli is required

  Scenario: Discovery returns empty map when no plugins are installed
    Given discoverPlugins() returns an empty Map
    When the entry point extracts plugin names
    Then the plugins list is an empty array
    And the entry point still proceeds with empty defaults

  Scenario: Discovery failure is handled gracefully
    Given discoverPlugins() throws an error
    When the entry point attempts to discover plugins
    Then the entry point uses empty defaults
    And a warning is logged about the discovery failure

Feature: Plugin Discovery via discoverPlugins()
  As a System (ConfigSyncer)
  I want to discover all installed plugins using discoverPlugins() from opencode-cli
  So that the webhook receives the complete list of plugin names

  Background:
    Given the project directory contains installed plugins

  Scenario: Discover plugins and extract names for payload
    Given discoverPlugins() returns a Map with entries:
      | pluginName     | version | configSchema               |
      | config         | 0.2.0   | schemas/config.schema.json |
      | time-tracking  | 1.4.0   | schemas/config.schema.json |
      | jira           | 2.0.0   | null                       |
      | shell-env      | 1.2.0   | null                       |
    When the ConfigSyncer extracts plugin names
    Then the plugins list is ["config", "time-tracking", "jira", "shell-env"]

  Scenario: Extract own plugin version from discovery result
    Given discoverPlugins() returns a Map with entry "config" having version "0.2.0"
    When the ConfigSyncer reads its own plugin version
    Then the plugin_version is "0.2.0"

  Scenario: Import path uses @techdivision/opencode-cli/discovery
    Given the ConfigSyncer imports discoverPlugins
    Then the import source is "@techdivision/opencode-cli/discovery"
    And no custom discovery logic is implemented

  Scenario: Discovery returns empty map when no plugins are installed
    Given discoverPlugins() returns an empty Map
    When the ConfigSyncer extracts plugin names
    Then the plugins list is an empty array
    And the ConfigSyncer still proceeds with the webhook call

  Scenario: Discovery failure is handled gracefully
    Given discoverPlugins() throws an error
    When the ConfigSyncer attempts to discover plugins
    Then the ConfigSyncer returns null
    And a warning is logged containing "discovery" or "plugins"

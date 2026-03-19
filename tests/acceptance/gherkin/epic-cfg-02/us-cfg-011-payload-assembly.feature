Feature: Webhook Payload Assembly
  As a System (ConfigSyncer)
  I want to assemble the webhook payload from local sources
  So that the n8n webhook receives all information needed to build the remote config

  Background:
    Given the ConfigSyncer service is instantiated
    And discoverPlugins() returns plugins "config", "time-tracking", "jira"
    And the own PluginDescriptor has version "0.2.0"
    And process.env.OPENCODE_USER_EMAIL is set to "t.wagner@techdivision.com"
    And the local config contains:
      """json
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "csv_file": "tracking.csv" }
      }
      """

  Scenario: Payload contains plugin_version from own PluginDescriptor
    When the ConfigSyncer assembles the webhook payload
    Then the payload field "plugin_version" is "0.2.0"

  Scenario: Payload contains email from process.env
    When the ConfigSyncer assembles the webhook payload
    Then the payload field "email" is "t.wagner@techdivision.com"

  Scenario: Payload contains plugin names from discoverPlugins()
    When the ConfigSyncer assembles the webhook payload
    Then the payload field "plugins" is an array containing "config", "time-tracking", "jira"

  Scenario: Payload contains the entire local config as seed
    When the ConfigSyncer assembles the webhook payload
    Then the payload field "config" is an object
    And the payload "config.jira.project" is "COPSPA"
    And the payload "config.time_tracking.csv_file" is "tracking.csv"

  Scenario: Payload is valid JSON with correct Content-Type
    When the ConfigSyncer assembles the webhook payload
    Then the payload is serializable as valid JSON
    And the Content-Type header is "application/json"

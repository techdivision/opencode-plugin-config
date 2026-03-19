Feature: Plugin Entry Point Orchestration
  As a System (config.ts Entry Point)
  I want to orchestrate all config services in the correct order
  So that the final merged config is consistently produced on every plugin start

  Background:
    Given the config plugin entry point "config.ts" is loaded

  Scenario: Full orchestration with all services succeeding
    Given the ConfigLoader returns a valid local config
    And the ConfigSyncer returns a valid webhook response
    And the SchemaValidator validates all sections successfully
    And the ConfigMerger is ready to merge
    When the plugin entry point executes
    Then the ConfigLoader is called first to load the local config cascade
    And the ConfigSyncer is called second with the local config as seed
    And the SchemaValidator is called third to validate the webhook response sections
    And the ConfigMerger is called fourth to deep-merge remote and local configs
    And the final config is written to process.env.OPENCODE_PROJECT_CONFIG
    And the plugin returns an empty object {}

  Scenario: Orchestration continues when webhook fails
    Given the ConfigLoader returns a valid local config
    And the ConfigSyncer returns an error (webhook unreachable)
    When the plugin entry point executes
    Then the ConfigLoader is called to load the local config cascade
    And the ConfigSyncer is called and its error is caught
    And the SchemaValidator is not called
    And the ConfigMerger is not called for remote merge
    And the local config is written to process.env.OPENCODE_PROJECT_CONFIG
    And the plugin returns an empty object {}
    And a warning is logged about the webhook failure

  Scenario: Orchestration continues when no sync_url is configured
    Given the ConfigLoader returns a local config without "config.sync_url"
    When the plugin entry point executes
    Then the ConfigLoader is called to load the local config cascade
    And the ConfigSyncer is skipped
    And the local config is written to process.env.OPENCODE_PROJECT_CONFIG
    And the plugin returns an empty object {}

  Scenario: Orchestration handles partial validation failures
    Given the ConfigLoader returns a valid local config
    And the ConfigSyncer returns a response with sections "jira" and "time_tracking"
    And the SchemaValidator rejects the "time_tracking" section
    And the SchemaValidator accepts the "jira" section
    When the plugin entry point executes
    Then only the valid "jira" section is passed to the ConfigMerger
    And the "time_tracking" section from the webhook is excluded from the merge
    And a warning is logged about the rejected "time_tracking" section
    And the final config is written to process.env.OPENCODE_PROJECT_CONFIG

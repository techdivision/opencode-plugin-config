Feature: Fallback When No Webhook Available
  As a System (config plugin)
  I want to write only the local config to process.env when no webhook is available
  So that downstream plugins always have a config available regardless of webhook status

  Scenario: No sync_url configured - local config is used
    Given a local config exists:
      """
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "csv_file": ".opencode/tt.csv" }
      }
      """
    And the local config does not contain "config.sync_url"
    And process.env.OC_CONFIG_SYNC_URL is not set
    When the config plugin initializes
    Then the webhook call is skipped
    And process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON
    And no error is thrown

  Scenario: Webhook returns HTTP error - local config is used
    Given a local config exists with "config.sync_url" set
    And the webhook returns HTTP 500
    When the config plugin initializes
    Then a warning is logged about the webhook error
    And process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON
    And the plugin continues without failing

  Scenario: Webhook times out - local config is used
    Given a local config exists with "config.sync_url" set
    And the webhook does not respond within 5 seconds
    When the config plugin initializes
    Then a warning is logged about the timeout
    And process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON

  Scenario: OPENCODE_USER_EMAIL not set - webhook is skipped
    Given a local config exists with "config.sync_url" set
    And process.env.OPENCODE_USER_EMAIL is not set
    When the config plugin initializes
    Then the webhook call is skipped
    And process.env.OPENCODE_PROJECT_CONFIG contains the local config as JSON

  Scenario: No local config and no webhook - empty config is provided
    Given no local config file exists
    And no sync_url is configured
    When the config plugin initializes
    Then process.env.OPENCODE_PROJECT_CONFIG is set to "{}"
    And downstream plugins receive an empty config object

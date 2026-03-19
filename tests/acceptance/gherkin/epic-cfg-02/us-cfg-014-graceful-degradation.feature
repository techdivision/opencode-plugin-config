Feature: Graceful Degradation for Webhook Errors
  As a System (ConfigSyncer)
  I want to gracefully handle all webhook error scenarios
  So that the plugin never blocks and the local config always remains available

  Scenario: Missing sync_url - webhook is skipped
    Given no sync_url is configured
    And no OC_CONFIG_SYNC_URL is set in process.env
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "sync_url"
    And no HTTP request is made

  Scenario: Missing OPENCODE_USER_EMAIL - webhook is skipped
    Given the sync_url is configured
    And process.env.OPENCODE_USER_EMAIL is not set
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "OPENCODE_USER_EMAIL"
    And no HTTP request is made

  Scenario: Webhook returns HTTP 404
    Given the sync_url is configured
    And the webhook responds with status 404
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "404"

  Scenario: Webhook returns HTTP 500
    Given the sync_url is configured
    And the webhook responds with status 500
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "500"

  Scenario: Webhook is unreachable (network error)
    Given the sync_url is configured
    And the webhook is not reachable due to a network error
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "network" or "fetch"

  Scenario: Webhook response is not valid JSON
    Given the sync_url is configured
    And the webhook responds with status 200 and body "not-json"
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "JSON" or "parse"

  Scenario: Webhook response is missing version field
    Given the sync_url is configured
    And the webhook responds with status 200 and body '{"config": {}}'
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "version"

  Scenario: Version incompatibility triggers graceful degradation
    Given the sync_url is configured
    And the plugin_version is "0.2.0"
    And the webhook responds with version "0.3.0"
    When the ConfigSyncer attempts to sync
    Then the ConfigSyncer returns null
    And a warning is logged containing "version"

  Scenario: No exceptions are thrown in any error case
    Given the sync_url is configured
    And the webhook responds with status 500
    When the ConfigSyncer attempts to sync
    Then no exception is thrown
    And the ConfigSyncer returns null

  Scenario: All errors are logged as warnings, not errors
    Given the sync_url is configured
    And the webhook responds with status 503
    When the ConfigSyncer attempts to sync
    Then the log level used is "warning" and not "error"

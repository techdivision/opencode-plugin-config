Feature: Version Compatibility Check
  As a System (ConfigSyncer)
  I want to verify that the webhook response is compatible with my plugin version
  So that an older plugin does not accept config generated for a newer version

  Background:
    Given the ConfigSyncer has plugin_version "0.2.0"
    And the webhook returns a valid HTTP 200 response

  Scenario: Accept response when response.version equals plugin_version
    Given the webhook response contains version "0.2.0"
    When the ConfigSyncer checks version compatibility
    Then the response is accepted
    And the SyncResponse config is returned

  Scenario: Accept response when response.version is lower than plugin_version
    Given the webhook response contains version "0.1.0"
    When the ConfigSyncer checks version compatibility
    Then the response is accepted
    And the SyncResponse config is returned

  Scenario: Reject response when response.version is higher than plugin_version
    Given the webhook response contains version "0.3.0"
    When the ConfigSyncer checks version compatibility
    Then the response is rejected
    And the ConfigSyncer returns null
    And a warning is logged containing "neuere Plugin-Version" or "please update"

  Scenario: Semver comparison handles pre-release versions correctly
    Given the ConfigSyncer has plugin_version "1.0.0"
    And the webhook response contains version "1.0.1-beta.1"
    When the ConfigSyncer checks version compatibility
    Then the response is rejected
    And the ConfigSyncer returns null

  Scenario Outline: Version compatibility matrix
    Given the ConfigSyncer has plugin_version "<plugin_version>"
    And the webhook response contains version "<response_version>"
    When the ConfigSyncer checks version compatibility
    Then the result is "<result>"

    Examples:
      | plugin_version | response_version | result   |
      | 0.2.0          | 0.1.0            | accepted |
      | 0.2.0          | 0.2.0            | accepted |
      | 0.2.0          | 0.2.1            | rejected |
      | 0.2.0          | 0.3.0            | rejected |
      | 1.0.0          | 0.9.9            | accepted |
      | 1.0.0          | 1.0.0            | accepted |
      | 1.0.0          | 1.0.1            | rejected |

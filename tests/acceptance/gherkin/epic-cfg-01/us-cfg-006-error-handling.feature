Feature: Error Handling for Config Files
  As a System (ConfigLoader)
  I want graceful error handling when config files are problematic
  So that the plugin never crashes and always provides a usable config

  Scenario: Config file contains invalid JSON
    Given a config file exists with content:
      """
      { invalid json content, missing quotes
      """
    When the ConfigLoader reads this config file
    Then the result is an empty object {}
    And a warning is logged with message containing "invalid JSON"
    And no error is thrown

  Scenario: Config file is completely empty
    Given a config file exists with empty content ""
    When the ConfigLoader reads this config file
    Then the result is an empty object {}
    And no error is thrown

  Scenario: Config file contains valid JSON but is not an object
    Given a config file exists with content:
      """
      ["this", "is", "an", "array"]
      """
    When the ConfigLoader reads this config file
    Then the result is an empty object {}
    And a warning is logged with message containing "not a JSON object"

  Scenario: Config file has no read permissions
    Given a config file exists but has no read permissions
    When the ConfigLoader reads this config file
    Then the result is an empty object {}
    And a warning is logged with message containing "permission" or "access"
    And no error is thrown

  Scenario: Both config files are missing - empty fallback
    Given no global config file exists
    And no project config file exists
    When the ConfigLoader loads the local config cascade
    Then the result is an empty object {}
    And no error is thrown
    And the plugin continues without interruption

  Scenario: Global config invalid, project config valid
    Given the global config file contains invalid JSON
    And the project config file contains valid JSON:
      """
      {
        "jira": {
          "project": "COPSPA"
        }
      }
      """
    When the ConfigLoader loads the local config cascade
    Then the merged config contains "jira.project" with value "COPSPA"
    And a warning is logged for the global config file
    And the project config is used as the sole source

  Scenario: Global config valid, project config invalid
    Given the global config file contains valid JSON:
      """
      {
        "time_tracking": {
          "pricing": { "default": { "input": 3, "output": 15 } }
        }
      }
      """
    And the project config file contains invalid JSON
    When the ConfigLoader loads the local config cascade
    Then the merged config contains "time_tracking.pricing.default.input" with value 3
    And a warning is logged for the project config file
    And the global config is used as the sole source

Feature: Consumer Helper Functions getProjectConfig and getPluginConfig
  As a Plugin Developer
  I want to use getProjectConfig() and getPluginConfig(name) helper functions
  So that I can reliably access the merged config without implementing fallback logic myself

  Scenario: getProjectConfig returns parsed config from process.env
    Given process.env.OPENCODE_PROJECT_CONFIG is set to:
      """
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "csv_file": ".opencode/tt.csv" }
      }
      """
    When I call getProjectConfig()
    Then I receive an object with keys "jira" and "time_tracking"
    And the "jira.project" value is "COPSPA"

  Scenario: getProjectConfig falls back to local file when process.env is not set
    Given process.env.OPENCODE_PROJECT_CONFIG is not set
    And a local file ".opencode/opencode-project.json" exists with:
      """
      {
        "jira": { "project": "LOCAL-PROJ" }
      }
      """
    When I call getProjectConfig()
    Then I receive an object with key "jira"
    And the "jira.project" value is "LOCAL-PROJ"

  Scenario: getProjectConfig returns empty object when no config available
    Given process.env.OPENCODE_PROJECT_CONFIG is not set
    And no local file ".opencode/opencode-project.json" exists
    When I call getProjectConfig()
    Then I receive an empty object {}

  Scenario: getProjectConfig handles invalid JSON in process.env gracefully
    Given process.env.OPENCODE_PROJECT_CONFIG is set to "not-valid-json{{"
    And a local file ".opencode/opencode-project.json" exists with:
      """
      { "jira": { "project": "FALLBACK" } }
      """
    When I call getProjectConfig()
    Then I receive the local file content as fallback
    And the "jira.project" value is "FALLBACK"

  Scenario: getPluginConfig returns a specific plugin section
    Given process.env.OPENCODE_PROJECT_CONFIG is set to:
      """
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "csv_file": ".opencode/tt.csv" }
      }
      """
    When I call getPluginConfig("time-tracking")
    Then I receive the "time_tracking" section
    And the "csv_file" value is ".opencode/tt.csv"

  Scenario: getPluginConfig converts plugin name to section key
    Given process.env.OPENCODE_PROJECT_CONFIG is set to:
      """
      { "time_tracking": { "csv_file": ".opencode/tt.csv" } }
      """
    When I call getPluginConfig("time-tracking")
    Then the plugin name "time-tracking" is converted to section key "time_tracking"
    And the returned section contains "csv_file"

  Scenario: getPluginConfig returns empty object for unknown plugin
    Given process.env.OPENCODE_PROJECT_CONFIG is set to:
      """
      { "jira": { "project": "COPSPA" } }
      """
    When I call getPluginConfig("unknown-plugin")
    Then I receive an empty object {}

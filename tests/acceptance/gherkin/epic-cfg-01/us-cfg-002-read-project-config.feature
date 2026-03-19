Feature: Read Project Configuration
  As a System (ConfigLoader)
  I want to read the project-specific config file
  So that project-level overrides can be applied

  Scenario: Read existing project config file
    Given a project config file exists at "<project>/.opencode/opencode-project.json"
    And it contains valid JSON:
      """
      {
        "jira": {
          "project": "COPSPA",
          "base_url": "https://techdivision.atlassian.net"
        },
        "time_tracking": {
          "csv_file": ".opencode/time_tracking/time-tracking.csv",
          "valid_projects": ["COPSPA"],
          "global_default": {
            "issue_key": "COPSPA-5",
            "account_key": "TD_KS_1100_KI_Arbeitsweise"
          }
        }
      }
      """
    When the ConfigLoader reads the project config
    Then the result contains the key "jira" with "project" value "COPSPA"
    And the result contains the key "time_tracking" with nested values

  Scenario: Project config file does not exist
    Given no project config file exists at "<project>/.opencode/opencode-project.json"
    When the ConfigLoader reads the project config
    Then the result is an empty object {}
    And no error is thrown

  Scenario: Project .opencode directory does not exist
    Given the directory "<project>/.opencode/" does not exist
    When the ConfigLoader reads the project config
    Then the result is an empty object {}
    And no error is thrown

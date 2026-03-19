Feature: Deep-Merge Global and Project Configuration
  As a System (ConfigLoader)
  I want to deep-merge global and project configs
  So that project values override global defaults at all nesting levels

  Background:
    Given the deepmerge library is configured with custom array-merge strategy

  Scenario: Project scalar value overrides global scalar value
    Given the global config contains:
      """
      {
        "time_tracking": {
          "csv_file": "global-default.csv"
        }
      }
      """
    And the project config contains:
      """
      {
        "time_tracking": {
          "csv_file": ".opencode/time_tracking/time-tracking.csv"
        }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "time_tracking.csv_file" equals ".opencode/time_tracking/time-tracking.csv"

  Scenario: Deep nested objects are recursively merged
    Given the global config contains:
      """
      {
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.8, "output": 0.2 },
            "default": { "input": 3, "output": 15 }
          }
        }
      }
      """
    And the project config contains:
      """
      {
        "time_tracking": {
          "csv_file": ".opencode/time_tracking/time-tracking.csv",
          "valid_projects": ["COPSPA"]
        }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config contains "time_tracking.pricing.ratio.input" with value 0.8
    And the merged config contains "time_tracking.csv_file" with value ".opencode/time_tracking/time-tracking.csv"
    And the merged config contains "time_tracking.valid_projects" with value ["COPSPA"]

  Scenario: Project array replaces global array completely (no concatenation)
    Given the global config contains:
      """
      {
        "time_tracking": {
          "valid_projects": ["GLOBAL-A", "GLOBAL-B"]
        }
      }
      """
    And the project config contains:
      """
      {
        "time_tracking": {
          "valid_projects": ["COPSPA"]
        }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "time_tracking.valid_projects" equals ["COPSPA"]
    And the merged config "time_tracking.valid_projects" does NOT contain "GLOBAL-A"
    And the merged config "time_tracking.valid_projects" does NOT contain "GLOBAL-B"

  Scenario: Global-only values are preserved when project has no override
    Given the global config contains:
      """
      {
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.8, "output": 0.2 }
          }
        }
      }
      """
    And the project config contains:
      """
      {
        "jira": {
          "project": "COPSPA"
        }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config contains "time_tracking.pricing.ratio.input" with value 0.8
    And the merged config contains "jira.project" with value "COPSPA"

  Scenario: Both configs are empty
    Given the global config is an empty object {}
    And the project config is an empty object {}
    When the ConfigLoader merges global and project config
    Then the merged config is an empty object {}

  Scenario: Only global config exists
    Given the global config contains:
      """
      {
        "config": {
          "sync_url": "https://n8n.example.com/webhook/oc-config-sync"
        }
      }
      """
    And no project config exists
    When the ConfigLoader merges global and project config
    Then the merged config "config.sync_url" equals "https://n8n.example.com/webhook/oc-config-sync"

  Scenario: Only project config exists
    Given no global config exists
    And the project config contains:
      """
      {
        "jira": {
          "project": "COPSPA"
        }
      }
      """
    When the ConfigLoader merges global and project config
    Then the merged config "jira.project" equals "COPSPA"

Feature: ConfigMerger Deep-Merge
  As a System (ConfigMerger)
  I want to deep-merge remote config (base) with local config (wins)
  So that local values always take precedence while remote defaults fill gaps

  Background:
    Given the ConfigMerger service is initialized

  Scenario: Local scalar values override remote scalar values
    Given a remote config:
      """
      {
        "jira": {
          "project": "REMOTE-PROJ",
          "base_url": "https://remote.atlassian.net",
          "workflow": {
            "status": { "open": { "name": "Open", "id": "1" } }
          }
        }
      }
      """
    And a local config:
      """
      {
        "jira": {
          "project": "LOCAL-PROJ",
          "base_url": "https://local.atlassian.net"
        }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result field "jira.project" is "LOCAL-PROJ"
    And the result field "jira.base_url" is "https://local.atlassian.net"
    And the result field "jira.workflow.status.open.name" is "Open"

  Scenario: Remote-only values are adopted as new defaults
    Given a remote config:
      """
      {
        "jira": {
          "workflow": {
            "status": { "open": { "name": "Open", "id": "1" } }
          },
          "tempo": {
            "account_field_id": "customfield_10039"
          }
        }
      }
      """
    And a local config:
      """
      {
        "jira": {
          "project": "COPSPA"
        }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result field "jira.project" is "COPSPA"
    And the result field "jira.workflow.status.open.id" is "1"
    And the result field "jira.tempo.account_field_id" is "customfield_10039"

  Scenario: Local arrays replace remote arrays completely
    Given a remote config:
      """
      {
        "time_tracking": {
          "valid_projects": ["PROJ-A", "PROJ-B", "PROJ-C"]
        }
      }
      """
    And a local config:
      """
      {
        "time_tracking": {
          "valid_projects": ["COPSPA"]
        }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result field "time_tracking.valid_projects" is an array with 1 element
    And the array contains "COPSPA"
    And the array does not contain "PROJ-A"

  Scenario: Protected fields are removed from remote config before merge
    Given a remote config:
      """
      {
        "$schema": "https://remote-schema-url",
        "version": "0.1.0",
        "jira": { "project": "COPSPA" }
      }
      """
    And a local config:
      """
      {
        "$schema": "https://local-schema-url",
        "version": "1.0.0",
        "jira": { "base_url": "https://local.atlassian.net" }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result field "$schema" is "https://local-schema-url"
    And the result field "version" is "1.0.0"
    And the result field "jira.project" is "COPSPA"
    And the result field "jira.base_url" is "https://local.atlassian.net"

  Scenario: Deep nested objects are merged recursively
    Given a remote config:
      """
      {
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.8, "output": 0.2 },
            "default": { "input": 3, "output": 15 },
            "periods": [{ "from": "2025-11-01", "models": {} }]
          }
        }
      }
      """
    And a local config:
      """
      {
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.9, "output": 0.1 }
          }
        }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result field "time_tracking.pricing.ratio.input" is 0.9
    And the result field "time_tracking.pricing.ratio.output" is 0.1
    And the result field "time_tracking.pricing.default.input" is 3
    And the result field "time_tracking.pricing.periods" is an array with 1 element

  Scenario: Empty remote config results in local config unchanged
    Given a remote config:
      """
      {}
      """
    And a local config:
      """
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "csv_file": ".opencode/tt.csv" }
      }
      """
    When the ConfigMerger performs the deep-merge
    Then the result equals the local config

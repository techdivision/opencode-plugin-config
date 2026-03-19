Feature: Config Assembly Logic
  As a System (n8n ConfigBuilder Node)
  I want to assemble the complete config response from Google Sheet data and JIRA data
  So that the Config-Plugin receives a correctly structured remote config

  Background:
    Given Google Sheet data has been read for project "COPSPA"
    And JIRA workflow statuses have been fetched and normalized for project "COPSPA"

  Scenario: Assemble complete jira config section
    Given the User-Projects tab returned jira_base_url "techdivision.atlassian.net"
    And normalized JIRA statuses include "open", "in_progress", "closed"
    And the Transitions tab returned start_work from "selected" to "in_progress"
    And the Settings tab returned tempo.account_field_id "customfield_10039"
    And the Tempo-Accounts tab returned account "TD_KS_1165_CoP_SPA" with id 2847
    When I call buildJiraConfig with this data
    Then the result contains "project" with value "COPSPA"
    And the result contains "workflow.status.open" with name and id
    And the result contains "workflow.status.in_progress" with name and id
    And the result contains "workflow.defaults.transitions.start_work" with from "selected" and to "in_progress"
    And the result contains "workflow.defaults.wip_limits" as nested object
    And the result contains "tempo.account_field_id" with value "customfield_10039"
    And the result contains "tempo.accounts.TD_KS_1165_CoP_SPA" with id 2847

  Scenario: Assemble complete time_tracking config section
    Given the User-Projects tab returned default_issue "COPSPA-5" and default_account "TD_KS_1100_KI_Arbeitsweise"
    And the Agent-Defaults tab returned "@implementation" with issue_key "COPSPA-5" and subagents ["@reviewer", "@tester"]
    And the Pricing tab returned model "anthropic/claude-sonnet-4" with input 3, output 15, valid_from "2025-11-01"
    When I call buildTimeTrackingConfig with this data
    Then the result contains "valid_projects" with ["COPSPA"]
    And the result contains "global_default.issue_key" with value "COPSPA-5"
    And the result contains "global_default.account_key" with value "TD_KS_1100_KI_Arbeitsweise"
    And the result contains "agent_defaults.@implementation.issue_key" with value "COPSPA-5"
    And the result contains "agent_defaults.@implementation.subagents" with ["@reviewer", "@tester"]
    And the result contains "pricing.periods" as an array with at least one period

  Scenario: Pricing periods are grouped by valid_from date
    Given the Pricing tab contains:
      | model                       | input_price | output_price | valid_from |
      | anthropic/claude-sonnet-4   | 3           | 15           | 2025-11-01 |
      | anthropic/claude-opus-4     | 15          | 75           | 2025-11-01 |
      | anthropic/claude-opus-4-5   | 5           | 25           | 2025-12-20 |
    When the pricing data is assembled
    Then the result contains 2 pricing periods
    And the period with from "2025-11-01" contains 2 models
    And the period with from "2025-12-20" contains 1 model

  Scenario: Response wrapper includes version field
    Given the assembled jira config section
    And the assembled time_tracking config section
    When the final response is built
    Then the response contains "version" as a semver string
    And the response contains "config.jira" object
    And the response contains "config.time_tracking" object
    And no other top-level keys exist besides "version" and "config"

  Scenario: Config only includes sections for requested plugins
    Given the incoming plugin list is ["config", "time-tracking"]
    And the plugin list does NOT include "jira"
    When the config assembly runs
    Then the response contains "config.time_tracking"
    But the response does NOT contain "config.jira"

  Scenario: Operations are in separate files
    When I inspect the node source code
    Then "buildJiraConfig" is implemented in "operations/buildJiraConfig.ts"
    And "buildTimeTrackingConfig" is implemented in "operations/buildTimeTrackingConfig.ts"
    And "lookupGoogleSheet" is implemented in "operations/lookupGoogleSheet.ts"

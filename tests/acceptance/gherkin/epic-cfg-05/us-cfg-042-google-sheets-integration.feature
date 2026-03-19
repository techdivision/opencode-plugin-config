Feature: Google Sheets API Integration
  As a System (n8n ConfigBuilder Node)
  I want to read configuration data from all 6 Google Sheet tabs
  So that the Config-Builder can assemble the remote config from centrally maintained data

  Background:
    Given a Google Sheet with ID from credentials exists
    And the sheet contains 6 tabs: "User-Projects", "Agent-Defaults", "Tempo-Accounts", "Pricing", "Transitions", "Settings"

  Scenario: Lookup User-Projects tab by email and project_key
    Given the "User-Projects" tab contains a row with email "t.wagner@techdivision.com" and project_key "COPSPA"
    And that row has default_issue "COPSPA-5", default_account "TD_KS_1100_KI_Arbeitsweise", jira_base_url "techdivision.atlassian.net"
    When I lookup User-Projects for email "t.wagner@techdivision.com" and project_key "COPSPA"
    Then I receive default_issue "COPSPA-5"
    And I receive default_account "TD_KS_1100_KI_Arbeitsweise"
    And I receive jira_base_url "techdivision.atlassian.net"

  Scenario: Lookup Agent-Defaults tab by project_key
    Given the "Agent-Defaults" tab contains rows for project_key "COPSPA"
    And one row has agent_name "@implementation", issue_key "COPSPA-5", account_key "TD_KS_1100_KI_Arbeitsweise", subagents "@reviewer,@tester,@developer"
    When I lookup Agent-Defaults for project_key "COPSPA"
    Then I receive a list of agent default objects
    And the "@implementation" agent has issue_key "COPSPA-5"
    And the "@implementation" agent has subagents ["@reviewer", "@tester", "@developer"]

  Scenario: Lookup Tempo-Accounts tab by project_key
    Given the "Tempo-Accounts" tab contains rows for project_key "COPSPA"
    And one row has account_key "TD_KS_1165_CoP_SPA", account_id 2847, display_value "1165 | CoP Smart Process Automation SPA"
    When I lookup Tempo-Accounts for project_key "COPSPA"
    Then I receive a map of account_key to {id, value} objects
    And the key "TD_KS_1165_CoP_SPA" maps to id 2847

  Scenario: Read all rows from Pricing tab
    Given the "Pricing" tab contains 3 rows with different models and valid_from dates
    When I read all Pricing rows
    Then I receive all 3 pricing entries
    And each entry contains model, input_price, output_price, and valid_from
    And the entries are grouped by valid_from into period objects

  Scenario: Lookup Transitions tab by project_key
    Given the "Transitions" tab contains rows for project_key "COPSPA"
    And one row has semantic_name "start_work", from_status "selected", to_status "in_progress"
    When I lookup Transitions for project_key "COPSPA"
    Then I receive a map of semantic transition names
    And "start_work" maps to {from: "selected", to: "in_progress"}

  Scenario: Lookup Settings tab by project_key
    Given the "Settings" tab contains rows for project_key "COPSPA"
    And rows include key "wip_limit.in_progress" with value "3"
    And rows include key "tempo.account_field_id" with value "customfield_10039"
    When I lookup Settings for project_key "COPSPA"
    Then I receive a nested object from dot-notation keys
    And the path "wip_limit.in_progress" resolves to 3
    And the path "tempo.account_field_id" resolves to "customfield_10039"

  Scenario: User-Projects lookup returns empty for unknown email
    Given the "User-Projects" tab does not contain a row for email "unknown@example.com" and project_key "COPSPA"
    When I lookup User-Projects for email "unknown@example.com" and project_key "COPSPA"
    Then I receive an empty result
    And no error is thrown

  Scenario: Agent-Defaults returns empty list for unknown project
    Given the "Agent-Defaults" tab does not contain rows for project_key "UNKNOWN"
    When I lookup Agent-Defaults for project_key "UNKNOWN"
    Then I receive an empty agent defaults map
    And no error is thrown

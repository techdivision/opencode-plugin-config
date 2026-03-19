Feature: Google Sheet Tab Structure
  As a System (Config Backend)
  I want to have a Google Sheet with 6 tabs containing correct columns and example data
  So that the n8n workflow can look up configuration data per project

  Background:
    Given a Google Sheet is configured as Config-Backend

  Scenario: User-Projects tab structure
    When I open the "User-Projects" tab
    Then the columns are: email, project_key, default_issue, default_account, jira_base_url
    And at least one row exists for project "COPSPA"
    And the COPSPA row contains email "t.wagner@techdivision.com"
    And the COPSPA row contains default_issue "COPSPA-5"
    And the COPSPA row contains default_account "TD_KS_1100_KI_Arbeitsweise"

  Scenario: Agent-Defaults tab structure
    When I open the "Agent-Defaults" tab
    Then the columns are: project_key, agent_name, issue_key, account_key, subagents
    And at least one row exists for project "COPSPA"
    And the COPSPA row for agent "@implementation" contains issue_key "COPSPA-5"
    And the subagents column contains a comma-separated list

  Scenario: Tempo-Accounts tab structure
    When I open the "Tempo-Accounts" tab
    Then the columns are: project_key, account_key, account_id, display_value
    And at least one row exists for project "COPSPA"
    And the row for "TD_KS_1165_CoP_SPA" has account_id "2847"
    And the row for "TD_KS_1100_KI_Arbeitsweise" has account_id "2936"

  Scenario: Pricing tab structure
    When I open the "Pricing" tab
    Then the columns are: model, input_price, output_price, valid_from
    And at least one row exists for model "anthropic/claude-sonnet-4"
    And the input_price is a numeric value
    And the output_price is a numeric value
    And the valid_from is a date in format "YYYY-MM-DD"

  Scenario: Transitions tab structure
    When I open the "Transitions" tab
    Then the columns are: project_key, semantic_name, from_status, to_status
    And at least one row exists for project "COPSPA"
    And a row with semantic_name "start_work" exists
    And a row with semantic_name "complete_work" exists

  Scenario: Settings tab structure
    When I open the "Settings" tab
    Then the columns are: project_key, key, value
    And at least one row exists for project "COPSPA"
    And a row with key "wip_limit.in_progress" exists
    And a row with key "tempo.account_field_id" exists

  Scenario: All 6 tabs exist
    When I list all tabs in the Google Sheet
    Then exactly 6 tabs exist
    And the tab names are: User-Projects, Agent-Defaults, Tempo-Accounts, Pricing, Transitions, Settings

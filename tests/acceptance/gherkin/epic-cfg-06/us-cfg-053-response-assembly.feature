Feature: Response Assembly
  As a System (n8n Workflow)
  I want to assemble a correct JSON response with version and config object
  So that the Config Plugin receives a well-structured remote configuration

  Background:
    Given the n8n workflow is active
    And the Google Sheet contains COPSPA example data

  Scenario: Response contains version field
    When I send a sync request for project "COPSPA"
    Then the response contains a "version" field
    And the version is a valid semver string
    And the version is "0.1.0"

  Scenario: Response contains jira config section
    When I send a sync request for project "COPSPA" with plugins ["jira"]
    Then the response config contains a "jira" section
    And jira.project is "COPSPA"
    And jira.workflow.defaults.transitions contains "start_work"
    And jira.workflow.defaults.transitions contains "complete_work"
    And jira.tempo.accounts contains "TD_KS_1165_CoP_SPA"

  Scenario: Response contains time_tracking config section
    When I send a sync request for project "COPSPA" with plugins ["time-tracking"]
    Then the response config contains a "time_tracking" section
    And time_tracking.global_default.issue_key is "COPSPA-5"
    And time_tracking.global_default.account_key is "TD_KS_1100_KI_Arbeitsweise"
    And time_tracking.agent_defaults contains "@implementation"
    And time_tracking.pricing.periods is a non-empty array

  Scenario: Response includes settings as nested objects
    When I send a sync request for project "COPSPA" with plugins ["jira"]
    Then the response config contains jira.workflow.defaults.wip_limits
    And wip_limits.in_progress is 3
    And wip_limits.in_review is 5

  Scenario: Response omits sections for absent plugins
    When I send a sync request for project "COPSPA" with plugins ["config"]
    Then the response config does not contain a "jira" section
    And the response config does not contain a "time_tracking" section

  Scenario: Response assembles transitions from Google Sheet
    When I send a sync request for project "COPSPA" with plugins ["jira"]
    Then jira.workflow.defaults.transitions.start_work.from is "selected"
    And jira.workflow.defaults.transitions.start_work.to is "in_progress"
    And jira.workflow.defaults.transitions.complete_work.from is "in_progress"
    And jira.workflow.defaults.transitions.complete_work.to is "test"

  Scenario: Response assembles pricing periods from Google Sheet
    When I send a sync request for project "COPSPA" with plugins ["time-tracking"]
    Then time_tracking.pricing.periods is a non-empty array
    And the first period contains "from" date
    And the first period contains models with input and output prices

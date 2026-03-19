Feature: Error Handling for External Service Failures
  As a System (n8n ConfigBuilder Node)
  I want robust error handling when JIRA or Google Sheets are unavailable
  So that the node provides meaningful error information and partial results where possible

  Background:
    Given the ConfigBuilder node is executing with project key "COPSPA"

  Scenario: JIRA API is unreachable
    Given the JIRA API endpoint is not reachable (connection timeout)
    When the node attempts to fetch workflow statuses
    Then the node does not crash
    And the jira config section contains workflow statuses as an empty object
    And a warning is included in the node output indicating JIRA was unreachable
    And the time_tracking section is still assembled normally from Google Sheet data

  Scenario: JIRA API returns HTTP 401 Unauthorized
    Given the JIRA API returns HTTP 401 for the status request
    When the node attempts to fetch workflow statuses
    Then the node does not crash
    And the jira config section contains workflow statuses as an empty object
    And a warning message indicates "JIRA authentication failed"

  Scenario: JIRA API returns HTTP 404 for unknown project
    Given the JIRA project "UNKNOWN" does not exist
    When the node attempts to fetch statuses for project "UNKNOWN"
    Then the node does not crash
    And the jira config section contains workflow statuses as an empty object
    And a warning message indicates "JIRA project not found: UNKNOWN"

  Scenario: Google Sheet is not readable
    Given the Google Sheet API returns an error (insufficient permissions or sheet not found)
    When the node attempts to read Google Sheet tabs
    Then the node does not crash
    And all config sections that depend on Sheet data contain empty defaults
    And a warning is included indicating the Google Sheet could not be read

  Scenario: Individual Google Sheet tab is missing
    Given the "Pricing" tab does not exist in the Google Sheet
    But all other 5 tabs exist and are readable
    When the node reads all 6 tabs
    Then 5 tabs are read successfully
    And the Pricing section falls back to an empty periods array
    And a warning indicates "Tab 'Pricing' not found in Google Sheet"
    And the remaining data from the other 5 tabs is used normally

  Scenario: Google Sheet returns empty data for a tab
    Given the "Agent-Defaults" tab exists but contains no data rows (only headers)
    When the node reads the Agent-Defaults tab for project "COPSPA"
    Then the agent_defaults section is an empty object
    And no error is thrown
    And no warning is generated (empty data is valid)

  Scenario: Both JIRA and Google Sheets are unreachable
    Given the JIRA API is not reachable
    And the Google Sheet API is not reachable
    When the node executes
    Then the node does not crash
    And the response contains "version" field
    And the response contains "config" with empty section defaults
    And warnings are included for both JIRA and Google Sheet failures

  Scenario: Malformed data in Google Sheet row
    Given the "User-Projects" tab contains a row with missing "default_issue" column value
    When the node reads the User-Projects tab
    Then the missing field defaults to an empty string
    And the remaining fields are read correctly
    And no error is thrown

  Scenario: JIRA returns unexpected status format
    Given the JIRA API returns a status with missing "statusCategory" field
    When the statuses are normalized
    Then the status is included with a snake_case key derived from the name
    And no error is thrown
    And a warning indicates the missing statusCategory

Feature: JIRA REST API Integration for Workflow Statuses
  As a System (n8n ConfigBuilder Node)
  I want to fetch and normalize JIRA workflow statuses via REST API
  So that the config response contains semantically keyed status mappings for each project

  Background:
    Given valid JIRA credentials are configured in n8n
    And the JIRA base URL is "https://techdivision.atlassian.net"

  Scenario: Fetch workflow statuses for a JIRA project
    Given the JIRA project "COPSPA" exists
    And the project has statuses including "Offen" (id: "1", category: "new") and "In Arbeit" (id: "3", category: "indeterminate")
    When I call GET /rest/api/3/project/COPSPA/statuses
    Then I receive the list of all workflow statuses for the project
    And each status contains name, id, and statusCategory

  Scenario: Normalize status names to semantic keys
    Given the JIRA API returns status "Offen" with statusCategory "new"
    And the JIRA API returns status "In Arbeit" with statusCategory "indeterminate"
    And the JIRA API returns status "Geschlossen" with statusCategory "done"
    When the statuses are normalized
    Then "Offen" is mapped to semantic key "open"
    And "In Arbeit" is mapped to semantic key "in_progress"
    And "Geschlossen" is mapped to semantic key "closed"

  Scenario: Normalized status output format
    Given the JIRA project "COPSPA" has status "Refinement" (id: "10032")
    When the statuses are normalized and formatted
    Then the output contains key "refinement" with object {"name": "Refinement", "id": "10032"}

  Scenario: Deduplicate statuses across issue types
    Given the JIRA API returns statuses grouped by issue type
    And status "In Arbeit" (id: "3") appears in both "Story" and "Task" issue types
    When the statuses are collected and deduplicated
    Then "In Arbeit" appears only once in the result
    And the status id is "3"

  Scenario Outline: Normalize German and English status names
    Given the JIRA API returns status "<jira_name>" with statusCategory "<category>"
    When the status is normalized
    Then the semantic key is "<expected_key>"

    Examples:
      | jira_name         | category      | expected_key      |
      | Offen             | new           | open              |
      | Open              | new           | open              |
      | In Arbeit         | indeterminate | in_progress       |
      | In Progress       | indeterminate | in_progress       |
      | Refinement        | indeterminate | refinement        |
      | Estimation needed | indeterminate | estimation_needed |
      | Selected          | indeterminate | selected          |
      | Test              | indeterminate | test              |
      | Testing done      | indeterminate | testing_done      |
      | On hold           | indeterminate | on_hold           |
      | Zurueckgewiesen   | indeterminate | rejected          |
      | Rejected          | indeterminate | rejected          |
      | Geschlossen       | done          | closed            |
      | Closed            | done          | closed            |

  Scenario: Unknown status name gets snake_case key
    Given the JIRA API returns status "Custom Review Phase" with statusCategory "indeterminate"
    When the status is normalized
    Then the semantic key is "custom_review_phase"
    And the name is preserved as "Custom Review Phase"

Feature: Section-Level Error Handling
  As a System (SchemaValidator)
  I want to skip invalid sections while keeping valid ones
  So that a single invalid section does not discard the entire response

  Background:
    Given the SchemaValidator service is initialized
    And plugin schemas exist for "time_tracking" and "jira"

  Scenario: Invalid section is skipped, valid section is kept
    Given the response contains sections:
      | section        | valid |
      | jira           | yes   |
      | time_tracking  | no    |
    When the response is validated
    Then the section "jira" is included in the validated result
    And the section "time_tracking" is excluded from the validated result
    And a warning is logged for "time_tracking" containing the validation errors

  Scenario: All sections valid - all are kept
    Given the response contains sections:
      | section        | valid |
      | jira           | yes   |
      | time_tracking  | yes   |
    When the response is validated
    Then the section "jira" is included in the validated result
    And the section "time_tracking" is included in the validated result
    And no warnings are logged

  Scenario: All sections invalid - empty config returned
    Given the response contains sections:
      | section        | valid |
      | jira           | no    |
      | time_tracking  | no    |
    When the response is validated
    Then the validated config contains no sections
    And a warning is logged for "jira"
    And a warning is logged for "time_tracking"

  Scenario: Warning log includes section name and error details
    Given the section "time_tracking" fails validation with error:
      """
      /time_tracking/global_default/issue_key must match pattern "^[A-Z][A-Z0-9]+-[0-9]+$"
      """
    When the response is validated
    Then the warning log contains "time_tracking"
    And the warning log contains "issue_key"
    And the warning log contains "pattern"

  Scenario: Validation continues after encountering an invalid section
    Given the response contains 3 sections in order: "jira", "time_tracking", "marp"
    And "jira" is valid
    And "time_tracking" is invalid
    And "marp" has no schema
    When the response is validated
    Then the section "jira" is included
    And the section "time_tracking" is excluded
    And the section "marp" is included
    And exactly 1 warning is logged

Feature: Ajv Section Validation
  As a System (SchemaValidator)
  I want to validate each response section against its plugin schema using Ajv
  So that only schema-conforming data enters the config merge

  Background:
    Given the SchemaValidator service is initialized with Ajv
    And Ajv is configured with allErrors true and strict false
    And ajv-formats is registered for format keywords

  Scenario: Valid section passes schema validation
    Given a plugin schema for "time_tracking" that requires:
      | field                          | type   | required |
      | time_tracking.csv_file         | string | yes      |
      | time_tracking.global_default   | object | yes      |
    And a response section "time_tracking" with data:
      """
      {
        "csv_file": "tracking.csv",
        "global_default": {
          "issue_key": "COPSPA-5",
          "account_key": "TD_KS_1100"
        }
      }
      """
    When the section "time_tracking" is validated against the schema
    Then the validation passes
    And the section data is included in the validated result

  Scenario: Invalid section fails schema validation with all errors
    Given a plugin schema for "time_tracking" that requires field "global_default.issue_key" to match pattern "^[A-Z][A-Z0-9]+-[0-9]+$"
    And a response section "time_tracking" with data:
      """
      {
        "csv_file": "tracking.csv",
        "global_default": {
          "issue_key": "invalid",
          "account_key": "TD_KS_1100"
        }
      }
      """
    When the section "time_tracking" is validated against the schema
    Then the validation fails
    And all validation errors are reported
    And the errors contain a message about "issue_key" and "pattern"

  Scenario: Section data is wrapped with section key before validation
    Given a plugin schema that defines "time_tracking" as a top-level property
    And a response section "time_tracking" with data:
      """
      { "csv_file": "tracking.csv" }
      """
    When the section "time_tracking" is validated against the schema
    Then the data is wrapped as {"time_tracking": <sectionData>} before Ajv validation
    And the schema validates the wrapped object

  Scenario: Format keyword "uri" is validated via ajv-formats
    Given a plugin schema for "config" that requires "config.sync_url" with format "uri"
    And a response section "config" with data:
      """
      { "sync_url": "not-a-valid-uri" }
      """
    When the section "config" is validated against the schema
    Then the validation fails
    And the errors contain a message about "sync_url" and "format"

  Scenario: Valid URI passes format validation
    Given a plugin schema for "config" that requires "config.sync_url" with format "uri"
    And a response section "config" with data:
      """
      { "sync_url": "https://n8n.example.com/webhook/oc-config-sync" }
      """
    When the section "config" is validated against the schema
    Then the validation passes

  Scenario: Multiple sections validated independently
    Given plugin schemas exist for "time_tracking" and "jira"
    And the response contains both sections
    When all sections are validated
    Then each section is validated independently against its own schema
    And validation results are returned per section

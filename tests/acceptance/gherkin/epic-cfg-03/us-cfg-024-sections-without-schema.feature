Feature: Sections Without Schema
  As a System (SchemaValidator)
  I want to accept response sections that have no associated schema
  So that plugins without configSchema can still deliver remote config

  Background:
    Given the SchemaValidator service is initialized

  Scenario: Section from plugin without configSchema is accepted
    Given a plugin "marp" is discovered without configSchema
    And the response contains a section "marp" with data:
      """
      { "theme": "default", "output_dir": "./slides" }
      """
    When the response is validated
    Then the section "marp" is included in the validated result without modification
    And no validation is performed on the "marp" section
    And no warning is logged for "marp"

  Scenario: Mix of sections with and without schema
    Given the following plugins are discovered:
      | pluginName    | hasSchema |
      | time-tracking | yes       |
      | marp          | no        |
    And the response contains sections "time_tracking" and "marp"
    And section "time_tracking" is valid against its schema
    When the response is validated
    Then the section "time_tracking" is validated and included
    And the section "marp" is included without validation
    And the validated result contains both sections

  Scenario: Section without schema when schema file was not found
    Given a plugin "time-tracking" declares configSchema "schemas/config.schema.json"
    But the schema file does not exist at the resolved path
    And the response contains section "time_tracking"
    When the response is validated
    Then a warning is logged about the missing schema file
    And the section "time_tracking" is accepted without validation

  Scenario: Log message indicates no-schema acceptance
    Given a plugin "marp" is discovered without configSchema
    And the response contains section "marp"
    When the response is validated
    Then an info-level log is emitted containing "marp" and "no schema" and "accepted"

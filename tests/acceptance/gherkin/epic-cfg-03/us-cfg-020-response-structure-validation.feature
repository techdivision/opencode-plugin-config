Feature: Webhook Response Structure Validation
  As a System (SchemaValidator)
  I want to validate the basic structure of the webhook response
  So that only well-formed responses enter the validation pipeline

  Background:
    Given the SchemaValidator service is initialized

  Scenario: Valid response with version and config fields
    Given a webhook response with the following JSON:
      """
      {
        "version": "0.1.0",
        "config": {
          "time_tracking": { "csv_file": "tt.csv" }
        }
      }
      """
    When the response structure is validated
    Then the structure validation passes
    And the config object is returned for section-level validation

  Scenario: Response is not valid JSON
    Given a webhook response body that is not valid JSON:
      """
      this is not json {{{
      """
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "invalid JSON"
    And the entire response is discarded

  Scenario: Response is a JSON array instead of object
    Given a webhook response with the following JSON:
      """
      [1, 2, 3]
      """
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "must be a JSON object"

  Scenario: Response is missing the version field
    Given a webhook response with the following JSON:
      """
      {
        "config": { "time_tracking": {} }
      }
      """
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "version"

  Scenario: Response is missing the config field
    Given a webhook response with the following JSON:
      """
      {
        "version": "0.1.0"
      }
      """
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "config"

  Scenario: Config field is not an object
    Given a webhook response with the following JSON:
      """
      {
        "version": "0.1.0",
        "config": "not an object"
      }
      """
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "config must be an object"

  Scenario: Response with null body
    Given a webhook response body that is null
    When the response structure is validated
    Then the structure validation fails
    And an error is returned with message containing "invalid JSON"

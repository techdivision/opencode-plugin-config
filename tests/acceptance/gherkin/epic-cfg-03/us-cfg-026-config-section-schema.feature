Feature: Config Section Schema
  As a System (SchemaValidator)
  I want to validate the "config" section against the plugin's own config.schema.json
  So that the config plugin's own settings are validated like any other plugin section

  Background:
    Given the SchemaValidator service is initialized
    And the config plugin's schema exists at "schemas/config.schema.json"

  Scenario: Valid config section with sync_url passes validation
    Given a response section "config" with data:
      """
      {
        "sync_url": "https://n8n.example.com/webhook/oc-config-sync",
        "sync_token": "my-secret-token"
      }
      """
    When the section "config" is validated against the config schema
    Then the validation passes

  Scenario: Config section with sync_url only passes validation
    Given a response section "config" with data:
      """
      {
        "sync_url": "https://n8n.example.com/webhook/oc-config-sync"
      }
      """
    When the section "config" is validated against the config schema
    Then the validation passes
    And the optional field "sync_token" is not required

  Scenario: Config section with invalid sync_url format fails
    Given a response section "config" with data:
      """
      {
        "sync_url": "not-a-valid-uri"
      }
      """
    When the section "config" is validated against the config schema
    Then the validation fails
    And the errors contain a message about "sync_url" and "format"

  Scenario: Empty config section passes validation
    Given a response section "config" with data:
      """
      {}
      """
    When the section "config" is validated against the config schema
    Then the validation passes
    And no required fields are enforced on the config section

  Scenario: Config schema file exists in schemas directory
    When the file "schemas/config.schema.json" is read
    Then it contains a valid JSON Schema with "$schema" field
    And it defines "config" as a top-level property of type "object"
    And the "config" property includes "sync_url" with format "uri"
    And the "config" property includes "sync_token" of type "string"

  Scenario: Config plugin discovered with own configSchema
    Given the config plugin's plugin.json contains:
      """
      {
        "name": "config",
        "configSchema": "schemas/config.schema.json"
      }
      """
    When plugin discovery runs
    Then the config plugin's PluginDescriptor has configSchema "schemas/config.schema.json"
    And the schema is used to validate the "config" section like any other plugin

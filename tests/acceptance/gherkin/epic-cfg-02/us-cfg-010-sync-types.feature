Feature: SyncPayload and SyncResponse TypeScript Types
  As a System (ConfigSyncer)
  I want well-defined TypeScript types for the webhook payload and response
  So that the compiler enforces correct data structures at build time

  Background:
    Given the opencode-plugin-config package is compiled with TypeScript strict mode

  Scenario: SyncPayload type contains all required fields
    Given I inspect the SyncPayload type definition
    Then it contains a "plugin_version" field of type string
    And it contains an "email" field of type string
    And it contains a "plugins" field of type string array
    And it contains a "config" field of type Record<string, unknown>

  Scenario: SyncResponse type contains all required fields
    Given I inspect the SyncResponse type definition
    Then it contains a "version" field of type string
    And it contains a "config" field of type Record<string, unknown>

  Scenario: SyncPayload rejects missing required fields
    Given I create a SyncPayload object without the "email" field
    When the TypeScript compiler validates the code
    Then a compilation error is reported for the missing field

  Scenario: SyncResponse accepts minimal valid response
    Given I create a SyncResponse object with version "0.1.0" and an empty config object
    When the TypeScript compiler validates the code
    Then no compilation errors are reported

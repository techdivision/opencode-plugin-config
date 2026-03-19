Feature: Plugin Returns Empty Object
  As a System (OpenCode Plugin Loader)
  I want the config plugin to return an empty object {} after initialization
  So that the plugin loader knows there are no runtime hooks to register

  Scenario: Plugin returns empty object on successful init
    Given the config plugin has completed its initialization
    And process.env.OPENCODE_PROJECT_CONFIG has been set
    When the plugin function returns
    Then the return value is an empty object {}
    And no hooks are registered (no "onMessage", "onChat", etc.)

  Scenario: Plugin returns empty object even when webhook fails
    Given the config plugin initialization encountered a webhook error
    And the fallback to local config was applied
    When the plugin function returns
    Then the return value is an empty object {}
    And the plugin does not throw an error

  Scenario: Plugin returns empty object when no config exists
    Given no local config and no webhook response is available
    When the plugin function returns
    Then the return value is an empty object {}
    And process.env.OPENCODE_PROJECT_CONFIG is set to "{}"

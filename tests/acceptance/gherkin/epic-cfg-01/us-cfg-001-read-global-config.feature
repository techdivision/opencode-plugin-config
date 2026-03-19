Feature: Read Global Configuration
  As a System (ConfigLoader)
  I want to read the global config file
  So that cross-project defaults are available as a base layer

  Scenario: Read existing global config file
    Given a global config file exists at "~/.config/opencode/opencode-project.json"
    And it contains valid JSON:
      """
      {
        "config": {
          "sync_url": "https://n8n.example.com/webhook/oc-config-sync"
        },
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.8, "output": 0.2 },
            "default": { "input": 3, "output": 15 }
          }
        }
      }
      """
    When the ConfigLoader reads the global config
    Then the result contains the key "config" with a "sync_url" value
    And the result contains the key "time_tracking" with nested "pricing" values

  Scenario: Global config file does not exist
    Given no global config file exists at "~/.config/opencode/opencode-project.json"
    When the ConfigLoader reads the global config
    Then the result is an empty object {}
    And no error is thrown

  Scenario: Global config directory does not exist
    Given the directory "~/.config/opencode/" does not exist
    When the ConfigLoader reads the global config
    Then the result is an empty object {}
    And no error is thrown

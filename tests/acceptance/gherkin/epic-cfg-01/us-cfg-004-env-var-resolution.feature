Feature: Environment Variable Placeholder Resolution
  As a System (ConfigLoader)
  I want to resolve {env:VAR} placeholders in config values
  So that sensitive data like tokens can be injected from environment variables

  Scenario: Resolve a single {env:VAR} placeholder
    Given the merged config contains:
      """
      {
        "config": {
          "sync_token": "{env:OC_CONFIG_SYNC_TOKEN}"
        }
      }
      """
    And the environment variable "OC_CONFIG_SYNC_TOKEN" is set to "my-secret-token"
    When the ConfigLoader resolves environment variables
    Then the config "config.sync_token" equals "my-secret-token"

  Scenario: Resolve multiple {env:VAR} placeholders in different values
    Given the merged config contains:
      """
      {
        "config": {
          "sync_url": "{env:OC_CONFIG_SYNC_URL}",
          "sync_token": "{env:OC_CONFIG_SYNC_TOKEN}"
        }
      }
      """
    And the environment variable "OC_CONFIG_SYNC_URL" is set to "https://n8n.example.com/webhook/oc-config-sync"
    And the environment variable "OC_CONFIG_SYNC_TOKEN" is set to "my-secret-token"
    When the ConfigLoader resolves environment variables
    Then the config "config.sync_url" equals "https://n8n.example.com/webhook/oc-config-sync"
    And the config "config.sync_token" equals "my-secret-token"

  Scenario: Resolve {env:VAR} in deeply nested config values
    Given the merged config contains:
      """
      {
        "time_tracking": {
          "sync": {
            "tempo": {
              "api_token": "{env:TT_TEMPO_API_TOKEN}"
            }
          }
        }
      }
      """
    And the environment variable "TT_TEMPO_API_TOKEN" is set to "tempo-api-key-123"
    When the ConfigLoader resolves environment variables
    Then the config "time_tracking.sync.tempo.api_token" equals "tempo-api-key-123"

  Scenario: Unresolvable {env:VAR} placeholder (variable not set)
    Given the merged config contains:
      """
      {
        "config": {
          "sync_token": "{env:NONEXISTENT_VAR}"
        }
      }
      """
    And the environment variable "NONEXISTENT_VAR" is NOT set
    When the ConfigLoader resolves environment variables
    Then the config "config.sync_token" equals "{env:NONEXISTENT_VAR}"
    And the original placeholder is preserved unchanged

  Scenario: Non-string values are not affected by env resolution
    Given the merged config contains:
      """
      {
        "time_tracking": {
          "pricing": {
            "ratio": { "input": 0.8, "output": 0.2 }
          },
          "valid_projects": ["COPSPA"]
        }
      }
      """
    When the ConfigLoader resolves environment variables
    Then the config "time_tracking.pricing.ratio.input" equals 0.8
    And the config "time_tracking.valid_projects" equals ["COPSPA"]

  Scenario: Only simple replacement, no recursive resolution
    Given the merged config contains:
      """
      {
        "config": {
          "sync_url": "{env:REDIRECT_VAR}"
        }
      }
      """
    And the environment variable "REDIRECT_VAR" is set to "{env:ANOTHER_VAR}"
    And the environment variable "ANOTHER_VAR" is set to "final-value"
    When the ConfigLoader resolves environment variables
    Then the config "config.sync_url" equals "{env:ANOTHER_VAR}"
    And the resolution is NOT recursive

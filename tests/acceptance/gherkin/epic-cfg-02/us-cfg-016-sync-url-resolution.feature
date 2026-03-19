Feature: sync_url Resolution Cascade
  As a System (ConfigSyncer)
  I want to resolve the sync_url through a defined cascade
  So that the webhook URL can be configured flexibly via config file or environment variables

  Scenario: Resolve sync_url directly from local config
    Given the local config contains:
      """json
      { "config": { "sync_url": "https://n8n.example.com/webhook/oc-config-sync" } }
      """
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is "https://n8n.example.com/webhook/oc-config-sync"

  Scenario: Resolve sync_url from {env:VAR} pattern in config
    Given the local config contains:
      """json
      { "config": { "sync_url": "{env:OC_CONFIG_SYNC_URL}" } }
      """
    And process.env.OC_CONFIG_SYNC_URL is "https://resolved.example.com/webhook"
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is "https://resolved.example.com/webhook"

  Scenario: Resolve sync_url from {env:VAR} when env var is not set
    Given the local config contains:
      """json
      { "config": { "sync_url": "{env:OC_CONFIG_SYNC_URL}" } }
      """
    And process.env.OC_CONFIG_SYNC_URL is not set
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is null
    And the webhook is skipped

  Scenario: Fallback to process.env.OC_CONFIG_SYNC_URL when config has no sync_url
    Given the local config does not contain a "config.sync_url" field
    And process.env.OC_CONFIG_SYNC_URL is "https://fallback.example.com/webhook"
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is "https://fallback.example.com/webhook"

  Scenario: Skip webhook when no sync_url is available from any source
    Given the local config does not contain a "config.sync_url" field
    And process.env.OC_CONFIG_SYNC_URL is not set
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is null
    And the webhook is skipped
    And the ConfigSyncer returns null

  Scenario: Resolve sync_token via {env:VAR} pattern
    Given the local config contains:
      """json
      { "config": { "sync_url": "https://n8n.example.com/webhook", "sync_token": "{env:OC_CONFIG_SYNC_TOKEN}" } }
      """
    And process.env.OC_CONFIG_SYNC_TOKEN is "my-secret-token"
    When the ConfigSyncer resolves the sync_token
    Then the resolved sync_token is "my-secret-token"

  Scenario Outline: sync_url resolution cascade priority
    Given the local config sync_url is "<config_value>"
    And process.env.OC_CONFIG_SYNC_URL is "<env_value>"
    When the ConfigSyncer resolves the sync_url
    Then the resolved sync_url is "<result>"

    Examples:
      | config_value                                 | env_value                          | result                                       |
      | https://from-config.example.com/webhook      | https://from-env.example.com       | https://from-config.example.com/webhook       |
      | {env:OC_CONFIG_SYNC_URL}                     | https://from-env.example.com       | https://from-env.example.com                  |
      |                                              | https://from-env.example.com       | https://from-env.example.com                  |
      |                                              |                                    | null                                          |

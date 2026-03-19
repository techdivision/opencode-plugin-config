Feature: HTTP POST to Webhook with Bearer Token and Timeout
  As a System (ConfigSyncer)
  I want to send an HTTP POST request to the configured sync_url
  So that the remote config can be retrieved from the n8n webhook

  Scenario: Successful POST request to sync_url
    Given the sync_url is "https://n8n.example.com/webhook/oc-config-sync"
    And the webhook responds with status 200 and a valid SyncResponse
    When the ConfigSyncer sends the POST request
    Then the request method is POST
    And the request URL is "https://n8n.example.com/webhook/oc-config-sync"
    And the request body contains the assembled SyncPayload as JSON
    And the response is parsed as a SyncResponse object

  Scenario: Authorization header with Bearer token when sync_token is configured
    Given the sync_url is "https://n8n.example.com/webhook/oc-config-sync"
    And the sync_token is "my-secret-token"
    And the webhook responds with status 200
    When the ConfigSyncer sends the POST request
    Then the request contains header "Authorization" with value "Bearer my-secret-token"

  Scenario: No Authorization header when sync_token is not configured
    Given the sync_url is "https://n8n.example.com/webhook/oc-config-sync"
    And no sync_token is configured
    And the webhook responds with status 200
    When the ConfigSyncer sends the POST request
    Then the request does not contain an "Authorization" header

  Scenario: Request aborts after 5 second timeout
    Given the sync_url is "https://n8n.example.com/webhook/oc-config-sync"
    And the webhook takes longer than 5 seconds to respond
    When the ConfigSyncer sends the POST request
    Then the request is aborted via AbortController after 5 seconds
    And the ConfigSyncer returns null
    And a warning is logged containing "timeout" or "aborted"

  Scenario: Native fetch() is used as HTTP client
    Given the sync_url is configured
    When the ConfigSyncer sends the POST request
    Then the request is made using the native fetch() API
    And no external HTTP library is used

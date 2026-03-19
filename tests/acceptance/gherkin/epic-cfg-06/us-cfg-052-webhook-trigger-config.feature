Feature: Webhook Trigger Configuration
  As a System (n8n Webhook)
  I want to have a properly configured webhook trigger for POST /oc-config-sync
  So that the Config Plugin can send sync requests and receive configuration data

  Scenario: Webhook accepts POST requests
    Given the n8n workflow is active
    When I send a POST request to "/webhook/oc-config-sync"
    Then the response status is not 404
    And the response status is not 405

  Scenario: Webhook rejects GET requests
    Given the n8n workflow is active
    When I send a GET request to "/webhook/oc-config-sync"
    Then the response status is 405

  Scenario: Webhook parses plugin_version from payload
    Given the n8n workflow is active
    When I send a POST request with body:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "test@example.com",
        "plugins": ["config"],
        "config": {}
      }
      """
    Then the workflow extracts plugin_version as "0.1.0"

  Scenario: Webhook parses email from payload
    Given the n8n workflow is active
    When I send a POST request with body:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "t.wagner@techdivision.com",
        "plugins": ["config"],
        "config": {}
      }
      """
    Then the workflow extracts email as "t.wagner@techdivision.com"

  Scenario: Webhook parses plugins array from payload
    Given the n8n workflow is active
    When I send a POST request with body:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "test@example.com",
        "plugins": ["config", "time-tracking", "jira", "shell-env"],
        "config": {}
      }
      """
    Then the workflow extracts plugins as a list with 4 entries
    And the plugins list contains "time-tracking"
    And the plugins list contains "jira"

  Scenario: Webhook extracts seed data from config
    Given the n8n workflow is active
    When I send a POST request with body:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "test@example.com",
        "plugins": ["config", "jira"],
        "config": {
          "jira": {
            "project": "COPSPA",
            "base_url": "https://techdivision.atlassian.net"
          }
        }
      }
      """
    Then the workflow extracts project key "COPSPA" from config.jira.project
    And the workflow extracts base URL "https://techdivision.atlassian.net" from config.jira.base_url

  Scenario: Webhook handles missing optional fields gracefully
    Given the n8n workflow is active
    When I send a POST request with body:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "test@example.com",
        "plugins": ["config"],
        "config": {}
      }
      """
    Then the response status is 200
    And the response contains a valid config object

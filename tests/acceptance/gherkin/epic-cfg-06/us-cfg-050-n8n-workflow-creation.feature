Feature: n8n Workflow Creation
  As a System (n8n Workflow)
  I want to have a complete n8n workflow with Webhook trigger and Custom Node
  So that the Config-Sync endpoint is fully operational

  Scenario: Workflow file exists in repository
    Given the repository has been cloned
    When I check the file "n8n/workflow.json"
    Then the file exists
    And the file contains valid JSON

  Scenario: Workflow contains Webhook trigger node
    Given the n8n workflow is loaded from "n8n/workflow.json"
    When I inspect the workflow nodes
    Then a node of type "n8n-nodes-base.webhook" exists
    And the webhook path is "oc-config-sync"
    And the webhook HTTP method is "POST"

  Scenario: Workflow contains ConfigBuilder custom node
    Given the n8n workflow is loaded from "n8n/workflow.json"
    When I inspect the workflow nodes
    Then a node of type "n8n-nodes-opencode-config.configBuilder" exists
    And the ConfigBuilder node is connected to the Webhook node output

  Scenario: Workflow produces correct response structure
    Given the n8n workflow is active
    And the Google Sheet contains COPSPA example data
    When I send a POST request to "/webhook/oc-config-sync" with:
      """json
      {
        "plugin_version": "0.1.0",
        "email": "t.wagner@techdivision.com",
        "plugins": ["config", "time-tracking", "jira"],
        "config": {
          "jira": { "project": "COPSPA", "base_url": "https://techdivision.atlassian.net" },
          "time_tracking": { "valid_projects": ["COPSPA"] }
        }
      }
      """
    Then the response status is 200
    And the response body contains a "version" field
    And the response body contains a "config" object
    And "config" contains a "jira" section
    And "config" contains a "time_tracking" section

  Scenario: Workflow is importable into n8n
    Given a running n8n instance
    When I import "n8n/workflow.json" via the n8n UI
    Then the workflow is imported without errors
    And all node types are recognized

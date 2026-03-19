Feature: n8n INodeType Interface Implementation
  As a System (n8n)
  I want the ConfigBuilder node to implement the INodeType interface correctly
  So that n8n can discover, display, and execute the node in workflows

  Background:
    Given the ConfigBuilder node class exists in "n8n/nodes/ConfigBuilder/ConfigBuilder.node.ts"

  Scenario: Node implements INodeType interface
    When I inspect the ConfigBuilder class
    Then it implements the "INodeType" interface from "n8n-workflow"
    And it has a "description" property of type "INodeTypeDescription"
    And it has an "execute" method that returns "Promise<INodeExecutionData[][]>"

  Scenario: Node description declares required credentials
    When I inspect the node description
    Then it declares "googleSheetsApi" credential type
    And it declares a credential type for JIRA API access
    And the credentials are marked as required

  Scenario: Node description declares input parameters
    When I inspect the node description properties
    Then it includes a "projectKey" parameter of type "string"
    And it includes an "email" parameter of type "string"
    And it includes a "pluginVersion" parameter of type "string"
    And it includes a "plugins" parameter for the plugin list
    And it includes a "seedConfig" parameter of type "json"

  Scenario: Node execute method processes webhook payload
    Given a valid webhook payload with project key "COPSPA"
    And email "t.wagner@techdivision.com"
    And plugins ["config", "time-tracking", "jira"]
    When the node execute method is called
    Then it returns a single output item
    And the output item contains a "json" property with the config response
    And the response contains a "version" field
    And the response contains a "config" object

  Scenario: Node is visible in n8n after installation
    Given the npm package "n8n-nodes-opencode-config" is installed in n8n
    When I search for "Config Builder" in the n8n node panel
    Then the ConfigBuilder node appears in the search results
    And it shows the correct icon and description

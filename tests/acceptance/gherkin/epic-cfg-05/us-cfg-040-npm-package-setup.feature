Feature: n8n Custom Node npm Package Setup
  As a System (n8n)
  I want the ConfigBuilder node to be published as npm package n8n-nodes-opencode-config
  So that it can be installed in n8n via npm and discovered as a custom node

  Background:
    Given the n8n custom node package "n8n-nodes-opencode-config" exists in the "n8n/" directory

  Scenario: Package has valid n8n package.json structure
    When I inspect the package.json in "n8n/"
    Then it contains the name "n8n-nodes-opencode-config"
    And it contains "n8n" configuration section with "nodes" array
    And the "nodes" array references "dist/nodes/ConfigBuilder/ConfigBuilder.node.js"
    And it contains "n8n" configuration section with "credentials" array

  Scenario: Package is independent from root package.json
    Given the root package.json exists at the repository root
    When I inspect the package.json in "n8n/"
    Then it has its own independent "dependencies" section
    And it has its own independent "version" field
    And it does not reference the root package.json

  Scenario: Node description file exists with correct metadata
    When I inspect "n8n/nodes/ConfigBuilder/ConfigBuilder.node.json"
    Then it contains a "displayName" field with value "Config Builder"
    And it contains a "name" field with value "configBuilder"
    And it contains a "description" field
    And it contains a "group" field with value "transform"
    And it contains an "icon" field

  Scenario: TypeScript build produces valid output
    Given the TypeScript source files exist in "n8n/nodes/ConfigBuilder/"
    When I run the TypeScript compiler for the n8n package
    Then the compiled output exists in "n8n/dist/nodes/ConfigBuilder/"
    And the output includes "ConfigBuilder.node.js"
    And the output includes source maps

  Scenario: Package files are correctly declared for npm publish
    When I inspect the "files" field in "n8n/package.json"
    Then it includes "dist/" directory
    And it includes the node description JSON file
    And it does not include source TypeScript files

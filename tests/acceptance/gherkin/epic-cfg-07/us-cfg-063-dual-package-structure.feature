Feature: Dual-Package Repository Structure
  As a Developer
  I want to have a correctly configured dual-package structure in the repository
  So that the plugin and n8n node can be published independently from the same repo

  Scenario: Root package.json is configured for the plugin
    Given the repository has been cloned
    When I read "package.json" in the root directory
    Then the package name is "@techdivision/opencode-plugin-config"
    And the "files" array includes "src/"
    And the "files" array includes "skills/"
    And the "files" array includes "schemas/"
    And the "files" array includes "plugin.json"
    And the "files" array does not include "n8n/"

  Scenario: n8n package.json is configured for the custom node
    Given the repository has been cloned
    When I read "n8n/package.json"
    Then the package name is "n8n-nodes-opencode-config"
    And the package contains n8n-specific fields
    And the package contains "n8nNodesType" or equivalent n8n metadata

  Scenario: plugin.json has correct values
    Given the repository has been cloned
    When I read "plugin.json" in the root directory
    Then the name field is "config"
    And the category field is "optional"

  Scenario: Both package.json files are valid
    Given the repository has been cloned
    When I run "npm pack --dry-run" in the root directory
    Then no errors occur
    And the n8n directory is not included in the tarball
    When I run "npm pack --dry-run" in the "n8n" directory
    Then no errors occur
    And only n8n-related files are included

  Scenario: Root and n8n packages do not conflict
    Given the root package.json exists
    And the n8n/package.json exists
    When I compare the two package configurations
    Then they have different package names
    And they can be published to npm independently

  Scenario: Root npm install does not break n8n directory
    Given the repository has been cloned
    When I run "npm install" in the root directory
    Then the installation succeeds
    And the n8n directory is unaffected

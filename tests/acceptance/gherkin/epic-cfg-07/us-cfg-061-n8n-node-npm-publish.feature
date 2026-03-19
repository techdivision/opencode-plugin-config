Feature: n8n Node npm Publish via GitHub Actions
  As a System (CI/CD Pipeline)
  I want to automatically publish the n8n custom node to npm when an n8n version tag is pushed
  So that n8n node updates are available on npm independently from the plugin

  Scenario: Workflow file exists
    Given the repository has been cloned
    When I check the file ".github/workflows/publish-n8n.yml"
    Then the file exists
    And the file contains valid YAML

  Scenario: Workflow triggers on n8n version tags
    Given the workflow file ".github/workflows/publish-n8n.yml" exists
    When I inspect the trigger configuration
    Then the workflow triggers on push to tags matching "n8n-v*"
    And the workflow does not trigger on tags matching "v*" without "n8n-" prefix

  Scenario: Workflow publishes from n8n directory
    Given the workflow file ".github/workflows/publish-n8n.yml" exists
    When I inspect the job steps
    Then the workflow sets the working directory to "n8n"
    And the workflow runs "npm publish --access public" in the n8n directory
    And the npm publish uses "n8n/package.json"

  Scenario: Workflow uses NPM_TOKEN secret
    Given the workflow file ".github/workflows/publish-n8n.yml" exists
    When I inspect the environment configuration
    Then the npm publish step uses secret "NPM_TOKEN" as "NODE_AUTH_TOKEN"

  Scenario: Successful publish on n8n tag push
    Given the workflow triggers on tag "n8n-v0.1.0"
    And the NPM_TOKEN secret is configured
    When the workflow executes
    Then the package "n8n-nodes-opencode-config" is published to npm
    And the workflow exits with status 0

  Scenario: Tag naming prevents cross-triggering
    Given a tag "v0.2.0" is pushed (plugin release)
    When the GitHub Actions workflows are evaluated
    Then "publish.yml" triggers
    But "publish-n8n.yml" does not trigger

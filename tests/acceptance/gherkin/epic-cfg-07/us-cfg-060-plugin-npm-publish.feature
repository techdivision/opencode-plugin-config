Feature: Plugin npm Publish via GitHub Actions
  As a System (CI/CD Pipeline)
  I want to automatically publish the plugin to npm when a version tag is pushed
  So that new plugin releases are available on npm without manual intervention

  Scenario: Workflow file exists
    Given the repository has been cloned
    When I check the file ".github/workflows/publish.yml"
    Then the file exists
    And the file contains valid YAML

  Scenario: Workflow triggers on version tags
    Given the workflow file ".github/workflows/publish.yml" exists
    When I inspect the trigger configuration
    Then the workflow triggers on push to tags matching "v*"
    And the workflow does not trigger on branch pushes

  Scenario: Workflow publishes to npm with correct package
    Given the workflow file ".github/workflows/publish.yml" exists
    When I inspect the job steps
    Then the workflow checks out the repository
    And the workflow sets up Node.js version 20
    And the workflow runs "npm publish --access public"
    And the npm publish uses the root package.json

  Scenario: Workflow uses NPM_TOKEN secret
    Given the workflow file ".github/workflows/publish.yml" exists
    When I inspect the environment configuration
    Then the npm publish step uses secret "NPM_TOKEN" as "NODE_AUTH_TOKEN"

  Scenario: Successful publish on tag push
    Given the workflow triggers on tag "v0.1.0"
    And the NPM_TOKEN secret is configured
    When the workflow executes
    Then the package "@techdivision/opencode-plugin-config" is published to npm
    And the workflow exits with status 0

  Scenario: Workflow is idempotent
    Given the package "@techdivision/opencode-plugin-config@0.1.0" already exists on npm
    When the workflow triggers again on tag "v0.1.0"
    Then the workflow handles the duplicate version gracefully

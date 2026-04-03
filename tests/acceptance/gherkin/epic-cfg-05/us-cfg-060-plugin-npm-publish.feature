Feature: Plugin npm Publish to GitHub Packages via GitHub Actions
  As a System (CI/CD Pipeline)
  I want to automatically publish the plugin to GitHub Packages when a version tag is pushed
  So that new plugin releases are available as private npm packages without manual intervention

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

  Scenario: Workflow publishes to GitHub Packages with correct configuration
    Given the workflow file ".github/workflows/publish.yml" exists
    When I inspect the job steps
    Then the workflow checks out the repository
    And the workflow sets up Node.js version 20
    And the workflow configures registry-url as "https://npm.pkg.github.com/"
    And the workflow runs "npm publish"
    And the npm publish uses the root package.json

  Scenario: Workflow uses GITHUB_TOKEN for authentication
    Given the workflow file ".github/workflows/publish.yml" exists
    When I inspect the environment configuration
    Then the npm publish step uses "GITHUB_TOKEN" as "NODE_AUTH_TOKEN"
    And the workflow has "permissions: packages: write"

  Scenario: package.json has publishConfig for GitHub Packages
    Given the root "package.json" exists
    When I inspect the publishConfig field
    Then the registry is set to "https://npm.pkg.github.com/"

  Scenario: Successful publish on tag push
    Given the workflow triggers on tag "v0.1.0"
    And the GITHUB_TOKEN is available
    When the workflow executes
    Then the package "@techdivision/opencode-plugin-config" is published to GitHub Packages
    And the workflow exits with status 0

  Scenario: Workflow is idempotent
    Given the package "@techdivision/opencode-plugin-config@0.1.0" already exists on GitHub Packages
    When the workflow triggers again on tag "v0.1.0"
    Then the workflow handles the duplicate version gracefully

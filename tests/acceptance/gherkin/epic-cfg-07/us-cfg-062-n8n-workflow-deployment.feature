Feature: n8n Workflow Deployment via GitHub Actions
  As a System (CI/CD Pipeline)
  I want to automatically deploy the n8n workflow when workflow.json changes on main
  So that n8n workflow updates are deployed without manual import

  Scenario: Workflow file exists
    Given the repository has been cloned
    When I check the file ".github/workflows/n8n-deploy.yml"
    Then the file exists
    And the file contains valid YAML

  Scenario: Workflow triggers on workflow.json changes
    Given the workflow file ".github/workflows/n8n-deploy.yml" exists
    When I inspect the trigger configuration
    Then the workflow triggers on push to branch "main"
    And the workflow triggers only when path "n8n/workflow.json" is changed

  Scenario: Workflow does not trigger on other file changes
    Given a commit on main only changes "src/config.ts"
    When the GitHub Actions workflows are evaluated
    Then "n8n-deploy.yml" does not trigger

  Scenario: Workflow imports via n8n API
    Given the workflow file ".github/workflows/n8n-deploy.yml" exists
    When I inspect the job steps
    Then the workflow checks out the repository
    And the workflow sends a POST request to "$N8N_BASE_URL/api/v1/workflows"
    And the request includes header "X-N8N-API-KEY" with the API key
    And the request body is the content of "n8n/workflow.json"

  Scenario: Workflow uses correct secrets
    Given the workflow file ".github/workflows/n8n-deploy.yml" exists
    When I inspect the environment configuration
    Then the deploy step uses secret "N8N_BASE_URL"
    And the deploy step uses secret "N8N_API_KEY"

  Scenario: Successful deployment to n8n instance
    Given the workflow triggers on a change to "n8n/workflow.json" on main
    And the N8N_BASE_URL and N8N_API_KEY secrets are configured
    When the workflow executes
    Then the curl command completes successfully
    And the n8n instance receives the updated workflow

  Scenario: Deployment handles API errors gracefully
    Given the n8n instance is not reachable
    When the deployment workflow executes
    Then the workflow reports the error
    And the workflow exits with a non-zero status

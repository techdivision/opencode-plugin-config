Feature: n8n Setup Documentation
  As a Developer setting up the n8n workflow
  I want to have comprehensive documentation in n8n/README.md
  So that I can configure and run the webhook workflow locally and in production

  Scenario: README file exists
    Given the repository has been cloned
    When I check the file "n8n/README.md"
    Then the file exists
    And the file is non-empty

  Scenario: README documents required environment variables
    Given the file "n8n/README.md" exists
    When I read the documentation
    Then it lists environment variable "JIRA_BASE_URL" with description
    And it lists environment variable "JIRA_EMAIL" with description
    And it lists environment variable "JIRA_API_TOKEN" with description
    And it lists environment variable "GOOGLE_SHEET_ID" with description
    And it lists environment variable "GOOGLE_SERVICE_ACCOUNT_JSON" with description

  Scenario: README documents GitHub Actions secrets
    Given the file "n8n/README.md" exists
    When I read the deployment section
    Then it lists GitHub secret "N8N_BASE_URL" with description
    And it lists GitHub secret "N8N_API_KEY" with description

  Scenario: README documents local development setup
    Given the file "n8n/README.md" exists
    When I read the local development section
    Then it includes instructions for starting n8n locally
    And it includes instructions for importing the workflow
    And it includes a curl test command for the webhook

  Scenario: README documents workflow overview
    Given the file "n8n/README.md" exists
    When I read the overview section
    Then it describes the 5-step workflow process
    And it documents the request payload structure
    And it documents the response structure

  Scenario: README documents Google Sheet structure
    Given the file "n8n/README.md" exists
    When I read the Google Sheet section
    Then it lists all 6 tabs with their column definitions
    And it explains the lookup key for each tab

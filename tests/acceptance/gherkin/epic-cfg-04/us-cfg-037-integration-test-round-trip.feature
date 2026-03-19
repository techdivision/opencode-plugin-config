Feature: Integration Test Full Round-Trip (Plugin + n8n Custom Node)
  As a Plugin-Entwickler
  I want to verify that the full round-trip (Plugin sends request, n8n Custom Node processes, Plugin receives, validates and merges response) works correctly
  So that the Config-Sync architecture is reliable as a whole

  Background:
    Given the config plugin is initialized
    And a local opencode-project.json exists with:
      | Field                | Value                          |
      | jira.project         | TESTPROJ                       |
      | jira.base_url        | https://test.atlassian.net     |
      | time_tracking.enabled | true                          |
    And the shell-env plugin has set process.env.OPENCODE_USER_EMAIL to "dev@example.com"
    And the shell-env plugin has set process.env.OC_CONFIG_SYNC_URL to "http://localhost:5678/oc-config-sync"
    And the n8n ConfigBuilder node is running with mock credentials

  Scenario: Happy Path - Full round-trip with all sources succeeding
    Given the Google Sheet mock returns valid data for all 6 tabs:
      | Tab             | Key Data                                         |
      | User-Projects   | default_issue=TESTPROJ-1, default_account=DEV_ACC |
      | Agent-Defaults  | coordinator=agent_coordinator                     |
      | Tempo-Accounts  | DEV_ACC=12345                                     |
      | Pricing         | claude-sonnet-4-20250514=0.003/0.015                 |
      | Transitions     | start_work=In Progress, complete_work=Done        |
      | Settings        | story_point_field=customfield_10016               |
    And the JIRA API mock returns valid statuses for project "TESTPROJ":
      | Issue Type | Statuses                            |
      | Story      | Open, In Progress, In Review, Done  |
      | Task       | Open, In Progress, Done             |
    When the config plugin executes the full sync flow
    Then the ConfigSyncer sends a POST to the n8n webhook with:
      | Field          | Value              |
      | email          | dev@example.com    |
      | config.jira.project | TESTPROJ      |
      | plugins        | ["jira", "time-tracking"] |
    And the n8n node responds with HTTP 200 and a valid config containing:
      | Section         | Key Fields                           |
      | jira            | workflow.status, transitions, tempo_accounts |
      | time_tracking   | default_issue, pricing, agent_defaults |
    And the SchemaValidator accepts both sections
    And the ConfigMerger produces a final config with remote as base and local overrides
    And process.env.OPENCODE_PROJECT_CONFIG contains valid JSON
    And the parsed config contains jira.workflow.status with normalized status keys
    And the parsed config contains time_tracking.pricing with model prices
    And the parsed config contains jira.project = "TESTPROJ" from local config

  Scenario: Partial Failure - JIRA API unreachable, Sheet data still delivered
    Given the Google Sheet mock returns valid data for all 6 tabs
    And the JIRA API mock is unreachable (connection timeout)
    When the config plugin executes the full sync flow
    Then the n8n node responds with HTTP 200
    And the response contains time_tracking section with valid data
    And the response contains jira section without workflow.status (only Sheet-based data)
    And the SchemaValidator validates the time_tracking section successfully
    And the SchemaValidator skips or validates the partial jira section
    And the ConfigMerger produces a final config
    And process.env.OPENCODE_PROJECT_CONFIG contains valid JSON
    And the parsed config contains time_tracking data from remote
    And the parsed config contains jira.project from local config

  Scenario: Schema validation rejects invalid jira section
    Given the Google Sheet mock returns valid data for all 6 tabs
    And the JIRA API mock returns valid statuses
    But the n8n node response contains an invalid jira section:
      | Field                      | Value              |
      | jira.workflow.status       | "not-an-object"    |
    And the n8n node response contains a valid time_tracking section
    When the config plugin executes the full sync flow
    Then the SchemaValidator rejects the jira section with a validation error
    And the SchemaValidator accepts the time_tracking section
    And a warning is logged for the skipped jira section
    And the ConfigMerger merges only the valid time_tracking section with local config
    And process.env.OPENCODE_PROJECT_CONFIG contains valid JSON
    And the parsed config contains time_tracking data from remote
    And the parsed config does not contain remote jira.workflow.status
    And the parsed config contains jira.project from local config

  Scenario: Version conflict - n8n response version too high
    Given the Google Sheet mock returns valid data for all 6 tabs
    And the JIRA API mock returns valid statuses
    And the n8n node responds with version "99.0.0"
    When the config plugin executes the full sync flow
    Then the ConfigSyncer detects a version incompatibility
    And the entire remote response is discarded
    And a warning is logged about the version conflict
    And the ConfigMerger uses only the local config
    And process.env.OPENCODE_PROJECT_CONFIG contains valid JSON
    And the parsed config contains jira.project = "TESTPROJ" from local config
    And the parsed config does not contain any remote-only fields

  Scenario: Local override wins in deep-merge
    Given the Google Sheet mock returns valid data with:
      | Section              | Field             | Remote Value         |
      | time_tracking        | default_issue     | TESTPROJ-99          |
      | jira                 | base_url          | https://remote.atlassian.net |
    And the JIRA API mock returns valid statuses
    And the local config contains:
      | Field                      | Local Value                    |
      | time_tracking.default_issue | TESTPROJ-1                    |
      | jira.base_url              | https://test.atlassian.net     |
    When the config plugin executes the full sync flow
    Then the ConfigMerger deep-merges remote (base) with local (override)
    And process.env.OPENCODE_PROJECT_CONFIG contains valid JSON
    And the parsed config contains time_tracking.default_issue = "TESTPROJ-1" (local wins)
    And the parsed config contains jira.base_url = "https://test.atlassian.net" (local wins)
    And the parsed config contains remote-only fields that were not overridden locally

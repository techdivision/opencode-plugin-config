Feature: Set process.env.OPENCODE_PROJECT_CONFIG
  As a System (config plugin)
  I want to write the final merged config as a JSON string to process.env.OPENCODE_PROJECT_CONFIG
  So that downstream plugins can read the config from memory without file I/O

  Scenario: Final config is written as JSON string to process.env
    Given the ConfigMerger produces a final config:
      """
      {
        "jira": { "project": "COPSPA", "base_url": "https://techdivision.atlassian.net" },
        "time_tracking": { "csv_file": ".opencode/tt.csv" }
      }
      """
    When the config plugin writes to process.env
    Then process.env.OPENCODE_PROJECT_CONFIG is defined
    And JSON.parse(process.env.OPENCODE_PROJECT_CONFIG) equals the final config
    And the value is a valid JSON string

  Scenario: No file is written to disk
    Given the ConfigMerger produces a final config
    When the config plugin writes to process.env
    Then no file write operation occurs for the config output
    And the local "opencode-project.json" files remain unchanged
    And process.env.OPENCODE_PROJECT_CONFIG contains the config

  Scenario: Downstream plugin reads config from process.env
    Given process.env.OPENCODE_PROJECT_CONFIG contains:
      """
      {
        "jira": { "project": "COPSPA" },
        "time_tracking": { "valid_projects": ["COPSPA"] }
      }
      """
    When a downstream plugin reads process.env.OPENCODE_PROJECT_CONFIG
    And parses it with JSON.parse
    Then the parsed object contains "jira.project" with value "COPSPA"
    And the parsed object contains "time_tracking.valid_projects" as an array

  Scenario: Config with special characters is serialized correctly
    Given the ConfigMerger produces a final config with:
      | Field | Value |
      | jira.workflow.status.open.name | "Offen" |
      | time_tracking.pricing.default.input | 3 |
      | jira.tempo.accounts.TD_KS_1165_CoP_SPA.value | "1165 \| CoP Smart Process Automation SPA" |
    When the config plugin writes to process.env
    Then JSON.parse(process.env.OPENCODE_PROJECT_CONFIG) preserves all values
    And unicode characters are correctly encoded
    And pipe characters in values are preserved

Feature: Filter Unknown Sections
  As a System (SchemaValidator)
  I want to filter out sections that do not correspond to any recognized plugin
  So that only sections from installed plugins are included in the config merge

  Background:
    Given the SchemaValidator service is initialized
    And the following plugins are discovered:
      | pluginName    |
      | time-tracking |
      | config        |
      | marp          |

  Scenario: Known section is kept
    Given the response contains section "time_tracking"
    When unknown sections are filtered
    Then the section "time_tracking" is kept

  Scenario: Unknown section is removed
    Given the response contains section "unknown_plugin"
    When unknown sections are filtered
    Then the section "unknown_plugin" is removed
    And a warning is logged containing "unknown_plugin" and "not recognized"

  Scenario: Mix of known and unknown sections
    Given the response contains sections:
      | section         |
      | time_tracking   |
      | config          |
      | evil_plugin     |
      | another_unknown |
    When unknown sections are filtered
    Then the following sections are kept:
      | section       |
      | time_tracking |
      | config        |
    And the following sections are removed:
      | section         |
      | evil_plugin     |
      | another_unknown |

  Scenario: Section key mapping uses hyphen-to-underscore conversion
    Given the plugin "time-tracking" is discovered
    And the response contains section "time_tracking"
    When unknown sections are filtered
    Then the section "time_tracking" is recognized as belonging to plugin "time-tracking"
    And the section is kept

  Scenario: All sections are unknown
    Given the response contains only sections not matching any discovered plugin:
      | section         |
      | evil_plugin     |
      | another_unknown |
    When unknown sections are filtered
    Then the validated config contains no sections
    And warnings are logged for each unknown section

  Scenario: Empty response config
    Given the response config object is empty
    When unknown sections are filtered
    Then the validated config contains no sections
    And no warnings are logged

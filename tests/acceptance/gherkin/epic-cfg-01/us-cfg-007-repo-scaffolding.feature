Feature: Repository Initialization and Project Scaffolding
  As a Plugin-Entwickler
  I want to have a fully initialized repository with all configuration files,
    directory structure, and dependencies
  So that I can start implementing the Config-Plugin services immediately

  Scenario: package.json exists with correct fields
    Given the repository root directory exists
    When I read the file "package.json"
    Then the file exists
    And the JSON field "name" is "@techdivision/opencode-plugin-config"
    And the JSON field "type" is "module"
    And the JSON field "main" is "src/config.ts"
    And the JSON field "opencode.plugin" is true
    And the JSON field "dependencies" contains "@opencode-ai/plugin"
    And the JSON field "dependencies" contains "deepmerge"
    And the JSON field "dependencies" contains "ajv"
    And the JSON field "dependencies" contains "ajv-formats"
    And the JSON field "devDependencies" contains "@types/bun"
    And the JSON field "devDependencies" contains "@types/node"
    And the JSON field "devDependencies" contains "typescript"
    And the JSON field "devDependencies" contains "vitest"
    And the JSON field "devDependencies" contains "@cucumber/cucumber"

  Scenario: plugin.json exists with correct metadata
    Given the repository root directory exists
    When I read the file "plugin.json"
    Then the file exists
    And the JSON field "name" is "config"
    And the JSON field "category" is "optional"
    And the JSON field "version" is "0.1.0"
    And the JSON field "configSchema" is "schemas/config.schema.json"

  Scenario: tsconfig.json exists with correct compiler options
    Given the repository root directory exists
    When I read the file "tsconfig.json"
    Then the file exists
    And the JSON field "compilerOptions.strict" is true
    And the JSON field "compilerOptions.module" is "ESNext"
    And the JSON field "compilerOptions.target" is "ESNext"
    And the JSON field "compilerOptions.noEmit" is true
    And the JSON field "compilerOptions" does not contain key "experimentalDecorators"

  Scenario: vitest.config.ts exists with test configuration
    Given the repository root directory exists
    When I read the file "vitest.config.ts"
    Then the file exists
    And the file contains the pattern "tests/unit/"
    And the file contains the pattern "tests/integration/"

  Scenario: .gitignore exists with required excludes
    Given the repository root directory exists
    When I read the file ".gitignore"
    Then the file exists
    And the file contains "node_modules/"
    And the file contains "tmp/"
    And the file contains ".env"

  Scenario: .env.example exists with required variables
    Given the repository root directory exists
    When I read the file ".env.example"
    Then the file exists
    And the file contains "OC_CONFIG_SYNC_URL"
    And the file contains "OC_CONFIG_SYNC_TOKEN"
    And the file contains "OPENCODE_USER_EMAIL"

  Scenario: Config schema file exists
    Given the repository root directory exists
    When I read the file "schemas/config.schema.json"
    Then the file exists
    And the file is valid JSON
    And the JSON field "$schema" contains "json-schema.org"
    And the JSON field "type" is "object"

  Scenario: Directory structure is complete
    Given the repository root directory exists
    Then the directory "src/services" exists
    And the directory "src/services/interfaces" exists
    And the directory "src/types" exists
    And the directory "src/utils" exists
    And the directory "tests/unit" exists
    And the directory "tests/unit/services" exists
    And the directory "tests/integration" exists
    And the directory "tests/acceptance" exists
    And the directory "tests/acceptance/gherkin" exists
    And the directory "schemas" exists
    And the directory "skills" exists

/**
 * Plugin Configuration Types
 *
 * Type definitions and constants for the config cascade.
 */

/**
 * Protected top-level fields that are never overwritten by remote config.
 * These fields preserve local config integrity (schema reference, version tracking).
 */
export const PROTECTED_FIELDS: readonly string[] = ['$schema', 'version'] as const

/**
 * Global config file path relative to user home directory.
 */
export const GLOBAL_CONFIG_PATH = '.config/opencode/opencode-project.json'

/**
 * Project config file path relative to project root.
 */
export const PROJECT_CONFIG_PATH = '.opencode/opencode-project.json'

/**
 * Regex pattern for environment variable placeholders.
 * Matches {env:VARIABLE_NAME} patterns in string values.
 */
export const ENV_VAR_PATTERN = /\{env:([^}]+)\}/g

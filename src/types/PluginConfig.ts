/**
 * Type definitions and constants for the config cascade.
 *
 * @remarks
 * Defines paths, patterns and constants used across all config services.
 * These are the shared building blocks that ConfigLoader, ConfigMerger
 * and the entry point rely on.
 *
 * @see ConfigLoader - Uses paths and patterns
 * @see ConfigMerger - Uses PROTECTED_FIELDS
 */

/**
 * Protected top-level fields that are never overwritten by remote config.
 *
 * @remarks
 * These fields preserve local config integrity:
 * - `$schema`: JSON Schema reference for IDE validation
 * - `version`: Config version for compatibility tracking
 *
 * Used by {@link ConfigMerger.mergeWithProtectedFields} during the final
 * merge (Remote+Local) to ensure remote config cannot override these fields.
 *
 * @example
 * ```typescript
 * merger.mergeWithProtectedFields(remoteConfig, localConfig, PROTECTED_FIELDS)
 * ```
 */
export const PROTECTED_FIELDS: readonly string[] = ['$schema', 'version'] as const

/**
 * Global config file path relative to user home directory.
 *
 * @remarks
 * Resolves to `~/.config/opencode/opencode-project.json`.
 * This is the Layer 1 (base) of the config cascade.
 */
export const GLOBAL_CONFIG_PATH = '.config/opencode/opencode-project.json'

/**
 * Project config file path relative to project root.
 *
 * @remarks
 * Resolves to `<project>/.opencode/opencode-project.json`.
 * This is the Layer 2 (override) of the config cascade.
 */
export const PROJECT_CONFIG_PATH = '.opencode/opencode-project.json'

/**
 * Regex pattern for environment variable placeholders.
 *
 * @remarks
 * Matches `{env:VARIABLE_NAME}` patterns in string values.
 * Used by {@link ConfigLoader.resolveEnvVars} to replace placeholders
 * with values from `process.env` (set by the shell-env plugin).
 *
 * @example
 * ```typescript
 * const match = '{env:OC_CONFIG_SYNC_URL}'.match(ENV_VAR_PATTERN)
 * // match[1] = 'OC_CONFIG_SYNC_URL'
 * ```
 */
export const ENV_VAR_PATTERN = /\{env:([^}]+)\}/g

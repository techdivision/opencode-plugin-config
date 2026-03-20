/**
 * Interface for the SchemaValidator service.
 *
 * @remarks
 * Validates the structural integrity of webhook responses and performs
 * Ajv-based section-level validation against plugin JSON schemas.
 * This is the validation pipeline in EPIC-CFG-03 (Schema Validation):
 *
 * 1. **Structural validation** (US-CFG-020): validates the raw webhook response
 * 2. **Schema resolution** (US-CFG-021): resolves JSON schema files from plugins
 * 3. **Section validation** (US-CFG-022): validates each section against its schema
 *
 * Structural validation checks:
 * - Response is a JSON object (not null, not array)
 * - `version` field exists and is a string
 * - `config` field exists and is an object
 *
 * Section validation:
 * - Wraps section data as `{ [sectionKey]: sectionData }` before validation
 * - Uses Ajv with `allErrors: true` and `strict: false`
 * - Registers `ajv-formats` for format keywords (e.g. `uri`)
 *
 * Implements Graceful Degradation: returns an empty config `{}`
 * instead of throwing on invalid input.
 *
 * @see ValidatedConfig - The validated config type returned on success
 * @see SyncResponse - The expected response structure
 * @see PluginDescriptor - Plugin metadata for section-level validation
 * @see SectionValidationResult - Result of per-section validation
 */
import type { SyncResponse } from '../types/SyncResponse.js'
import type { PluginDescriptor } from '../types/PluginDescriptor.js'
import type { ValidatedConfig } from '../types/ValidatedConfig.js'
import type { SectionValidationResult } from '../types/SectionValidationResult.js'

export interface SchemaValidatorInterface {
  /**
   * Validate a webhook response and extract the config section.
   *
   * @remarks
   * Performs structural validation, then validates each config section
   * against its plugin schema (if available). Only sections that pass
   * schema validation are included in the result. Sections without a
   * schema are accepted without validation (for US-CFG-024).
   *
   * @param response - The raw webhook response to validate
   * @param plugins - Installed plugin descriptors for section-level validation
   * @returns The validated config object, or `{}` if validation fails
   *
   * @example
   * ```typescript
   * const validator = new SchemaValidator(logger)
   * const config = validator.validateResponse(
   *   { version: '0.1.0', config: { jira: { project: 'COPSPA' } } },
   *   [{ name: 'config', version: '0.1.0', configSchema: null, path: '/path' }]
   * )
   * // config === { jira: { project: 'COPSPA' } }
   * ```
   */
  validateResponse(response: SyncResponse, plugins: PluginDescriptor[]): ValidatedConfig

  /**
   * Validate a single config section against its JSON schema using Ajv.
   *
   * @remarks
   * Wraps the section data as `{ [sectionKey]: sectionData }` before
   * validation, because the schema defines the section as a property
   * of a root object.
   *
   * Uses Ajv with `allErrors: true` to report all validation errors
   * at once, and `strict: false` for flexibility between schema drafts.
   *
   * @param sectionKey - The config section key (e.g. `"time_tracking"`)
   * @param sectionData - The section data to validate
   * @param schema - The JSON schema to validate against
   * @returns Validation result with `valid` flag and optional error messages
   *
   * @example
   * ```typescript
   * const result = validator.validateSection('time_tracking', { csv_file: 'tt.csv' }, schema)
   * // result.valid === true
   * ```
   */
  validateSection(sectionKey: string, sectionData: unknown, schema: object): SectionValidationResult

  /**
   * Build a map of section keys to JSON schema objects from plugin descriptors.
   *
   * @remarks
   * Iterates over all plugin descriptors and resolves their JSON schema files
   * from disk. Plugins without a `configSchema` are silently skipped.
   * Schema files that cannot be read or parsed produce a warning and are skipped
   * (Graceful Degradation).
   *
   * @param plugins - Installed plugin descriptors with optional schema paths
   * @returns A map of section keys (e.g. `"time_tracking"`) to parsed JSON schema objects
   *
   * @example
   * ```typescript
   * const schemaMap = validator.buildSchemaMap([
   *   { name: 'time-tracking', version: '1.0.0', configSchema: 'schemas/config.schema.json', path: '/plugins/tt' },
   *   { name: 'shell-env', version: '1.0.0', configSchema: null, path: '/plugins/se' },
   * ])
   * // schemaMap.size === 1
   * // schemaMap.get('time_tracking') === { type: 'object', ... }
   * ```
   */
  buildSchemaMap(plugins: PluginDescriptor[]): Map<string, object>

  /**
   * Derive a config section key from a plugin name.
   *
   * @remarks
   * Replaces all hyphens with underscores to produce a valid
   * configuration section key.
   *
   * @param pluginName - The plugin name (e.g. `"time-tracking"`)
   * @returns The section key (e.g. `"time_tracking"`)
   */
  deriveSectionKey(pluginName: string): string

  /**
   * Filter out config sections that do not correspond to any discovered plugin.
   *
   * @remarks
   * Derives known section keys from plugin names using hyphen-to-underscore
   * conversion. Sections whose keys do not match any known plugin are removed
   * and a warning is logged for each removed section.
   *
   * @param config - The config object with section keys
   * @param plugins - Discovered plugin descriptors
   * @returns A new config object containing only sections matching known plugins
   *
   * @example
   * ```typescript
   * const filtered = validator.filterUnknownSections(
   *   { time_tracking: { csv_file: 'tt.csv' }, evil_plugin: { key: 'val' } },
   *   [{ name: 'time-tracking', version: '1.0.0', configSchema: null, path: '/p' }]
   * )
   * // filtered === { time_tracking: { csv_file: 'tt.csv' } }
   * ```
   */
  filterUnknownSections(config: Record<string, unknown>, plugins: PluginDescriptor[]): Record<string, unknown>
}

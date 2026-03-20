/**
 * Validates the structural integrity of webhook responses, resolves
 * plugin JSON schemas from disk, and performs Ajv-based section validation.
 *
 * @remarks
 * Implements four validation steps in EPIC-CFG-03 (Schema Validation):
 *
 * 1. **Structural validation** (US-CFG-020): validates the raw webhook response
 *    before it enters the config merge pipeline.
 *
 * 2. **Schema resolution** (US-CFG-021): resolves JSON schema files from
 *    PluginDescriptor metadata to build a schema map for section-level validation.
 *
 * 3. **Unknown section filtering** (US-CFG-025): filters out config sections
 *    that do not correspond to any discovered plugin.
 *
 * 4. **Section validation** (US-CFG-022): validates each config section against
 *    its plugin schema using Ajv with allErrors mode and ajv-formats.
 *
 * Validation checks for structural validation (in order):
 * 1. Response is a non-null object (not an array, not a primitive)
 * 2. `version` field exists and is a string
 * 3. `config` field exists and is a non-null, non-array object
 *
 * Schema resolution:
 * - Iterates over PluginDescriptors and loads their JSON schema files
 * - Derives section keys from plugin names (hyphens → underscores)
 * - Gracefully handles missing or invalid schema files with warnings
 *
 * Section validation:
 * - Wraps section data as `{ [sectionKey]: sectionData }` before validation
 * - Uses Ajv with `allErrors: true` to report all errors at once
 * - Uses `strict: false` for flexibility between schema drafts
 * - Registers `ajv-formats` for format keywords (e.g. `uri`)
 *
 * Implements Graceful Degradation: on any validation or resolution failure,
 * logs a warning and skips the affected item instead of throwing.
 *
 * @see SchemaValidatorInterface - Interface definition
 * @see SyncResponse - The expected response structure
 * @see ValidatedConfig - The validated config type returned on success
 * @see PluginDescriptor - Plugin metadata with optional schema path
 * @see SectionValidationResult - Result of per-section validation
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import Ajv from 'ajv'
import addFormats from 'ajv-formats'

import type { SchemaValidatorInterface } from '../interfaces/SchemaValidatorInterface.js'
import type { SyncResponse } from '../types/SyncResponse.js'
import type { PluginDescriptor } from '../types/PluginDescriptor.js'
import type { ValidatedConfig } from '../types/ValidatedConfig.js'
import type { SectionValidationResult } from '../types/SectionValidationResult.js'
import type { PluginLoggerInterface } from '../interfaces/PluginLoggerInterface.js'

export class SchemaValidator implements SchemaValidatorInterface {
  /**
   * Singleton Ajv instance configured with allErrors and ajv-formats.
   *
   * @remarks
   * Created once in the constructor to avoid per-call overhead.
   * `allErrors: true` ensures all validation errors are reported at once.
   * `strict: false` provides flexibility between JSON Schema drafts.
   */
  private readonly ajv: Ajv

  /**
   * @param logger - SDK logger for warning messages on validation failures (Explicit Constructor Injection)
   */
  constructor(private readonly logger: PluginLoggerInterface) {
    this.ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(this.ajv)
  }

  /**
   * Validate a webhook response and extract the config section.
   *
   * @remarks
   * Performs structural validation first, then filters unknown sections,
   * then validates each remaining config section against its plugin schema
   * (if available). Only sections that pass schema validation are included
   * in the result. Sections without a schema are accepted without validation
   * (for US-CFG-024).
   *
   * Pipeline order: Structure → Filter → Schema Validation
   *
   * @param response - The raw webhook response to validate
   * @param plugins - Installed plugin descriptors for section-level validation
   * @returns The validated config object, or `{}` if validation fails
   */
  public validateResponse(response: SyncResponse, plugins: PluginDescriptor[]): ValidatedConfig {
    let config: ValidatedConfig

    try {
      config = this.validateResponseStructure(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Response structure validation failed: ${message}`)
      return {}
    }

    const filteredConfig = this.filterUnknownSections(config, plugins)

    const schemaMap = this.buildSchemaMap(plugins)

    return this.validateSections(filteredConfig, schemaMap)
  }

  /**
   * Filter out config sections that do not correspond to any discovered plugin.
   *
   * @remarks
   * Derives known section keys from plugin names using {@link deriveSectionKey}
   * (hyphen-to-underscore conversion). Sections whose keys do not match any
   * known plugin are removed and a warning is logged for each removed section.
   *
   * @param config - The config object with section keys
   * @param plugins - Discovered plugin descriptors
   * @returns A new config object containing only sections matching known plugins
   */
  public filterUnknownSections(config: Record<string, unknown>, plugins: PluginDescriptor[]): Record<string, unknown> {
    const knownKeys = new Set(
      plugins.map((plugin) => this.deriveSectionKey(plugin.name)),
    )

    const filtered: Record<string, unknown> = {}

    for (const [sectionKey, sectionData] of Object.entries(config)) {
      if (knownKeys.has(sectionKey)) {
        filtered[sectionKey] = sectionData
      } else {
        this.logger.warn(
          `Section "${sectionKey}" is not recognized as a known plugin section and was removed`,
        )
      }
    }

    return filtered
  }

  /**
   * Validate a single config section against its JSON schema using Ajv.
   *
   * @remarks
   * Wraps the section data as `{ [sectionKey]: sectionData }` before
   * validation, because the schema defines the section as a property
   * of a root object. Compiles the schema and validates the wrapped data.
   *
   * @param sectionKey - The config section key (e.g. `"time_tracking"`)
   * @param sectionData - The section data to validate
   * @param schema - The JSON schema to validate against
   * @returns Validation result with `valid` flag and optional error messages
   */
  public validateSection(sectionKey: string, sectionData: unknown, schema: object): SectionValidationResult {
    const wrapped = { [sectionKey]: sectionData }
    const cleanedSchema = this.removeSchemaDialect(schema)
    const validate = this.ajv.compile(cleanedSchema)
    const isValid = validate(wrapped)

    if (isValid) {
      return { valid: true }
    }

    const errors = (validate.errors ?? []).map(
      (err) => `${err.instancePath} ${err.message ?? 'unknown error'}`,
    )

    return { valid: false, errors }
  }

  /**
   * Build a map of section keys to JSON schema objects from plugin descriptors.
   *
   * @remarks
   * For each plugin with a non-null `configSchema`:
   * 1. Composes the schema file path: `path.join(descriptor.path, descriptor.configSchema)`
   * 2. Derives the section key: `descriptor.name` with hyphens replaced by underscores
   * 3. Reads and parses the JSON schema file from disk
   *
   * Plugins without `configSchema` are silently skipped.
   * Schema files that cannot be read produce a "schema file not found" warning.
   * Schema files with invalid JSON produce an "invalid schema JSON" warning.
   *
   * @param plugins - Installed plugin descriptors with optional schema paths
   * @returns A map of section keys to parsed JSON schema objects
   */
  public buildSchemaMap(plugins: PluginDescriptor[]): Map<string, object> {
    const schemaMap = new Map<string, object>()

    for (const plugin of plugins) {
      if (plugin.configSchema === null) {
        continue
      }

      const sectionKey = this.deriveSectionKey(plugin.name)
      const schemaPath = path.join(plugin.path, plugin.configSchema)

      try {
        const content = readFileSync(schemaPath, 'utf-8')
        const schema = this.parseSchemaContent(content, plugin.name)
        if (schema !== null) {
          schemaMap.set(sectionKey, schema)
        }
      } catch {
        this.logger.warn(
          `Plugin "${plugin.name}": schema file not found at ${schemaPath}`,
        )
      }
    }

    return schemaMap
  }

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
  public deriveSectionKey(pluginName: string): string {
    return pluginName.replace(/-/g, '_')
  }

  /**
   * Validate the structural integrity of a raw webhook response.
   *
   * @remarks
   * Performs three sequential checks:
   * 1. Input must be a non-null, non-array object
   * 2. `version` field must exist and be a string
   * 3. `config` field must exist and be a non-null, non-array object
   *
   * @param raw - The raw input to validate (may be any type at runtime)
   * @returns The `config` object extracted from the valid response
   * @throws Error with a descriptive message if any check fails
   */
  private validateResponseStructure(raw: unknown): ValidatedConfig {
    if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
      if (Array.isArray(raw)) {
        throw new Error('Response must be a JSON object, not an array')
      }
      throw new Error('Response contains invalid JSON: expected an object')
    }

    const response = raw as Record<string, unknown>

    if (!('version' in response) || typeof response.version !== 'string') {
      throw new Error('Response is missing required "version" field (must be a string)')
    }

    if (!('config' in response)) {
      throw new Error('Response is missing required "config" field')
    }

    if (
      response.config === null
      || typeof response.config !== 'object'
      || Array.isArray(response.config)
    ) {
      throw new Error('Response config must be an object')
    }

    return response.config as ValidatedConfig
  }

  /**
   * Validate all sections in the config against their schemas.
   *
   * @remarks
   * For each section in the config:
   * - If a schema exists in the map: validate with `validateSection()`
   * - If no schema exists: accept the section without validation (for US-CFG-024)
   * - If validation fails: log a warning and exclude the section
   *
   * @param config - The structurally validated config object
   * @param schemaMap - Map of section keys to JSON schemas
   * @returns Config containing only sections that passed validation
   */
  private validateSections(config: ValidatedConfig, schemaMap: Map<string, object>): ValidatedConfig {
    const validatedConfig: ValidatedConfig = {}

    for (const [sectionKey, sectionData] of Object.entries(config)) {
      const schema = schemaMap.get(sectionKey)

      if (schema === undefined) {
        this.logger.info(
          `Section "${sectionKey}" has no schema — accepted without validation`,
        )
        validatedConfig[sectionKey] = sectionData
        continue
      }

      const result = this.validateSection(sectionKey, sectionData, schema)

      if (result.valid) {
        validatedConfig[sectionKey] = sectionData
      } else {
        this.logger.warn(
          `Section "${sectionKey}" failed schema validation: ${result.errors?.join('; ') ?? 'unknown error'}`,
        )
      }
    }

    return validatedConfig
  }

  /**
   * Parse a JSON string as a schema object.
   *
   * @param content - The raw file content to parse
   * @param pluginName - The plugin name for error messages
   * @returns The parsed schema object, or `null` if parsing fails
   */
  private parseSchemaContent(content: string, pluginName: string): object | null {
    try {
      return JSON.parse(content) as object
    } catch {
      this.logger.warn(
        `Plugin "${pluginName}": invalid schema JSON`,
      )
      return null
    }
  }

  /**
   * Remove the `$schema` dialect identifier from a JSON Schema object.
   *
   * @remarks
   * Ajv 8 does not natively support JSON Schema draft/2020-12. When a schema
   * file declares `$schema: "https://json-schema.org/draft/2020-12/schema"`,
   * Ajv throws "no schema with key or ref". Removing the `$schema` field
   * allows Ajv to validate the schema using its default draft-07 behavior,
   * which is compatible with the subset of features used in plugin schemas.
   *
   * @param schema - The original JSON Schema object (may contain `$schema`)
   * @returns A shallow copy without the `$schema` field
   */
  private removeSchemaDialect(schema: object): object {
    const { $schema, ...rest } = schema as Record<string, unknown>
    return rest
  }
}

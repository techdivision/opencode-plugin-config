/**
 * Synchronizes local config with a remote webhook endpoint.
 *
 * @remarks
 * Implements the ConfigSyncerInterface for webhook-based config synchronization.
 * This class resolves the sync_url and sync_token from the already env-resolved
 * local config, with fallback to process.env environment variables.
 *
 * Resolution cascade for sync_url:
 * 1. `localConfig.config.sync_url` — already env-resolved by ConfigLoader
 * 2. `process.env.OC_CONFIG_SYNC_URL` — fallback
 * 3. `null` — no webhook, skip sync
 *
 * Resolution cascade for sync_token:
 * 1. `localConfig.config.sync_token` — already env-resolved by ConfigLoader
 * 2. `process.env.OC_CONFIG_SYNC_TOKEN` — fallback
 * 3. `null` — no token, request without Authorization header
 *
 * Design decisions:
 * - Does NOT perform its own `{env:VAR}` resolution — ConfigLoader has already done that
 * - Detects unresolved `{env:...}` placeholders and treats them as absent (null)
 * - `logger` is injected via constructor (stable dependency)
 * - `localConfig` is a method parameter (changes per call)
 *
 * @see ConfigSyncerInterface - Interface definition
 * @see ConfigLoader - Provides the already env-resolved localConfig
 * @see SyncPayload - The webhook request payload (US-CFG-011)
 * @see SyncResponse - The webhook response (US-CFG-011)
 */
import type { ConfigSyncerInterface } from '../interfaces/ConfigSyncerInterface.js'
import type { SyncPayload } from '../types/SyncPayload.js'
import type { SyncResponse } from '../types/SyncResponse.js'
import type { PluginLogger } from '../utils/logger.js'

/**
 * Regex pattern to detect unresolved `{env:VAR}` placeholders.
 *
 * @remarks
 * When ConfigLoader cannot resolve an env var (because it's not set),
 * the placeholder is preserved as-is in the config value.
 * ConfigSyncer detects these unresolved placeholders and treats them as absent.
 */
const UNRESOLVED_ENV_PATTERN = /\{env:[^}]+\}/

export class ConfigSyncer implements ConfigSyncerInterface {
  /**
   * @param logger - Optional SDK logger for debug/warning messages (Explicit Constructor Injection)
   */
  constructor(private readonly logger?: PluginLogger) {}

  /**
   * Resolve the sync webhook URL from the local config or process.env.
   *
   * @remarks
   * Cascade:
   * 1. `localConfig.config.sync_url` (already env-resolved by ConfigLoader)
   * 2. `process.env.OC_CONFIG_SYNC_URL` (fallback)
   * 3. `null` (no webhook URL available — skip sync)
   *
   * Unresolved `{env:...}` placeholders are treated as absent (null),
   * because ConfigLoader preserves them when the env var is not set.
   *
   * @param localConfig - The fully resolved local config (Global + Project merged, env-resolved)
   * @returns The resolved sync URL, or `null` if no URL is available
   */
  private resolveSyncUrl(localConfig: Record<string, unknown>): string | null {
    const configSection = this.extractConfigSection(localConfig)
    const syncUrl = configSection?.sync_url as string | undefined

    if (syncUrl && !this.isUnresolvedEnvPlaceholder(syncUrl)) {
      return syncUrl
    }

    return process.env.OC_CONFIG_SYNC_URL ?? null
  }

  /**
   * Resolve the sync authentication token from the local config or process.env.
   *
   * @remarks
   * Cascade:
   * 1. `localConfig.config.sync_token` (already env-resolved by ConfigLoader)
   * 2. `process.env.OC_CONFIG_SYNC_TOKEN` (fallback)
   * 3. `null` (no token — request without Authorization header, which is OK)
   *
   * Unresolved `{env:...}` placeholders are treated as absent (null).
   *
   * @param localConfig - The fully resolved local config (Global + Project merged, env-resolved)
   * @returns The resolved sync token, or `null` if no token is available
   */
  private resolveSyncToken(localConfig: Record<string, unknown>): string | null {
    const configSection = this.extractConfigSection(localConfig)
    const syncToken = configSection?.sync_token as string | undefined

    if (syncToken && !this.isUnresolvedEnvPlaceholder(syncToken)) {
      return syncToken
    }

    return process.env.OC_CONFIG_SYNC_TOKEN ?? null
  }

  /**
   * Assemble the webhook payload from the provided parameters.
   *
   * @remarks
   * Maps the caller-provided parameters into the SyncPayload structure
   * expected by the n8n webhook endpoint. All values are passed through
   * as-is — no transformation or validation is performed here.
   *
   * The email parameter is expected to come from `process.env.OPENCODE_USER_EMAIL`,
   * resolved by the entry point before calling this method.
   *
   * @param localConfig - The fully resolved local config (Global + Project merged, env-resolved)
   * @param pluginNames - Names of all installed plugins from `discoverPlugins()`
   * @param pluginVersion - Semantic version of this plugin from PluginDescriptor
   * @param email - User email from `process.env.OPENCODE_USER_EMAIL`
   * @returns The assembled SyncPayload ready for JSON serialization
   *
   * @see SyncPayload - The payload type definition
   */
  private buildPayload(
    localConfig: Record<string, unknown>,
    pluginNames: string[],
    pluginVersion: string,
    email: string,
  ): SyncPayload {
    return {
      plugin_version: pluginVersion,
      email,
      plugins: pluginNames,
      config: localConfig,
    }
  }

  /**
   * Synchronize local config with the remote webhook.
   *
   * @remarks
   * Stub implementation — full logic will be added in US-CFG-014.
   *
   * @param _localConfig - The fully resolved local config
   * @param _pluginNames - Names of all installed plugins
   * @param _pluginVersion - Semantic version of this plugin
   * @returns Always `null` (not yet implemented)
   */
  public async syncConfig(
    _localConfig: Record<string, unknown>,
    _pluginNames: string[],
    _pluginVersion: string,
  ): Promise<SyncResponse | null> {
    return null
  }

  /**
   * Extract the `config` section from the local config object.
   *
   * @remarks
   * Safely extracts `localConfig.config` as a Record, returning `undefined`
   * if the section does not exist or is not an object.
   *
   * @param localConfig - The full local config object
   * @returns The config section as a Record, or `undefined`
   */
  private extractConfigSection(localConfig: Record<string, unknown>): Record<string, unknown> | undefined {
    const configSection = localConfig.config

    if (typeof configSection === 'object' && configSection !== null && !Array.isArray(configSection)) {
      return configSection as Record<string, unknown>
    }

    return undefined
  }

  /**
   * Check if a string value contains an unresolved `{env:VAR}` placeholder.
   *
   * @remarks
   * ConfigLoader preserves `{env:VAR}` placeholders when the referenced
   * environment variable is not set. This method detects such unresolved
   * placeholders so they can be treated as absent values.
   *
   * @param value - The string value to check
   * @returns `true` if the value contains an unresolved env placeholder
   */
  private isUnresolvedEnvPlaceholder(value: string): boolean {
    return UNRESOLVED_ENV_PATTERN.test(value)
  }
}

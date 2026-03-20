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
import { gt } from 'semver'

import type { ConfigSyncerInterface } from '../interfaces/ConfigSyncerInterface.js'
import type { SyncPayload } from '../types/SyncPayload.js'
import type { SyncResponse } from '../types/SyncResponse.js'
import type { PluginLoggerInterface } from '../interfaces/PluginLoggerInterface.js'

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
  constructor(private readonly logger?: PluginLoggerInterface) {}

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
   * Send an HTTP POST request to the webhook endpoint.
   *
   * @remarks
   * Uses native `fetch()` (Node.js 18+) with:
   * - Content-Type: application/json
   * - Optional Bearer token Authorization header
   * - 5-second timeout via AbortController
   *
   * On HTTP error (non-2xx status), throws an Error with the status code
   * and status text. The calling syncConfig() facade catches this error
   * and returns null (Graceful Degradation).
   *
   * On timeout (AbortController fires after 5 seconds), the fetch promise
   * rejects with an AbortError, which is also caught by the facade.
   *
   * @param syncUrl - The webhook URL to POST to
   * @param payload - The assembled SyncPayload to send as JSON body
   * @param syncToken - Optional Bearer token for Authorization header (null = no auth)
   * @returns The parsed SyncResponse from the webhook
   * @throws Error on HTTP error (non-2xx status) or timeout (AbortError)
   *
   * @see SyncPayload - The request body type
   * @see SyncResponse - The response type
   */
  private async postToWebhook(
    syncUrl: string,
    payload: SyncPayload,
    syncToken: string | null,
  ): Promise<SyncResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(syncToken ? { 'Authorization': `Bearer ${syncToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json() as SyncResponse
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Check if the webhook response version is compatible with the current plugin version.
   *
   * @remarks
   * Uses the `semver` npm package for correct semantic version comparison.
   * A response is compatible when `response.version <= pluginVersion`.
   * If the response was generated for a newer plugin version, the config
   * might contain settings that the current plugin cannot handle.
   *
   * Logs a warning (not an error) when the version is incompatible,
   * because this is a recoverable situation (Graceful Degradation).
   *
   * @param response - The webhook response containing the version field
   * @param pluginVersion - The current plugin version from PluginDescriptor
   * @returns `true` if the response is compatible, `false` if it should be rejected
   *
   * @see SyncResponse - The response type containing the version field
   */
  private checkVersionCompatibility(response: SyncResponse, pluginVersion: string): boolean {
    if (gt(response.version, pluginVersion)) {
      this.logger?.warn(
        `Config für neuere Plugin-Version ${response.version} generiert (aktuell: ${pluginVersion}). Bitte Plugin updaten.`,
      )
      return false
    }
    return true
  }

  /**
   * Synchronize local config with the remote webhook.
   *
   * @remarks
   * Public facade that orchestrates the complete sync flow:
   * 1. Resolve sync_url from config/env cascade
   * 2. Pre-flight check: OPENCODE_USER_EMAIL must be set
   * 3. Build the SyncPayload
   * 4. Resolve sync_token from config/env cascade
   * 5. HTTP POST to webhook
   * 6. Validate response structure (version field required)
   * 7. Check version compatibility
   *
   * Implements Graceful Degradation: returns `null` on ANY error,
   * logs warnings (never errors), and never throws exceptions.
   * This ensures the plugin system is never blocked by sync failures.
   *
   * @param localConfig - The fully resolved local config (Global + Project merged, env-resolved)
   * @param pluginNames - Names of all installed plugins from `discoverPlugins()`
   * @param pluginVersion - Semantic version of this plugin from PluginDescriptor
   * @returns The remote SyncResponse, or `null` if sync fails (Graceful Degradation)
   */
  public async syncConfig(
    localConfig: Record<string, unknown>,
    pluginNames: string[],
    pluginVersion: string,
  ): Promise<SyncResponse | null> {
    try {
      // 1. Resolve sync_url from config/env cascade
      const syncUrl = this.resolveSyncUrl(localConfig)
      if (!syncUrl) {
        return null
      }

      // 2. Pre-flight: OPENCODE_USER_EMAIL must be set
      const email = process.env.OPENCODE_USER_EMAIL
      if (!email) {
        this.logger?.warn('OPENCODE_USER_EMAIL not set, skipping config sync')
        return null
      }

      // 3. Build the SyncPayload
      const payload = this.buildPayload(localConfig, pluginNames, pluginVersion, email)

      // 4. Resolve sync_token from config/env cascade
      const syncToken = this.resolveSyncToken(localConfig)

      // 5. HTTP POST to webhook
      const response = await this.postToWebhook(syncUrl, payload, syncToken)

      // 6. Validate response structure (version field required)
      if (!response.version) {
        this.logger?.warn('Config sync response missing version field, skipping')
        return null
      }

      // 7. Check version compatibility
      if (!this.checkVersionCompatibility(response, pluginVersion)) {
        return null
      }

      return response
    } catch (error) {
      this.logger?.warn(`Config sync failed: ${error}`)
      return null
    }
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

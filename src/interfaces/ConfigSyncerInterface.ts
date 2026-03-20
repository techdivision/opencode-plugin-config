/**
 * Interface for the ConfigSyncer service.
 *
 * @remarks
 * Orchestrates the webhook-based config synchronization:
 * 1. Assemble SyncPayload from local config, plugin names, and version
 * 2. POST payload to the n8n webhook endpoint
 * 3. Validate SyncResponse version compatibility
 * 4. Return remote config or null on any error (Graceful Degradation)
 *
 * Design decisions:
 * - `logger` is injected via constructor (stable dependency, does not change per call)
 * - `localConfig`, `pluginNames`, `pluginVersion` are method parameters (change per call)
 * - Returns `null` instead of throwing on errors (Graceful Degradation pattern)
 *
 * @see SyncPayload - The webhook request payload
 * @see SyncResponse - The webhook response
 * @see ConfigLoaderInterface - Provides the localConfig input
 */
import type { SyncResponse } from '../types/SyncResponse.js'

export interface ConfigSyncerInterface {
  /**
   * Synchronize local config with the remote webhook.
   *
   * @param localConfig - The fully resolved local config (Global + Project merged, env-resolved)
   * @param pluginNames - Names of all installed plugins from `discoverPlugins()`
   * @param pluginVersion - Semantic version of this plugin from PluginDescriptor
   * @returns The remote SyncResponse, or `null` if sync fails (Graceful Degradation)
   *
   * @example
   * ```typescript
   * const syncer = new ConfigSyncer(logger)
   * const response = await syncer.syncConfig(
   *   { jira: { project: 'COPSPA' } },
   *   ['config', 'time-tracking'],
   *   '0.1.0'
   * )
   * if (response) {
   *   // merge response.config with local config
   * }
   * ```
   */
  syncConfig(
    localConfig: Record<string, unknown>,
    pluginNames: string[],
    pluginVersion: string,
  ): Promise<SyncResponse | null>
}

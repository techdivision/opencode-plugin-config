/**
 * Webhook payload sent to the n8n config-sync endpoint.
 *
 * @remarks
 * Contains all information the remote webhook needs to determine
 * the correct configuration for this plugin instance:
 * - Plugin version for compatibility checks
 * - User email for tenant/user-specific config
 * - List of installed plugins for feature-flag decisions
 * - Current local config as seed for remote overrides
 *
 * Assembled by ConfigSyncer before each webhook POST request.
 *
 * @see ConfigSyncerInterface - Service that assembles and sends this payload
 * @see SyncResponse - The webhook's response type
 */
export interface SyncPayload {
  /** Semantic version of this plugin, read from PluginDescriptor. */
  readonly plugin_version: string

  /** User email from `process.env.OPENCODE_USER_EMAIL`. */
  readonly email: string

  /** Names of all installed plugins, discovered via `discoverPlugins()`. */
  readonly plugins: string[]

  /** Complete local config (Global + Project merged, env-resolved) as seed. */
  readonly config: Record<string, unknown>
}

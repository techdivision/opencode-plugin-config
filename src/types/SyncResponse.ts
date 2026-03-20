/**
 * Webhook response received from the n8n config-sync endpoint.
 *
 * @remarks
 * Contains the remote configuration sections and a minimum compatible
 * plugin version. The ConfigSyncer checks version compatibility before
 * applying the remote config.
 *
 * The `config` object is deep-merged with the local config, where
 * local values take precedence (local-wins semantics).
 *
 * @see ConfigSyncerInterface - Service that receives and processes this response
 * @see SyncPayload - The request payload type
 */
export interface SyncResponse {
  /** Minimum compatible plugin version (semver). */
  readonly version: string

  /** Remote config sections to deep-merge with local config. */
  readonly config: Record<string, unknown>
}

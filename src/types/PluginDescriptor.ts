/**
 * Describes a discovered OpenCode plugin.
 *
 * @remarks
 * Returned by {@link PluginDiscoveryInterface.discoverPlugins} for each
 * plugin found in the global or project `node_modules/` directories.
 *
 * Contains metadata from `package.json` (name, version, opencode marker)
 * and `plugin.json` (configSchema, category).
 *
 * @see PluginDiscoveryInterface - Service that produces these descriptors
 * @see SyncPayload - Consumes plugin names and version
 */
export interface PluginDescriptor {
  /** Plugin name without scope (e.g. `"config"`, `"time-tracking"`). */
  readonly name: string

  /** Semantic version from `plugin.json` or `package.json`. */
  readonly version: string

  /** Relative path to the config JSON Schema, or `null` if none declared. */
  readonly configSchema: string | null

  /** Absolute filesystem path to the plugin's root directory. */
  readonly path: string
}

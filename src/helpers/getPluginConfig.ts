/**
 * Consumer helper to retrieve configuration for a specific plugin.
 *
 * @remarks
 * Wraps {@link getProjectConfig} and extracts the section for the given plugin.
 * Plugin names with hyphens are automatically converted to underscore-based
 * section keys (e.g., `"time-tracking"` → `"time_tracking"`).
 *
 * Returns an empty object `{}` if the plugin section does not exist or
 * the section value is not a plain object.
 *
 * @example
 * ```typescript
 * import { getPluginConfig } from '@techdivision/opencode-plugin-config'
 *
 * const ttConfig = getPluginConfig('time-tracking')
 * // ttConfig: { csv_file: ".opencode/tt.csv", ... }
 * ```
 *
 * @see US-CFG-033 - Consumer-Hilfsfunktionen getProjectConfig / getPluginConfig
 * @see getProjectConfig - Used internally to load the full config
 */
import { getProjectConfig } from './getProjectConfig.js'

/**
 * Convert a plugin name to its config section key.
 *
 * @param pluginName - The plugin name (e.g., `"time-tracking"`)
 * @returns The section key with hyphens replaced by underscores (e.g., `"time_tracking"`)
 */
function toSectionKey(pluginName: string): string {
  return pluginName.replace(/-/g, '_')
}

/**
 * Retrieve the configuration section for a specific plugin.
 *
 * @param pluginName - The plugin name (hyphens are converted to underscores)
 * @returns The plugin's config section as an object, or `{}` if not found
 * @throws Never — returns `{}` on any error
 */
export function getPluginConfig(pluginName: string): Record<string, unknown> {
  const config = getProjectConfig()
  const sectionKey = toSectionKey(pluginName)
  const section = config[sectionKey]

  if (typeof section === 'object' && section !== null && !Array.isArray(section)) {
    return section as Record<string, unknown>
  }

  return {}
}

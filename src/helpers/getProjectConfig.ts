/**
 * Consumer helper to retrieve the merged project configuration.
 *
 * @remarks
 * Implements a 3-step fallback chain:
 * 1. `process.env.OPENCODE_PROJECT_CONFIG` — parse JSON string set by the config plugin
 * 2. Local file `.opencode/opencode-project.json` — read from current working directory
 * 3. Empty object `{}` — graceful degradation when no config is available
 *
 * Invalid JSON in `process.env` triggers a fallback to the local file (never throws).
 *
 * @example
 * ```typescript
 * import { getProjectConfig } from '@techdivision/opencode-plugin-config'
 *
 * const config = getProjectConfig()
 * // config: { jira: { project: "COPSPA" }, time_tracking: { ... } }
 * ```
 *
 * @see US-CFG-033 - Consumer-Hilfsfunktionen getProjectConfig / getPluginConfig
 */
import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_CONFIG_PATH } from '../types/PluginConfig.js'

/**
 * Retrieve the merged project configuration.
 *
 * @returns The parsed project config object, or `{}` if no config is available
 * @throws Never — all errors are caught and result in fallback behavior
 */
export function getProjectConfig(): Record<string, unknown> {
  const envValue = process.env.OPENCODE_PROJECT_CONFIG

  if (envValue !== undefined && envValue !== '') {
    try {
      const parsed = JSON.parse(envValue)

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Invalid JSON in process.env — fall through to local file
    }
  }

  return readLocalConfigFile()
}

/**
 * Read the local project config file as fallback.
 *
 * @returns The parsed config from `.opencode/opencode-project.json`, or `{}` on any error
 */
function readLocalConfigFile(): Record<string, unknown> {
  try {
    const filePath = path.resolve(process.cwd(), PROJECT_CONFIG_PATH)

    if (!fs.existsSync(filePath)) {
      return {}
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }

    return {}
  } catch {
    return {}
  }
}

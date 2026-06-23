/**
 * OpenCode Config Plugin - Entry Point
 *
 * Thin wrapper around @techdivision/lib-ts-config-sync. The shared library
 * owns the entire sync pipeline (local cascade, env-var resolution, n8n
 * webhook, per-section schema validation, deep-merge). This wrapper only:
 *   - adapts the OpenCode SDK client to the library Logger
 *   - reads the plugin version from plugin.json
 *   - triggers the OpenCodeAdapter on session start
 *
 * The merged config is exposed in-memory via
 * process.env.OPENCODE_PROJECT_CONFIG for downstream consumer plugins.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Plugin } from '@opencode-ai/plugin'
import { OpenCodeAdapter, type Logger } from '@techdivision/lib-ts-config-sync'
import { createPluginLogger } from './utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Read this plugin's version from plugin.json. Falls back to '0.0.0'.
 */
function readPluginVersion(): string {
  try {
    const pluginJsonPath = resolve(__dirname, '..', 'plugin.json')
    const parsed = JSON.parse(readFileSync(pluginJsonPath, 'utf-8')) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const ConfigPlugin: Plugin = async (input) => {
  const pluginLogger = createPluginLogger(input.client, 'config')

  // Adapt the OpenCode SDK logger to the library's Logger interface.
  const logger: Logger = {
    debug: (message, context) => pluginLogger.debug(message, context),
    info: (message, context) => pluginLogger.info(message, context),
    warn: (message, context) => pluginLogger.warn(message, context),
    error: (message, context) => pluginLogger.error(message, context),
  }

  const adapter = new OpenCodeAdapter({
    pluginVersion: readPluginVersion(),
    logger,
  })

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        await adapter.run()
      }
    },
  }
}

export default ConfigPlugin

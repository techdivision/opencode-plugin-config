/**
 * OpenCode Config Plugin - Entry Point
 *
 * Thin wrapper around @techdivision/lib-ts-config-sync. The shared library
 * owns the entire sync pipeline (local cascade, env-var resolution, n8n
 * webhook, per-section schema validation, deep-merge). This wrapper only:
 *   - runs the sync immediately at plugin load (every opencode startup)
 *   - shows an info toast once the UI is ready (plugin.added primary,
 *     session.created fallback — same pattern as opencode-cli)
 *   - reads the plugin version from plugin.json
 *
 * The merged config is exposed in-memory via
 * process.env.OPENCODE_PROJECT_CONFIG for downstream consumer plugins.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Plugin, PluginInput } from '@opencode-ai/plugin'
import { OpenCodeAdapter, type Logger, type SyncResult } from '@techdivision/lib-ts-config-sync'
import { createPluginLogger } from './utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readPluginVersion(): string {
  try {
    const pluginJsonPath = resolve(__dirname, '..', 'plugin.json')
    const parsed = JSON.parse(readFileSync(pluginJsonPath, 'utf-8')) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

async function showSyncToast(client: PluginInput['client'], result: SyncResult): Promise<void> {
  const message = result.remoteApplied
    ? `Config synced (${result.message.replace('Config synced (', '').replace(')', '')})`
    : 'Config: using local settings'
  try {
    await client.tui.showToast({
      body: { message, variant: 'info', duration: 8000 },
    })
  } catch {
    // Toast API unavailable — not critical.
  }
}

export const plugin: Plugin = async ({ client }: PluginInput) => {
  const pluginLogger = createPluginLogger()

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

  // Run immediately at plugin load — before any session event.
  let syncResult: SyncResult | null = null
  let toastShown = false

  adapter.run().then((result) => {
    syncResult = result
    setTimeout(() => {
      if (!toastShown) {
        toastShown = true
        showSyncToast(client, result)
      }
    }, 3000)
  }).catch((err) => {
    pluginLogger.error('Config sync failed during init', { error: String(err) })
  })

  return {}
}

export default plugin

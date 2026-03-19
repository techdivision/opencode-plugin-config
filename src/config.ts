/**
 * OpenCode Config Plugin — Entry Point.
 *
 * @remarks
 * Provides the config cascade with deep-merge, env-var resolution
 * and schema validation for OpenCode projects.
 *
 * This is the plugin's main export. OpenCode loads it via
 * `await import(plugin)` and calls the exported function with
 * `PluginInput` containing the SDK client, project directory, etc.
 *
 * Architecture: Explicit Constructor Injection (ADR-013).
 * Services are instantiated here and wired together manually.
 *
 * @see ADR-013 - Architektur-Patterns fuer TypeScript-Plugins
 * @see ADR-014 - Standard-Verzeichnisstruktur
 * @see ConfigLoader - Local config cascade (Global + Project)
 * @see ConfigMerger - Central deep-merge service
 */
import type { Plugin } from '@opencode-ai/plugin'
import { createPluginLogger } from './utils/logger.js'
import { ConfigLoader } from './services/ConfigLoader.js'
import { ConfigMerger } from './services/ConfigMerger.js'

/**
 * The Config Plugin function.
 *
 * @remarks
 * Orchestrates the config sync flow:
 * 1. Create logger via SDK client
 * 2. Instantiate services (Explicit Constructor Injection)
 * 3. Load local config cascade (Global + Project, deep-merged, env-resolved)
 * 4. (Future: Webhook call, schema validation, final merge, process.env)
 *
 * Returns `{}` — no runtime hooks. All work is done at init time.
 *
 * @param input - The OpenCode PluginInput (client, directory, project, etc.)
 * @returns Empty hooks object (no runtime hooks needed)
 */
export const ConfigPlugin: Plugin = async (input) => {
  const logger = createPluginLogger(input.client, 'config')

  const merger = new ConfigMerger()
  const loader = new ConfigLoader(merger, logger)

  const safeLoadConfig = logger.withLogging(
    logger.withErrorHandling(
      loader.loadLocalConfig.bind(loader),
      {}
    ),
    'loadLocalConfig'
  )

  return {}
}

export default ConfigPlugin

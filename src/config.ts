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
 * Plugin Discovery (US-CFG-015):
 * `discoverPlugins()` is called HERE in the entry point, not in ConfigSyncer.
 * The discovery result is decomposed and passed to services:
 * - `pluginNames: string[]` → ConfigSyncer.syncConfig()
 * - `pluginVersion: string` → ConfigSyncer.syncConfig()
 * - `plugins: Map<string, PluginDescriptor>` → SchemaValidator (EPIC-CFG-03)
 *
 * @see ADR-013 - Architektur-Patterns fuer TypeScript-Plugins
 * @see ADR-014 - Standard-Verzeichnisstruktur
 * @see ADR-015 - Plugin Discovery (Phase 1: eigene Implementierung)
 * @see ConfigLoader - Local config cascade (Global + Project)
 * @see ConfigMerger - Central deep-merge service
 * @see PluginDiscovery - Plugin discovery service
 */
import type { Plugin } from '@opencode-ai/plugin'
import { createPluginLogger } from './utils/logger.js'
import { ConfigLoader } from './services/ConfigLoader.js'
import { ConfigMerger } from './services/ConfigMerger.js'
import { PluginDiscovery } from './utils/PluginDiscovery.js'

/**
 * The Config Plugin function.
 *
 * @remarks
 * Orchestrates the config sync flow:
 * 1. Create logger via SDK client
 * 2. Instantiate services (Explicit Constructor Injection)
 * 3. Discover installed plugins (discoverPlugins)
 * 4. Extract plugin names and own version from discovery result
 * 5. Load local config cascade (Global + Project, deep-merged, env-resolved)
 * 6. (Future: Webhook call with pluginNames + pluginVersion, schema validation, final merge, process.env)
 *
 * Returns `{}` — no runtime hooks. All work is done at init time.
 *
 * @param input - The OpenCode PluginInput (client, directory, project, etc.)
 * @returns Empty hooks object (no runtime hooks needed)
 */
export const ConfigPlugin: Plugin = async (input) => {
  const logger = createPluginLogger(input.client, 'config')

  // --- Service instantiation (Explicit Constructor Injection) ---
  const merger = new ConfigMerger()
  const loader = new ConfigLoader(merger, logger)
  const discovery = new PluginDiscovery()

  // --- Plugin Discovery (US-CFG-015) ---
  const safeDiscoverPlugins = logger.withLogging(
    logger.withErrorHandling(
      discovery.discoverPlugins.bind(discovery),
      new Map()
    ),
    'discoverPlugins'
  )

  const plugins = safeDiscoverPlugins(input.directory)
  const pluginNames = Array.from(plugins.keys())
  const ownDescriptor = plugins.get('config')
  const pluginVersion = ownDescriptor?.version ?? '0.0.0'

  logger.debug('Plugin discovery completed', {
    pluginCount: plugins.size,
    pluginNames,
    pluginVersion,
  })

  // --- Local Config Cascade ---
  const safeLoadConfig = logger.withLogging(
    logger.withErrorHandling(
      loader.loadLocalConfig.bind(loader),
      {}
    ),
    'loadLocalConfig'
  )

  const _localConfig = safeLoadConfig(input.directory)

  // Future (US-CFG-011+): Pass pluginNames and pluginVersion to ConfigSyncer
  // const syncResponse = await configSyncer.syncConfig(localConfig, pluginNames, pluginVersion)

  // Future (EPIC-CFG-03): Pass plugins Map to SchemaValidator
  // const validator = new SchemaValidator(plugins)

  return {}
}

export default ConfigPlugin

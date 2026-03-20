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
 * Orchestration flow (8 steps from arc42 6.6):
 * 1. Create logger via SDK client
 * 2. Instantiate services (ConfigLoader, ConfigSyncer, SchemaValidator, ConfigMerger)
 * 3. Discover installed plugins (discoverPlugins)
 * 4. Load local config cascade (Global + Project, deep-merged, env-resolved)
 * 5. Webhook call (ConfigSyncer) with pluginNames + pluginVersion
 * 6. Schema validation (SchemaValidator) of webhook response sections
 * 7. Deep-merge (ConfigMerger) remote as base, local as override
 * 8. Write final config to process.env.OPENCODE_PROJECT_CONFIG
 *
 * Error tolerance: Webhook failures and validation errors never block plugin start.
 * On any sync/validation failure, the local config is used as-is.
 *
 * @see ADR-013 - Architektur-Patterns fuer TypeScript-Plugins
 * @see ADR-014 - Standard-Verzeichnisstruktur
 * @see ADR-015 - Plugin Discovery (Phase 1: eigene Implementierung)
 * @see ConfigLoader - Local config cascade (Global + Project)
 * @see ConfigSyncer - Webhook-based config synchronization
 * @see SchemaValidator - Section-level schema validation
 * @see ConfigMerger - Central deep-merge service
 * @see PluginDiscovery - Plugin discovery service
 */
import type { Plugin } from '@opencode-ai/plugin'
import { createPluginLogger } from './utils/PluginLogger.js'
import { ConfigLoader } from './services/ConfigLoader.js'
import { ConfigMerger } from './services/ConfigMerger.js'
import { ConfigSyncer } from './services/ConfigSyncer.js'
import { SchemaValidator } from './services/SchemaValidator.js'
import { PluginDiscovery } from './utils/PluginDiscovery.js'
import { PROTECTED_FIELDS } from './types/PluginConfig.js'

/**
 * The Config Plugin function.
 *
 * @remarks
 * Orchestrates the complete config sync flow in 8 steps:
 *
 * 1. Create logger via SDK client
 * 2. Instantiate services (Explicit Constructor Injection)
 * 3. Discover installed plugins and extract metadata
 * 4. Load local config cascade (Global + Project, deep-merged, env-resolved)
 * 5. Sync config via webhook (ConfigSyncer) — returns null on failure
 * 6. Validate webhook response sections (SchemaValidator) — skipped if sync failed
 * 7. Deep-merge remote + local configs (ConfigMerger) — skipped if no valid remote
 * 8. Write final config to process.env.OPENCODE_PROJECT_CONFIG
 *
 * Returns `{}` — no runtime hooks. All work is done at init time.
 *
 * @param input - The OpenCode PluginInput (client, directory, project, etc.)
 * @returns Empty hooks object (no runtime hooks needed)
 */
export const ConfigPlugin: Plugin = async (input) => {
  // --- Step 1: Create logger ---
  const logger = createPluginLogger(input.client, 'config')

  // --- Step 2: Service instantiation (Explicit Constructor Injection) ---
  const merger = new ConfigMerger()
  const loader = new ConfigLoader(merger, logger)
  const syncer = new ConfigSyncer(logger)
  const validator = new SchemaValidator(logger)
  const discovery = new PluginDiscovery()

  // --- Step 3: Plugin Discovery ---
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

  // --- Step 4: Local Config Cascade ---
  const safeLoadConfig = logger.withLogging(
    logger.withErrorHandling(
      loader.loadLocalConfig.bind(loader),
      {}
    ),
    'loadLocalConfig'
  )

  const localConfig = safeLoadConfig(input.directory)

  // --- Step 5: Webhook Sync (Graceful Degradation) ---
  const safeSyncConfig = logger.withLogging(
    logger.withErrorHandling(
      syncer.syncConfig.bind(syncer),
      null
    ),
    'syncConfig'
  )

  const syncResponse = await safeSyncConfig(localConfig, pluginNames, pluginVersion)

  // --- Step 6: Schema Validation (only if sync succeeded) ---
  let validatedRemoteConfig: Record<string, unknown> = {}

  if (syncResponse !== null) {
    const pluginDescriptors = Array.from(plugins.values())
    validatedRemoteConfig = validator.validateResponse(syncResponse, pluginDescriptors)

    logger.debug('Schema validation completed', {
      validSections: Object.keys(validatedRemoteConfig),
    })
  }

  // --- Step 7: Deep-Merge (remote as base, local as override) ---
  let finalConfig: Record<string, unknown>

  if (Object.keys(validatedRemoteConfig).length > 0) {
    finalConfig = merger.mergeWithProtectedFields(
      validatedRemoteConfig,
      localConfig,
      PROTECTED_FIELDS,
    )

    logger.info('Config merged (remote + local)', {
      remoteSections: Object.keys(validatedRemoteConfig),
      finalSections: Object.keys(finalConfig),
    })
  } else {
    finalConfig = localConfig

    logger.info('Using local config only (no remote config available)')
  }

  // --- Step 8: Write to process.env ---
  process.env.OPENCODE_PROJECT_CONFIG = JSON.stringify(finalConfig)

  logger.info('Config written to process.env.OPENCODE_PROJECT_CONFIG', {
    sections: Object.keys(finalConfig),
  })

  return {}
}

export { getProjectConfig } from './helpers/getProjectConfig.js'
export { getPluginConfig } from './helpers/getPluginConfig.js'

export default ConfigPlugin

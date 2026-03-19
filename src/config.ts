/**
 * OpenCode Config Plugin - Entry Point
 *
 * Provides configuration cascade with deep-merge, env-var resolution
 * and schema validation for OpenCode projects.
 */
import type { Plugin } from '@opencode-ai/plugin'
import { createPluginLogger } from './utils/logger.js'
import { ConfigLoader } from './services/ConfigLoader.js'
import { ConfigMerger } from './services/ConfigMerger.js'

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

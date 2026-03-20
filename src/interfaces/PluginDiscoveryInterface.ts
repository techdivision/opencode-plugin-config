/**
 * Interface for the PluginDiscovery service.
 *
 * @remarks
 * Scans global and project `node_modules/` directories for installed
 * OpenCode plugins. A plugin is identified by `opencode.plugin: true`
 * in its `package.json`.
 *
 * Discovery locations (in priority order):
 * 1. Global: `~/.config/opencode/node_modules/` (lower priority)
 * 2. Local:  `<project>/.opencode/node_modules/` (higher priority, overrides global)
 *
 * Phase 1 (ADR-015): Own implementation, no dependency on `@techdivision/opencode-cli`.
 *
 * @see PluginDescriptor - The descriptor returned for each discovered plugin
 * @see ConfigPlugin - Entry point that calls discoverPlugins()
 */
import type { PluginDescriptor } from '../types/PluginDescriptor.js'

export interface PluginDiscoveryInterface {
  /**
   * Discover all installed OpenCode plugins.
   *
   * @remarks
   * Scans both global and local `node_modules/` directories.
   * Local plugins override global plugins with the same name.
   *
   * @param targetDir - Absolute path to the project root directory
   * @returns A Map of plugin name to PluginDescriptor (never throws)
   *
   * @example
   * ```typescript
   * const discovery = new PluginDiscovery()
   * const plugins = discovery.discoverPlugins('/path/to/project')
   * // Map { 'config' => { name: 'config', version: '0.1.0', ... }, ... }
   * ```
   */
  discoverPlugins(targetDir: string): Map<string, PluginDescriptor>
}

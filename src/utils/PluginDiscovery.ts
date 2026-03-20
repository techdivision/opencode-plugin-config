/**
 * Plugin Discovery Service.
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
 * @see PluginDiscoveryInterface - Interface definition
 * @see PluginDescriptor - The descriptor returned for each discovered plugin
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { PluginDiscoveryInterface } from '../interfaces/PluginDiscoveryInterface.js'
import type { PluginDescriptor } from '../types/PluginDescriptor.js'

/**
 * Global plugin path relative to user home directory.
 *
 * @remarks
 * Resolves to `~/.config/opencode/node_modules/`.
 */
export const GLOBAL_PLUGIN_PATH = '.config/opencode/node_modules'

/**
 * Local plugin path relative to project root.
 *
 * @remarks
 * Resolves to `<project>/.opencode/node_modules/`.
 */
export const LOCAL_PLUGIN_PATH = '.opencode/node_modules'

export class PluginDiscovery implements PluginDiscoveryInterface {
  /**
   * Discover all installed OpenCode plugins.
   *
   * @remarks
   * Scans global directory first, then local directory.
   * Local plugins override global plugins with the same name.
   * Returns an empty Map on any top-level error (Graceful Degradation).
   *
   * @param targetDir - Absolute path to the project root directory
   * @returns A Map of plugin name to PluginDescriptor
   */
  public discoverPlugins(targetDir: string): Map<string, PluginDescriptor> {
    const plugins = new Map<string, PluginDescriptor>()

    try {
      const globalDir = path.join(os.homedir(), GLOBAL_PLUGIN_PATH)
      const localDir = path.join(targetDir, LOCAL_PLUGIN_PATH)

      // Scan global first (lower priority)
      this.scanDirectory(globalDir, plugins)

      // Scan local second (higher priority, overrides global)
      this.scanDirectory(localDir, plugins)
    } catch {
      // Graceful degradation: return empty Map on any error
      return new Map()
    }

    return plugins
  }

  /**
   * Scan a node_modules directory for OpenCode plugins.
   *
   * @remarks
   * Handles both scoped (`@org/package`) and unscoped packages.
   * Silently skips directories that don't exist or can't be read.
   *
   * @param nodeModulesDir - Absolute path to the node_modules directory
   * @param plugins - The Map to populate with discovered plugins
   */
  private scanDirectory(nodeModulesDir: string, plugins: Map<string, PluginDescriptor>): void {
    if (!fs.existsSync(nodeModulesDir)) {
      return
    }

    const entries = fs.readdirSync(nodeModulesDir)

    for (const entry of entries) {
      const entryPath = path.join(nodeModulesDir, entry)

      if (entry.startsWith('@')) {
        // Scoped package: scan subdirectories
        this.scanScopedDirectory(entryPath, plugins)
      } else {
        this.tryRegisterPlugin(entryPath, plugins)
      }
    }
  }

  /**
   * Scan a scoped package directory (e.g. `@techdivision/`).
   *
   * @param scopeDir - Absolute path to the scope directory
   * @param plugins - The Map to populate with discovered plugins
   */
  private scanScopedDirectory(scopeDir: string, plugins: Map<string, PluginDescriptor>): void {
    try {
      const stat = fs.statSync(scopeDir)
      if (!stat.isDirectory()) return

      const entries = fs.readdirSync(scopeDir)
      for (const entry of entries) {
        const packageDir = path.join(scopeDir, entry)
        this.tryRegisterPlugin(packageDir, plugins)
      }
    } catch {
      // Skip unreadable scope directories
    }
  }

  /**
   * Try to register a package as an OpenCode plugin.
   *
   * @remarks
   * Reads `package.json` to check for `opencode.plugin: true` marker.
   * If found, reads `plugin.json` for additional metadata.
   * Silently skips packages that are not plugins or can't be read.
   *
   * @param packageDir - Absolute path to the package directory
   * @param plugins - The Map to populate with the plugin descriptor
   */
  private tryRegisterPlugin(packageDir: string, plugins: Map<string, PluginDescriptor>): void {
    try {
      const stat = fs.statSync(packageDir)
      if (!stat.isDirectory()) return

      const packageJsonPath = path.join(packageDir, 'package.json')
      if (!fs.existsSync(packageJsonPath)) return

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

      if (!this.isOpencodePlugin(packageJson)) return

      const pluginDescriptor = this.buildDescriptor(packageDir, packageJson)
      plugins.set(pluginDescriptor.name, pluginDescriptor)
    } catch {
      // Skip unreadable packages
    }
  }

  /**
   * Check if a package.json indicates an OpenCode plugin.
   *
   * @param packageJson - The parsed package.json content
   * @returns `true` if `opencode.plugin` is `true`
   */
  private isOpencodePlugin(packageJson: Record<string, unknown>): boolean {
    const opencode = packageJson.opencode as Record<string, unknown> | undefined
    return opencode?.plugin === true
  }

  /**
   * Build a PluginDescriptor from package.json and optional plugin.json.
   *
   * @remarks
   * Prefers `plugin.json` data over `package.json` data.
   * Falls back to package.json name (without scope) if plugin.json is missing.
   *
   * @param packageDir - Absolute path to the package directory
   * @param packageJson - The parsed package.json content
   * @returns A PluginDescriptor for the plugin
   */
  private buildDescriptor(
    packageDir: string,
    packageJson: Record<string, unknown>,
  ): PluginDescriptor {
    const pluginJson = this.readPluginJson(packageDir)

    const name = (pluginJson?.name as string | undefined) ?? this.extractPackageName(packageJson.name as string)
    const version = (pluginJson?.version as string | undefined) ?? (packageJson.version as string | undefined) ?? '0.0.0'
    const configSchema = (pluginJson?.configSchema as string | undefined) ?? null

    return { name, version, configSchema, path: packageDir }
  }

  /**
   * Read and parse `plugin.json` from a package directory.
   *
   * @param packageDir - Absolute path to the package directory
   * @returns The parsed plugin.json content, or `null` if not found or invalid
   */
  private readPluginJson(packageDir: string): Record<string, unknown> | null {
    try {
      const pluginJsonPath = path.join(packageDir, 'plugin.json')
      if (!fs.existsSync(pluginJsonPath)) return null

      return JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'))
    } catch {
      return null
    }
  }

  /**
   * Extract the short package name from a potentially scoped npm name.
   *
   * @remarks
   * Removes the scope prefix (e.g. `@techdivision/opencode-plugin-config` → `opencode-plugin-config`).
   *
   * @param npmName - The full npm package name
   * @returns The unscoped package name
   */
  private extractPackageName(npmName: string): string {
    if (npmName.startsWith('@') && npmName.includes('/')) {
      return npmName.split('/')[1]
    }
    return npmName
  }
}

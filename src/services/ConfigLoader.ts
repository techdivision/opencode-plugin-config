/**
 * Reads and merges configuration from global and project sources.
 *
 * @remarks
 * Implements the 2-layer local config cascade:
 * - Layer 1 (Base): `~/.config/opencode/opencode-project.json`
 * - Layer 2 (Override): `<project>/.opencode/opencode-project.json`
 *
 * Uses {@link ConfigMerger} for deep-merge with project-precedence semantics.
 * Resolves `{env:VAR}` placeholders via `process.env` (set by shell-env plugin).
 *
 * Env resolution scope: Only the local config is env-resolved. The remote config
 * (webhook response) is NOT env-resolved because the n8n webhook delivers fully
 * resolved values.
 *
 * @see ConfigLoaderInterface - Interface definition
 * @see ConfigMerger - Used for deep-merge operations
 * @see ADR-010 - Deep-Merge mit Lokal-Vorrang
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { ConfigLoaderInterface } from '../interfaces/ConfigLoaderInterface.js'
import type { ConfigMergerInterface } from '../interfaces/ConfigMergerInterface.js'
import type { PluginLogger } from '../utils/logger.js'
import { GLOBAL_CONFIG_PATH, PROJECT_CONFIG_PATH, ENV_VAR_PATTERN } from '../types/PluginConfig.js'

export class ConfigLoader implements ConfigLoaderInterface {
  /**
   * @param merger - The merge service for combining configs (Explicit Constructor Injection)
   * @param logger - Optional SDK logger for warnings (file not found, invalid JSON)
   */
  constructor(
    private readonly merger: ConfigMergerInterface,
    private readonly logger?: PluginLogger
  ) {}

  /**
   * Read the global config from `~/.config/opencode/opencode-project.json`.
   *
   * @returns The parsed global config object, or `{}` if file does not exist or is invalid
   * @throws Never - returns `{}` on any error (Graceful Degradation)
   */
  public readGlobalConfig(): Record<string, unknown> {
    const globalConfigPath = path.join(os.homedir(), GLOBAL_CONFIG_PATH)
    return this.readJsonFile(globalConfigPath)
  }

  /**
   * Read the project config from `<projectDir>/.opencode/opencode-project.json`.
   *
   * @param projectDir - Absolute path to the project root directory
   * @returns The parsed project config object, or `{}` if file does not exist or is invalid
   * @throws Never - returns `{}` on any error (Graceful Degradation)
   */
  public readProjectConfig(projectDir: string): Record<string, unknown> {
    const projectConfigPath = path.join(projectDir, PROJECT_CONFIG_PATH)
    return this.readJsonFile(projectConfigPath)
  }

  /**
   * Resolve `{env:VAR}` placeholders in config string values via `process.env`.
   *
   * @remarks
   * Only string values are affected. Non-string values pass through unchanged.
   * Unresolvable placeholders (env var not set) are preserved as-is.
   * Resolution is NOT recursive — only simple replacement.
   *
   * @param config - The config object with potential `{env:VAR}` placeholders
   * @returns A new config object with resolved environment variable values
   * @throws Never - unresolvable placeholders are preserved
   *
   * @example
   * ```typescript
   * process.env.MY_TOKEN = 'secret123'
   * const resolved = loader.resolveEnvVars({ token: '{env:MY_TOKEN}', name: 'test' })
   * // resolved: { token: 'secret123', name: 'test' }
   * ```
   */
  public resolveEnvVars(config: Record<string, unknown>): Record<string, unknown> {
    return this.walkAndResolve(config) as Record<string, unknown>
  }

  /**
   * Facade: orchestrates the full local config pipeline.
   *
   * @remarks
   * Executes: `readGlobalConfig()` → `readProjectConfig()` → `merge()` → `resolveEnvVars()`
   *
   * @param projectDir - Absolute path to the project root directory
   * @returns The fully resolved local config (Global + Project merged, env vars resolved)
   * @throws Never - returns `{}` if both config files are missing or invalid
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader(new ConfigMerger())
   * const config = loader.loadLocalConfig('/path/to/project')
   * // config: { jira: { project: "COPSPA" }, time_tracking: { ... } }
   * ```
   */
  public loadLocalConfig(projectDir: string): Record<string, unknown> {
    const globalConfig = this.readGlobalConfig()
    const projectConfig = this.readProjectConfig(projectDir)
    const merged = this.merger.merge(globalConfig, projectConfig)
    return this.resolveEnvVars(merged)
  }

  /**
   * Read and parse a JSON file. Returns `{}` on any error.
   *
   * @remarks
   * Handles: missing files (silent), invalid JSON (warning), non-object content (warning),
   * permission errors (warning), and other I/O errors (warning).
   *
   * @param filePath - Absolute path to the JSON file
   * @returns The parsed JSON object, or `{}` on any error
   */
  private readJsonFile(filePath: string): Record<string, unknown> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')

      if (content.trim() === '') {
        return {}
      }

      const parsed = JSON.parse(content)

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.logger?.warn(`Config file is not a JSON object: ${filePath}`, { filePath })
        return {}
      }

      return parsed as Record<string, unknown>
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger?.warn(`Config file contains invalid JSON: ${filePath}`, {
          filePath,
          error: String(error)
        })
      } else if (this.isFileNotFoundError(error)) {
        // File or directory does not exist — silent fallback
      } else if (this.isPermissionError(error)) {
        this.logger?.warn(`Config file has no read permission or access denied: ${filePath}`, {
          filePath,
          error: String(error)
        })
      } else {
        this.logger?.warn(`Failed to read config file: ${filePath}`, {
          filePath,
          error: String(error)
        })
      }
      return {}
    }
  }

  /**
   * Recursively walk the config object and resolve `{env:VAR}` placeholders in string values.
   *
   * @param value - The value to process (string, array, object, or primitive)
   * @returns The value with all `{env:VAR}` placeholders resolved in strings
   */
  private walkAndResolve(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(ENV_VAR_PATTERN, (match, varName: string) => {
        const envValue = process.env[varName]
        return envValue !== undefined ? envValue : match
      })
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.walkAndResolve(item))
    }

    if (typeof value === 'object' && value !== null) {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.walkAndResolve(val)
      }
      return result
    }

    return value
  }

  /**
   * Check if an error is a file-not-found error (ENOENT).
   *
   * @param error - The caught error
   * @returns `true` if the error code is `ENOENT`
   */
  private isFileNotFoundError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
  }

  /**
   * Check if an error is a permission error (EACCES or EPERM).
   *
   * @param error - The caught error
   * @returns `true` if the error code is `EACCES` or `EPERM`
   */
  private isPermissionError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException)?.code
    return code === 'EACCES' || code === 'EPERM'
  }
}

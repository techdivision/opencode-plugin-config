/**
 * ConfigLoader - Reads and merges configuration files
 *
 * Implements the 2-layer local config cascade:
 * Layer 1 (Base): ~/.config/opencode/opencode-project.json
 * Layer 2 (Override): <project>/.opencode/opencode-project.json
 *
 * Uses ConfigMerger for deep-merge with project-precedence semantics.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { IConfigLoader } from './interfaces/IConfigLoader.js'
import type { IConfigMerger } from './interfaces/IConfigMerger.js'
import type { PluginLogger } from '../utils/logger.js'
import { GLOBAL_CONFIG_PATH, PROJECT_CONFIG_PATH, ENV_VAR_PATTERN } from '../types/PluginConfig.js'

export class ConfigLoader implements IConfigLoader {
  constructor(
    private readonly merger: IConfigMerger,
    private readonly logger?: PluginLogger
  ) {}

  /**
   * Read the global config from ~/.config/opencode/opencode-project.json.
   * Returns {} if file or directory does not exist.
   */
  public readGlobalConfig(): Record<string, unknown> {
    const globalConfigPath = path.join(os.homedir(), GLOBAL_CONFIG_PATH)
    return this.readJsonFile(globalConfigPath)
  }

  /**
   * Read the project config from <projectDir>/.opencode/opencode-project.json.
   * Returns {} if file or directory does not exist.
   */
  public readProjectConfig(projectDir: string): Record<string, unknown> {
    const projectConfigPath = path.join(projectDir, PROJECT_CONFIG_PATH)
    return this.readJsonFile(projectConfigPath)
  }

  /**
   * Resolve {env:VAR} placeholders in config string values via process.env.
   * Non-string values are not affected. Unresolvable placeholders are preserved.
   * Resolution is NOT recursive — only simple replacement.
   */
  public resolveEnvVars(config: Record<string, unknown>): Record<string, unknown> {
    return this.walkAndResolve(config) as Record<string, unknown>
  }

  /**
   * Facade method: orchestrates the full local config pipeline.
   * readGlobalConfig → readProjectConfig → merge → resolveEnvVars
   */
  public loadLocalConfig(projectDir: string): Record<string, unknown> {
    const globalConfig = this.readGlobalConfig()
    const projectConfig = this.readProjectConfig(projectDir)
    const merged = this.merger.merge(globalConfig, projectConfig)
    return this.resolveEnvVars(merged)
  }

  /**
   * Read and parse a JSON file. Returns {} on any error.
   * Logs warnings for invalid JSON, non-object content, or permission errors.
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
   * Recursively walk the config object and resolve {env:VAR} placeholders in string values.
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

  private isFileNotFoundError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
  }

  private isPermissionError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException)?.code
    return code === 'EACCES' || code === 'EPERM'
  }
}

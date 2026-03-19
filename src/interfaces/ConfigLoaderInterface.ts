/**
 * Interface for the ConfigLoader service.
 *
 * @remarks
 * Reads and merges configuration from global and project sources,
 * implementing the 2-layer local config cascade:
 * - Layer 1 (Base): `~/.config/opencode/opencode-project.json`
 * - Layer 2 (Override): `<project>/.opencode/opencode-project.json`
 *
 * @see ConfigLoader - Implementation
 * @see ConfigMergerInterface - Used for deep-merge operations
 */
export interface ConfigLoaderInterface {
  /**
   * Read the global config from `~/.config/opencode/opencode-project.json`.
   *
   * @returns The parsed global config object, or `{}` if file does not exist or is invalid
   * @throws Never - returns `{}` on any error (Graceful Degradation)
   */
  readGlobalConfig(): Record<string, unknown>

  /**
   * Read the project config from `<projectDir>/.opencode/opencode-project.json`.
   *
   * @param projectDir - Absolute path to the project root directory
   * @returns The parsed project config object, or `{}` if file does not exist or is invalid
   * @throws Never - returns `{}` on any error (Graceful Degradation)
   */
  readProjectConfig(projectDir: string): Record<string, unknown>

  /**
   * Resolve `{env:VAR}` placeholders in config string values via `process.env`.
   *
   * @remarks
   * Only string values are affected. Non-string values pass through unchanged.
   * Unresolvable placeholders (env var not set) are preserved as-is.
   * Resolution is NOT recursive — only simple replacement.
   *
   * Scope: Only the local config is env-resolved. The remote config (webhook response)
   * is NOT env-resolved because the n8n webhook delivers fully resolved values.
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
  resolveEnvVars(config: Record<string, unknown>): Record<string, unknown>

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
  loadLocalConfig(projectDir: string): Record<string, unknown>
}

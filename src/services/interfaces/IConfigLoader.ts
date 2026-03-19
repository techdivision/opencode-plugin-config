/**
 * Interface for the ConfigLoader service.
 *
 * Reads and merges configuration from global and project sources.
 */
export interface IConfigLoader {
  /**
   * Read the global config from ~/.config/opencode/opencode-project.json.
   * Returns {} if file or directory does not exist.
   */
  readGlobalConfig(): Record<string, unknown>

  /**
   * Read the project config from <projectDir>/.opencode/opencode-project.json.
   * Returns {} if file or directory does not exist.
   */
  readProjectConfig(projectDir: string): Record<string, unknown>

  /**
   * Resolve {env:VAR} placeholders in config string values via process.env.
   * Non-string values are not affected. Unresolvable placeholders are preserved.
   */
  resolveEnvVars(config: Record<string, unknown>): Record<string, unknown>

  /**
   * Facade method: orchestrates readGlobalConfig → readProjectConfig → merge → resolveEnvVars.
   * Returns the fully resolved local config.
   */
  loadLocalConfig(projectDir: string): Record<string, unknown>
}

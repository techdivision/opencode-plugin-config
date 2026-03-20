/**
 * Plugin Logger Interface.
 *
 * @remarks
 * Provides level-based logging methods and composable wrapper functions
 * for cross-cutting concerns (logging, error handling).
 *
 * @see {@link createPluginLogger} in `utils/PluginLogger.ts` - Factory function
 * @see ADR-013 - Logging-Integration mit OpenCode SDK
 */
export interface PluginLoggerInterface {
  /**
   * Log a debug-level message.
   *
   * @param msg - The log message
   * @param extra - Optional metadata key-value pairs
   */
  debug(msg: string, extra?: Record<string, unknown>): void

  /**
   * Log an info-level message.
   *
   * @param msg - The log message
   * @param extra - Optional metadata key-value pairs
   */
  info(msg: string, extra?: Record<string, unknown>): void

  /**
   * Log a warning-level message.
   *
   * @param msg - The log message
   * @param extra - Optional metadata key-value pairs
   */
  warn(msg: string, extra?: Record<string, unknown>): void

  /**
   * Log an error-level message.
   *
   * @param msg - The log message
   * @param extra - Optional metadata key-value pairs
   */
  error(msg: string, extra?: Record<string, unknown>): void

  /**
   * Composable wrapper: logs start, completion (with duration) and failure of a function.
   *
   * @param fn - The function to wrap
   * @param name - A human-readable name for log messages (e.g. `'loadLocalConfig'`)
   * @returns A wrapped function with the same signature that logs via SDK
   *
   * @example
   * ```typescript
   * const safeLoad = logger.withLogging(loader.loadLocalConfig.bind(loader), 'loadLocalConfig')
   * const config = safeLoad('/path/to/project')
   * // Logs: "[config] loadLocalConfig started" → "[config] loadLocalConfig completed {duration: 12}"
   * ```
   */
  withLogging<T extends (...args: any[]) => any>(fn: T, name: string): T

  /**
   * Composable wrapper: catches errors and returns a fallback value.
   *
   * @remarks
   * Logs a warning on error (Graceful Degradation pattern).
   * Supports both sync and async functions.
   *
   * @param fn - The function to wrap
   * @param fallback - The value to return on error
   * @returns A wrapped function that never throws, returning fallback on error
   *
   * @example
   * ```typescript
   * const safeSync = logger.withErrorHandling(syncer.syncConfig.bind(syncer), null)
   * const response = await safeSync(payload) // returns null on error instead of throwing
   * ```
   */
  withErrorHandling<T extends (...args: any[]) => any>(fn: T, fallback: any): T
}

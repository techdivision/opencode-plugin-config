/**
 * Plugin Logger Factory.
 *
 * @remarks
 * Creates a logger that writes to OpenCode's internal log file via the SDK client.
 * **NEVER** use `console.log` or `console.error` — they interfere with the OpenCode TUI.
 * All logging goes through `client.log()` which writes to the OpenCode log file.
 *
 * @see {@link createPluginLogger} - Factory function
 * @see ADR-013 - Logging-Integration mit OpenCode SDK
 */

/**
 * Logger interface returned by {@link createPluginLogger}.
 *
 * @remarks
 * Provides level-based logging methods and composable wrapper functions
 * for cross-cutting concerns (logging, error handling).
 */
export interface PluginLogger {
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

/**
 * Minimal interface for the OpenCode SDK client's log method.
 *
 * @remarks
 * Abstracted from `PluginInput['client']` to allow testing with mock clients.
 */
interface LogClient {
  /**
   * Write a log entry to the OpenCode log file.
   *
   * @param params - Log parameters containing service, level, message and optional metadata
   */
  log(params: { body: Record<string, unknown> }): void
}

/**
 * Creates a plugin logger that writes to OpenCode's internal log file via SDK client.
 *
 * @remarks
 * The returned logger provides:
 * - Level-based methods: `debug()`, `info()`, `warn()`, `error()`
 * - Composable wrappers: `withLogging()`, `withErrorHandling()`
 *
 * All output goes through `client.log()` — never `console.log`.
 * The service name enables filtering in the log file (e.g. `service=config`).
 *
 * @param client - The OpenCode SDK client from `PluginInput` (or a mock for testing)
 * @param service - Service name for log filtering (e.g. `'config'`)
 * @returns A {@link PluginLogger} instance bound to the given client and service
 *
 * @example
 * ```typescript
 * // In plugin entry point
 * const logger = createPluginLogger(input.client, 'config')
 * logger.info('Config loaded', { sections: 3 })
 *
 * // Composable wrappers
 * const safeSync = logger.withLogging(
 *   logger.withErrorHandling(syncer.syncConfig.bind(syncer), null),
 *   'syncConfig'
 * )
 * ```
 */
export function createPluginLogger(client: LogClient, service: string): PluginLogger {
  /**
   * Internal log dispatcher.
   *
   * @param level - Log level
   * @param message - Log message
   * @param extra - Optional metadata
   */
  function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>): void {
    client.log({ body: { service, level, message, extra } })
  }

  return {
    debug: (msg: string, extra?: Record<string, unknown>) => log('debug', msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => log('info', msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => log('warn', msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => log('error', msg, extra),

    withLogging<T extends (...args: any[]) => any>(fn: T, name: string): T {
      return ((...args: any[]) => {
        log('debug', `${name} started`)
        const start = Date.now()
        const result = fn(...args)
        if (result instanceof Promise) {
          return result
            .then((r: any) => { log('info', `${name} completed`, { duration: Date.now() - start }); return r })
            .catch((e: any) => { log('error', `${name} failed`, { error: String(e), duration: Date.now() - start }); throw e })
        }
        log('info', `${name} completed`, { duration: Date.now() - start })
        return result
      }) as T
    },

    withErrorHandling<T extends (...args: any[]) => any>(fn: T, fallback: any): T {
      return ((...args: any[]) => {
        try {
          const result = fn(...args)
          if (result instanceof Promise) {
            return result.catch((e: any) => { log('warn', 'Graceful degradation', { error: String(e) }); return fallback })
          }
          return result
        } catch (e) {
          log('warn', 'Graceful degradation', { error: String(e) })
          return fallback
        }
      }) as T
    }
  }
}

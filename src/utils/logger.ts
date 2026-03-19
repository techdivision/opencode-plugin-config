/**
 * Plugin Logger Factory
 *
 * Creates a logger that uses the OpenCode SDK client for logging.
 * NEVER use console.log/console.error - they interfere with the OpenCode TUI.
 */

export interface PluginLogger {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
  withLogging<T extends (...args: any[]) => any>(fn: T, name: string): T
  withErrorHandling<T extends (...args: any[]) => any>(fn: T, fallback: any): T
}

interface LogClient {
  log(params: { body: Record<string, unknown> }): void
}

export function createPluginLogger(client: LogClient, service: string): PluginLogger {
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

/**
 * Plugin Logger Factory
 *
 * Creates a logger that writes through the OpenCode SDK client
 * (client.app.log). NEVER use console.log/console.error — they interfere
 * with the OpenCode TUI.
 */

export interface PluginLogger {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
}

/**
 * Minimal structural view of the OpenCode client's logging surface.
 * The real client exposes `client.app.log({ body: {...} })`.
 */
export interface LogClient {
  app: {
    log(options: {
      body: {
        service: string
        level: 'debug' | 'info' | 'warn' | 'error'
        message: string
        extra?: Record<string, unknown>
      }
    }): unknown
  }
}

export function createPluginLogger(client: LogClient, service: string): PluginLogger {
  function log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    extra?: Record<string, unknown>
  ): void {
    try {
      client.app.log({ body: { service, level, message, extra } })
    } catch {
      // Never let logging break the plugin.
    }
  }

  return {
    debug: (msg, extra) => log('debug', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  }
}

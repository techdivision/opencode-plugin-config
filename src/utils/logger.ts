/**
 * Plugin Logger Factory
 *
 * Creates a logger that writes through the OpenCode SDK client
 * (client.app.log) AND to a dedicated file log at
 * ~/.local/share/opencode/log/config.log — same directory and format as
 * opencode.log, auto-linker.log, and safety-net.log.
 *
 * NEVER use console.log/console.error — they interfere with the OpenCode TUI.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOG_DIR = path.join(os.homedir(), '.local', 'share', 'opencode', 'log')
const LOG_FILE = path.join(LOG_DIR, 'config.log')

function writeToFile(
  level: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    const fields = extra
      ? Object.entries(extra)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(' ')
      : ''
    const line = `timestamp=${new Date().toISOString()} level=${level} service=opencode-plugin/config message=${JSON.stringify(message)}${fields ? ' ' + fields : ''}\n`
    fs.appendFileSync(LOG_FILE, line)
  } catch {
    // Logging must never crash the plugin.
  }
}

export interface PluginLogger {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
}

export function createPluginLogger(): PluginLogger {
  return {
    debug: (msg, extra) => writeToFile('DEBUG', msg, extra),
    info: (msg, extra) => writeToFile('INFO', msg, extra),
    warn: (msg, extra) => writeToFile('WARN', msg, extra),
    error: (msg, extra) => writeToFile('ERROR', msg, extra),
  }
}

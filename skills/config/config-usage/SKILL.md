# Skill: config-usage

# Using the OpenCode Project Config in Your Plugin

## Overview

This skill explains how consumer plugins can access the merged project configuration provided by `@techdivision/opencode-plugin-config`. The config plugin loads, merges, and validates configuration from multiple sources and writes the final result to `process.env.OPENCODE_PROJECT_CONFIG` as a JSON string.

Consumer plugins can either read the environment variable directly or use the provided helper functions `getProjectConfig()` and `getPluginConfig(name)` for convenient, type-safe access with built-in fallback behavior.

## When to Use This Skill

- Accessing project configuration from a consumer plugin
- Reading plugin-specific config sections (e.g., `time_tracking`, `jira`)
- Understanding the config cascade and merge order
- Implementing fallback behavior when no config is available
- Deciding between direct `process.env` access and helper functions

## The Config Cascade (3 Layers)

The config plugin merges configuration from three layers. Each layer overrides the previous one:

| Layer | Source | Path | Precedence |
|-------|--------|------|------------|
| **1. Global** | User-wide defaults | `~/.config/opencode/opencode-project.json` | Lowest (base) |
| **2. Project** | Project-specific config | `<project>/.opencode/opencode-project.json` | Overrides Global |
| **3. Remote** | Webhook response (n8n) | Configured via `config.sync_url` | Lowest in final merge |

### Merge Order

The merge happens in two phases:

1. **Local Cascade:** Global config is deep-merged with Project config. Project values override Global values at every nesting level.
2. **Final Merge:** Remote config (webhook response) is used as the base, and the local config (from step 1) is applied as the override. **Local values always win over remote values.**

This means: if you set a value in your local `.opencode/opencode-project.json`, it will always take precedence over any value delivered by the remote webhook.

### Array Merge Behavior

Arrays are **replaced, not concatenated**. When the override config contains an array at the same path as the base config, the override array completely replaces the base array.

```json
// Global config (base)
{ "plugins": ["config", "shell-env"] }

// Project config (override)
{ "plugins": ["config", "time-tracking"] }

// Result: Project array replaces Global array entirely
{ "plugins": ["config", "time-tracking"] }
```

### Protected Fields

The fields `$schema` and `version` are protected. Remote config cannot overwrite these fields — they always come from the local config.

## Usage Pattern: process.env (Direct Access)

After the config plugin initializes, the merged config is available as a JSON string in `process.env.OPENCODE_PROJECT_CONFIG`. You can read it directly:

```typescript
const raw = process.env.OPENCODE_PROJECT_CONFIG

if (raw) {
  const config = JSON.parse(raw)
  const jiraProject = config.jira?.project
  console.log(`JIRA project: ${jiraProject}`)
}
```

### Fallback to Local File

If `process.env.OPENCODE_PROJECT_CONFIG` is not set (e.g., the config plugin has not run yet), you can fall back to reading the local file directly:

```typescript
import fs from 'node:fs'
import path from 'node:path'

function loadConfig(): Record<string, unknown> {
  const envValue = process.env.OPENCODE_PROJECT_CONFIG

  if (envValue) {
    return JSON.parse(envValue)
  }

  // Fallback: read local file
  const filePath = path.resolve(process.cwd(), '.opencode/opencode-project.json')

  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  return {}
}
```

> **Recommendation:** Use the helper functions below instead of implementing this pattern yourself. They handle all edge cases (invalid JSON, missing files, non-object values) and never throw.

## API Reference: Helper Functions

The recommended way to access the config is via the exported helper functions. They implement the full fallback chain and are safe to call at any time.

### `getProjectConfig()`

Returns the complete merged project configuration.

**Signature:**

```typescript
function getProjectConfig(): Record<string, unknown>
```

**Fallback chain:**

1. Parse `process.env.OPENCODE_PROJECT_CONFIG` (JSON string set by the config plugin)
2. Read local file `.opencode/opencode-project.json` from the current working directory
3. Return empty object `{}` if no config is available

**Import:**

```typescript
import { getProjectConfig } from '@techdivision/opencode-plugin-config'
```

**Example:**

```typescript
import { getProjectConfig } from '@techdivision/opencode-plugin-config'

const config = getProjectConfig()
// config: { jira: { project: "COPSPA" }, time_tracking: { csv_file: ".opencode/tt.csv" } }

const jiraProject = (config.jira as Record<string, unknown>)?.project
```

### `getPluginConfig(pluginName)`

Returns the configuration section for a specific plugin.

**Signature:**

```typescript
function getPluginConfig(pluginName: string): Record<string, unknown>
```

**Behavior:**

- Calls `getProjectConfig()` internally
- Converts the plugin name to a section key: hyphens (`-`) are replaced with underscores (`_`)
  - Example: `"time-tracking"` becomes `"time_tracking"`
- Returns the matching section as an object, or `{}` if not found

**Import:**

```typescript
import { getPluginConfig } from '@techdivision/opencode-plugin-config'
```

**Example:**

```typescript
import { getPluginConfig } from '@techdivision/opencode-plugin-config'

// Read time-tracking plugin config
const ttConfig = getPluginConfig('time-tracking')
// ttConfig: { csv_file: ".opencode/tt.csv", account_key: "TD_KS_1100" }

const csvFile = ttConfig.csv_file as string

// Read JIRA config
const jiraConfig = getPluginConfig('jira')
// jiraConfig: { project: "COPSPA", cloud_id: "..." }
```

## Complete Consumer Plugin Example

Here is a full example of a consumer plugin that reads its config section:

```typescript
import type { Plugin } from '@opencode-ai/plugin'
import { getPluginConfig } from '@techdivision/opencode-plugin-config'

export const TimeTrackingPlugin: Plugin = async (input) => {
  // Get the time-tracking config section
  const config = getPluginConfig('time-tracking')

  const csvFile = (config.csv_file as string) || '.opencode/time-tracking.csv'
  const accountKey = config.account_key as string | undefined

  console.log(`CSV file: ${csvFile}`)
  console.log(`Account: ${accountKey ?? 'not configured'}`)

  return {
    // ... plugin hooks
  }
}
```

## Error Handling

Both helper functions are designed to **never throw**:

| Situation | Behavior |
|-----------|----------|
| `process.env.OPENCODE_PROJECT_CONFIG` contains invalid JSON | Falls back to local file |
| `process.env.OPENCODE_PROJECT_CONFIG` contains a non-object (e.g., array, string) | Falls back to local file |
| Local file does not exist | Returns `{}` |
| Local file contains invalid JSON | Returns `{}` |
| Plugin section does not exist | `getPluginConfig()` returns `{}` |

## Environment Variable Resolution

The config plugin resolves `{env:VAR_NAME}` placeholders in string values before writing to `process.env.OPENCODE_PROJECT_CONFIG`. This means consumer plugins always receive fully resolved values.

```json
// In .opencode/opencode-project.json:
{ "config": { "sync_url": "{env:OC_CONFIG_SYNC_URL}" } }

// After resolution (if OC_CONFIG_SYNC_URL=https://webhook.example.com):
{ "config": { "sync_url": "https://webhook.example.com" } }
```

> **Note:** Environment variable resolution is performed by the `shell-env` plugin, which sets `process.env` values before the config plugin runs.

## Related Skills

- `shell-env-usage` - How the shell-env plugin provides environment variables
- `core-plugin-system` - OpenCode plugin system overview

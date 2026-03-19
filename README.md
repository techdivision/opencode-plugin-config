# @techdivision/opencode-plugin-config

Automatic project configuration sync for the OpenCode AI Plugin System.

<!-- Badges: TODO nach erstem npm publish -->
<!-- [![npm version](https://img.shields.io/npm/v/@techdivision/opencode-plugin-config.svg)](https://www.npmjs.com/package/@techdivision/opencode-plugin-config) -->

## Overview

This plugin eliminates manual configuration for OpenCode plugins. Instead of hand-maintaining JIRA workflow statuses, Tempo accounts, agent defaults, and pricing data in every project, the config plugin makes **a single webhook call** at startup, receives all remote defaults, **deep-merges** them with the local configuration (local always wins), and exposes the result as `process.env.OPENCODE_PROJECT_CONFIG` for all downstream plugins.

No files are written -- the merged config lives entirely in memory, consistent with how `shell-env` handles environment variables. For architectural details see the [arc42 documentation](#architecture-documentation).

## How It Works

```
shell-env (init)
  --> process.env populated from .env files

config (init)
  1. Read local config cascade (Global + Project opencode-project.json)
  2. Plugin discovery via discoverPlugins()
  3. POST webhook call to n8n
  4. Schema validation per section (Ajv + plugin-owned JSON Schemas)
  5. Deep-merge: remote as base, local wins
  6. --> process.env.OPENCODE_PROJECT_CONFIG = JSON string

consumer plugins (init)
  --> JSON.parse(process.env.OPENCODE_PROJECT_CONFIG)
  --> Fallback: read local opencode-project.json directly
```

## Installation

```bash
# Global installation (recommended)
cd ~/.config/opencode
npm install @techdivision/opencode-plugin-config
```

Then link all plugins:

```bash
opencode-link all
```

### Load Order

The plugin **must** be listed after `shell-env` and before all consumer plugins in `.opencode/package.json`:

```json
{
  "dependencies": {
    "@techdivision/opencode-plugin-shell-env": "^1.2.0",
    "@techdivision/opencode-plugin-config": "^0.1.0",
    "@techdivision/opencode-plugin-time-tracking": "^1.4.0",
    "@techdivision/opencode-plugins": "github:techdivision/opencode-plugins"
  }
}
```

Order: **shell-env (1st)** --> **config (2nd)** --> all other plugins (3rd+)

## Configuration

### Plugin Config (`opencode-project.json`)

The plugin reads its own settings from the `config` section:

```json
{
  "config": {
    "sync_url": "https://n8n.example.com/webhook/oc-config-sync",
    "sync_token": "optional-bearer-token"
  }
}
```

Or via environment variables (loaded by `shell-env` from `.env`):

```bash
OC_CONFIG_SYNC_URL=https://n8n.example.com/webhook/oc-config-sync
OC_CONFIG_SYNC_TOKEN=optional-bearer-token
OPENCODE_USER_EMAIL=user@example.com
```

Resolution order: `config.sync_url` in opencode-project.json --> `{env:VAR}` placeholder --> `process.env.OC_CONFIG_SYNC_URL` fallback --> skip webhook.

### Config Cascade (3 Layers)

```
Layer 1 (Base):     ~/.config/opencode/opencode-project.json    Global defaults
Layer 2 (Override): <project>/.opencode/opencode-project.json   Project overrides
                    ──────────────────────────────────────────
                    = "Local Config" (deep-merge, Layer 2 wins)

Layer 3 (Remote):   Webhook response                            Remote defaults
                    ──────────────────────────────────────────
                    = "Final Config" (deep-merge: remote as base, local wins)
```

**Merge rule:** `deepmerge(remote, local)` -- **local always wins**.

- Both values are objects --> merge recursively
- Local has a value --> local wins (regardless of type)
- Only remote has a value --> remote value is adopted (new defaults)
- Arrays --> local array replaces remote array completely

Protected top-level fields (`$schema`, `version`) are never overwritten by the webhook.

### Minimal Project Config (Seed)

The minimum a project needs in `<project>/.opencode/opencode-project.json`:

```json
{
  "jira": {
    "project": "MYPROJ",
    "base_url": "https://your-instance.atlassian.net"
  },
  "time_tracking": {
    "valid_projects": ["MYPROJ"]
  }
}
```

The webhook uses these seed values (e.g. `jira.project`) to look up all remaining configuration from JIRA API and Google Sheets automatically.

## Webhook API

### Request

```
POST {sync_url}
Content-Type: application/json
Authorization: Bearer {sync_token}   (optional)
```

#### Payload

```json
{
  "plugin_version": "0.1.0",
  "email": "user@example.com",
  "plugins": ["config", "time-tracking", "jira", "shell-env"],
  "config": {
    "jira": {
      "project": "MYPROJ",
      "base_url": "https://your-instance.atlassian.net"
    },
    "time_tracking": {
      "valid_projects": ["MYPROJ"]
    }
  }
}
```

| Field | Source | Description |
|---|---|---|
| `plugin_version` | `plugin.json` version | Config plugin version for compatibility check |
| `email` | `process.env.OPENCODE_USER_EMAIL` | Identifies the user (Google Sheet, JIRA lookups) |
| `plugins` | `discoverPlugins()` | List of all discovered plugin names |
| `config` | Merged local config (Global + Project) | Entire local config as seed for the webhook |

### Response

```json
{
  "version": "0.1.0",
  "config": {
    "jira": {
      "project": "MYPROJ",
      "workflow": { "status": { "open": { "name": "Open", "id": "1" } } },
      "tempo": { "account_field_id": "customfield_10039", "accounts": {} }
    },
    "time_tracking": {
      "agent_defaults": { "@implementation": { "issue_key": "MYPROJ-5" } },
      "pricing": { "periods": [] }
    }
  }
}
```

| Field | Description |
|---|---|
| `version` | Minimum plugin version this config was generated for |
| `config` | Remote config sections, keys match plugin names (`_` instead of `-`) |

**Version compatibility:** If `response.version > plugin_version`, the response is discarded with a warning ("config was generated for a newer plugin version, please update").

### Error Behavior

| Situation | Behavior |
|---|---|
| `sync_url` not configured | Webhook skipped, local config applies |
| `OPENCODE_USER_EMAIL` not set | Webhook skipped, local config applies |
| Webhook unreachable (timeout 5s) | Local config applies, warning logged |
| Webhook returns HTTP 4xx/5xx | Local config applies, warning logged |
| Response validation fails | Local config applies, warning logged |
| Version incompatibility | Local config applies, warning logged |
| No local config present | Empty object `{}`, only remote if available |

In **all error cases** the plugin continues without blocking. The local config is always written to `process.env.OPENCODE_PROJECT_CONFIG` -- even without a webhook response.

## Integration in Existing Plugins

Consumer plugins should read from `process.env` first, with a file fallback:

```typescript
// Config from process.env (set by config plugin)
// Fallback to local file if config plugin is not installed
function loadConfig(sectionKey: string): Record<string, unknown> {
  const envConfig = process.env.OPENCODE_PROJECT_CONFIG
  if (envConfig) {
    try {
      const parsed = JSON.parse(envConfig)
      if (parsed[sectionKey]) return parsed[sectionKey]
    } catch { /* fallback */ }
  }
  try {
    const raw = fs.readFileSync('.opencode/opencode-project.json', 'utf-8')
    return JSON.parse(raw)[sectionKey] ?? {}
  } catch { return {} }
}

// Usage
const myConfig = loadConfig('time_tracking')
```

This change is **backwards-compatible**: if the config plugin is not installed, the fallback reads the local file directly.

## Schema Validation

Each plugin can declare its own JSON Schema for its config section via `configSchema` in `plugin.json`. The config plugin validates each webhook response section against the corresponding plugin's schema using [Ajv](https://ajv.js.org/).

**Validation happens per section, not all-or-nothing.** If the `jira` section fails validation, `time_tracking` data can still be used.

Example `plugin.json` with schema declaration:

```json
{
  "name": "time-tracking",
  "description": "Automatic time tracking plugin for OpenCode.",
  "category": "standard",
  "version": "1.4.0",
  "configSchema": "schemas/config.schema.json"
}
```

| Situation | Behavior |
|---|---|
| Section has schema + validates | Section included in merge |
| Section has schema + fails validation | Section skipped, warning logged |
| Section has no schema | Included without validation |

The `configSchema` field is **optional** and backwards-compatible. Plugins without it continue to work -- their sections are merged without schema validation.

For details on the validation architecture, see [arc42 Konzepte (8.10)](docs/arc42/08-konzepte.md).

## Development

```bash
git clone https://github.com/techdivision/opencode-plugin-config.git
cd opencode-plugin-config
npm install
npm link  # For local development
```

### Project Structure

```
opencode-plugin-config/
  package.json
  plugin.json
  tsconfig.json
  schemas/
    config.schema.json         Own config schema (for "config" section)
  src/
    config.ts                  Entry point (plugin function)
    services/
      ConfigLoader.ts          Reads + merges local config cascade
      ConfigSyncer.ts          Webhook call
      ConfigMerger.ts          Deep-merge with local precedence
      SchemaValidator.ts       Ajv-based schema validation per section
    types/
      PluginConfig.ts          { sync_url, sync_token }
      SyncPayload.ts           Webhook request type
      SyncResponse.ts          Webhook response type
  n8n/
    workflow.json              Exported n8n workflow
    README.md                  n8n setup instructions
```

## Architecture Documentation

Detailed architecture docs live alongside the source:

| Document | Content |
|---|---|
| [Feature: feat-cfg](docs/req42/04-product-backlog/features/feat-cfg.md) | Feature description and scope |
| [Bausteinsicht (5.5)](docs/arc42/05-bausteinsicht.md) | Building block view of the config plugin |
| [Laufzeitsicht (6.6)](docs/arc42/06-laufzeitsicht.md) | Runtime scenario: init sequence |
| [Konzepte (8.8, 8.9, 8.10)](docs/arc42/08-konzepte.md) | Config cascade, webhook sync, schema validation |
| [ADR-009 to ADR-012](docs/arc42/09-entscheidungen/) | Architecture Decision Records |

## License

MIT

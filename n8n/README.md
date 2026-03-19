# n8n Config-Sync Webhook

| Attribut | Wert |
|----------|------|
| **Workflow** | `POST /oc-config-sync` |
| **Datei** | `workflow.json` |
| **Version** | 0.1.0 |

## 1. Uebersicht

Der n8n-Workflow implementiert den **Config-Sync-Webhook** fuer das
`opencode-plugin-config`. Er empfaengt Seed-Daten vom Config-Plugin
(Plugin-Version, User-Email, installierte Plugins, lokale Config), fuehrt
Lookups in der JIRA API und einem Google Sheet durch, und liefert die
zusammengebaute Remote-Config als JSON-Response zurueck.

Das Config-Plugin merged diese Response dann mit der lokalen Config
(Lokal gewinnt) und stellt das Ergebnis ueber
`process.env.OPENCODE_PROJECT_CONFIG` allen nachfolgenden Plugins zur
Verfuegung.

---

## 2. Workflow-Ablauf

```
Trigger: POST /oc-config-sync
  |
  +-- 1. Payload lesen:
  |      - plugin_version (Kompatibilitaetspruefung)
  |      - email (User-Identifikation)
  |      - plugins[] (erkannte Plugin-Namen)
  |      - config (gesamte lokale Config als Seed)
  |
  +-- 2. Aus config Seed-Daten extrahieren:
  |      - config.jira.project -> JIRA-Projekt-Key
  |      - config.jira.base_url -> JIRA-Instanz
  |      - config.time_tracking.valid_projects -> Projekt-Liste
  |
  +-- 3. Fuer jedes Plugin in plugins[]:
  |      |
  |      +-- "jira" in plugins?
  |      |     +-- Google Sheet: User-Projects -> base_url
  |      |     +-- JIRA API: GET /rest/api/3/project/{key}/statuses
  |      |     +-- Google Sheet: Transitions -> Transition-Defaults
  |      |     +-- Google Sheet: Settings -> WIP-Limits, Tempo Field IDs
  |      |     +-- Google Sheet: Tempo-Accounts -> Account-Mappings
  |      |
  |      +-- "time-tracking" in plugins?
  |            +-- Google Sheet: User-Projects -> default_issue, default_account
  |            +-- Google Sheet: Agent-Defaults -> Agent-Mappings
  |            +-- Google Sheet: Pricing -> Pricing-Perioden
  |
  +-- 4. Config-JSON zusammenbauen mit version
  |
  +-- 5. Response zurueckgeben
```

### Request-Payload

```json
{
  "plugin_version": "0.1.0",
  "email": "t.wagner@techdivision.com",
  "plugins": ["config", "time-tracking", "jira", "shell-env"],
  "config": {
    "jira": {
      "project": "COPSPA",
      "base_url": "https://techdivision.atlassian.net"
    },
    "time_tracking": {
      "valid_projects": ["COPSPA"],
      "global_default": {
        "issue_key": "COPSPA-5",
        "account_key": "TD_KS_1100_KI_Arbeitsweise"
      }
    }
  }
}
```

| Feld | Quelle | Beschreibung |
|---|---|---|
| `plugin_version` | `plugin.json` | Version des Config-Plugins fuer Kompatibilitaetspruefung |
| `email` | `process.env.OPENCODE_USER_EMAIL` | Identifiziert den User (Google Sheet Lookup) |
| `plugins` | `discoverPlugins()` | Liste aller erkannten Plugin-Namen |
| `config` | Gemergte lokale Config | Gesamte lokale Config als Seed fuer den Webhook |

### Response

```json
{
  "version": "0.1.0",
  "config": {
    "jira": { "..." },
    "time_tracking": { "..." }
  }
}
```

| Feld | Beschreibung |
|---|---|
| `version` | Minimale Plugin-Version fuer die diese Config generiert wurde |
| `config` | Remote-Config-Sections (Keys = Plugin-Namen mit `_` statt `-`) |

---

## 3. Google Sheet Struktur

Das Google Sheet dient als zentrale, manuell editierbare Konfigurationsdatenbank.
Es besteht aus 6 Tabs:

### Tab "User-Projects"

**Lookup:** `email` + `project_key`

| email | project_key | default_issue | default_account | jira_base_url |
|---|---|---|---|---|
| t.wagner@techdivision.com | COPSPA | COPSPA-5 | TD_KS_1100_KI_Arbeitsweise | techdivision.atlassian.net |
| m.mustermann@techdivision.com | PROJ | PROJ-100 | TD_KS_2000_Projekt | techdivision.atlassian.net |

Zentrale User-Projekt-Zuordnung. Liefert die Basis-Defaults (Default-Issue,
Default-Account) fuer einen bestimmten User in einem bestimmten Projekt.

### Tab "Agent-Defaults"

**Lookup:** `project_key`

| project_key | agent_name | issue_key | account_key | subagents |
|---|---|---|---|---|
| COPSPA | @implementation | COPSPA-5 | TD_KS_1100_KI_Arbeitsweise | @reviewer,@tester,@developer,@build,@plan,@git-flow |

Definiert pro Projekt und Agent, welches JIRA-Issue und welcher Tempo-Account
als Default verwendet wird. Die `subagents`-Spalte ist eine kommaseparierte
Liste von Sub-Agenten, die den gleichen Default erben.

### Tab "Tempo-Accounts"

**Lookup:** `project_key`

| project_key | account_key | account_id | display_value |
|---|---|---|---|
| COPSPA | TD_KS_1165_CoP_SPA | 2847 | 1165 \| CoP Smart Process Automation SPA |
| COPSPA | TD_KS_1100_KI_Arbeitsweise | 2936 | 1100 \| KI Arbeitsweise |

Mapping zwischen den Tempo-Account-Keys (wie sie in der Config verwendet
werden) und den tatsaechlichen Tempo-Account-IDs und Anzeigenamen.

### Tab "Pricing"

**Lookup:** Alle Zeilen (kein Filter-Key)

| model | input_price | output_price | valid_from |
|---|---|---|---|
| anthropic/claude-opus-4 | 15 | 75 | 2025-11-01 |
| anthropic/claude-sonnet-4 | 3 | 15 | 2025-11-01 |
| anthropic/claude-opus-4-5 | 5 | 25 | 2025-12-20 |

Preise pro Model in USD/MTok. Das `valid_from`-Datum bestimmt die
Gueltigkeitsperiode. Alle Zeilen werden gelesen und nach `valid_from`
gruppiert zu Pricing-Perioden zusammengebaut.

### Tab "Transitions"

**Lookup:** `project_key`

| project_key | semantic_name | from_status | to_status |
|---|---|---|---|
| COPSPA | start_epic | open | refinement |
| COPSPA | start_work | selected | in_progress |
| COPSPA | complete_work | in_progress | test |
| COPSPA | close_ticket | testing_done | closed |

Definiert die semantischen Workflow-Transitions pro Projekt. Die
`from_status` und `to_status` Werte referenzieren die normalisierten
Status-Keys aus der JIRA API.

### Tab "Settings"

**Lookup:** `project_key`

| project_key | key | value |
|---|---|---|
| COPSPA | wip_limit.in_progress | 3 |
| COPSPA | wip_limit.in_review | 5 |
| COPSPA | wip_limit.testing | 2 |
| COPSPA | tempo.account_field_id | customfield_10039 |
| COPSPA | tempo.team_field_id | customfield_10038 |

Generischer Key-Value-Store fuer projektspezifische Einstellungen.
Dot-Notation im Key (`wip_limit.in_progress`) wird vom Webhook in
verschachtelte Objekte aufgeloest.

---

## 4. JIRA API Integration

### Datenfluss Workflow-Statuses

Der Webhook holt die Workflow-Statuses per JIRA REST API und normalisiert
die Status-Namen zu semantischen Keys:

**Endpoint:** `GET /rest/api/3/project/{key}/statuses`

```
JIRA API Response:                  Config-Response:
[                                   "workflow": {
  { "name": "Offen",                 "status": {
    "id": "1",                          "open": {
    "statusCategory": "new" },            "name": "Offen",
  { "name": "In Arbeit",                 "id": "1"
    "id": "3",                          },
    "statusCategory":                   "in_progress": {
      "indeterminate" }                   "name": "In Arbeit",
]                                         "id": "3"
                                        }
                                      }
                                    }
```

### Status-Normalisierung

Die Normalisierung von JIRA-Status-Namen zu semantischen Keys
(z.B. `"In Arbeit"` -> `"in_progress"`) kann auf zwei Wegen erfolgen:

1. **Regelbasiert im Webhook:** Feste Mapping-Regeln im n8n-Workflow
   (z.B. `statusCategory` + Pattern-Matching auf den Namen)
2. **Ueber Mapping-Spalte im Google Sheet:** Ein zusaetzlicher Tab oder
   Spalte die JIRA-Status-Namen auf semantische Keys mappt

### Authentifizierung

Die JIRA API wird mit Basic Auth (Email + API Token) aufgerufen:

```
Authorization: Basic base64({JIRA_EMAIL}:{JIRA_API_TOKEN})
```

---

## 5. Environment-Variablen

### n8n Workflow Credentials

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `JIRA_BASE_URL` | JIRA-Instanz URL (z.B. `https://techdivision.atlassian.net`) | Ja |
| `JIRA_EMAIL` | JIRA Service-Account Email | Ja |
| `JIRA_API_TOKEN` | JIRA API Token (Basic Auth) | Ja |
| `GOOGLE_SHEET_ID` | ID des Config-Google-Sheets | Ja |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Service Account Credentials (JSON) | Ja |

Diese Variablen werden in n8n als **Credentials** konfiguriert, nicht als
Klartext im Workflow.

### GitHub Actions Secrets (Deployment)

| Secret | Beschreibung |
|---|---|
| `N8N_BASE_URL` | URL der n8n-Instanz (z.B. `https://n8n.example.com`) |
| `N8N_API_KEY` | n8n API Key fuer Workflow-Import |

---

## 6. Deployment

Der n8n-Workflow wird automatisch ueber GitHub Actions deployed, wenn sich
`n8n/workflow.json` auf dem `main`-Branch aendert:

```yaml
# .github/workflows/n8n-deploy.yml
name: Deploy n8n Workflow
on:
  push:
    paths: ['n8n/workflow.json']
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Import workflow to n8n
        run: |
          curl -X POST "$N8N_BASE_URL/api/v1/workflows" \
            -H "X-N8N-API-KEY: $N8N_API_KEY" \
            -H "Content-Type: application/json" \
            -d @n8n/workflow.json
        env:
          N8N_BASE_URL: ${{ secrets.N8N_BASE_URL }}
          N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
```

### Workflow-Export

Aenderungen am Workflow werden in n8n vorgenommen und dann als JSON
exportiert:

1. Workflow in n8n bearbeiten und testen
2. Workflow exportieren: **n8n UI -> Workflow -> Download**
3. Exportierte Datei als `n8n/workflow.json` committen
4. Push auf `main` -> GitHub Actions deployed automatisch

---

## 7. Lokale Entwicklung

### n8n lokal starten

```bash
# Via Docker
docker run -it --rm \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n

# Oder via npm
npx n8n
```

### Workflow importieren

1. n8n UI oeffnen: `http://localhost:5678`
2. **Workflows -> Import from File** -> `n8n/workflow.json` auswaehlen
3. Credentials konfigurieren (JIRA + Google Sheets)
4. Workflow aktivieren

### Test-Request

```bash
curl -X POST http://localhost:5678/webhook/oc-config-sync \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_version": "0.1.0",
    "email": "test@example.com",
    "plugins": ["config", "time-tracking", "jira"],
    "config": {
      "jira": {
        "project": "TEST",
        "base_url": "https://example.atlassian.net"
      },
      "time_tracking": {
        "valid_projects": ["TEST"],
        "global_default": {
          "issue_key": "TEST-1",
          "account_key": "TD_KS_0000_Test"
        }
      }
    }
  }'
```

### Erwartete Response (Beispiel)

```json
{
  "version": "0.1.0",
  "config": {
    "jira": {
      "project": "TEST",
      "base_url": "https://example.atlassian.net",
      "workflow": {
        "status": {
          "open": { "name": "Offen", "id": "1" },
          "in_progress": { "name": "In Arbeit", "id": "3" }
        },
        "defaults": {
          "transitions": {
            "start_work": { "from": "selected", "to": "in_progress" },
            "complete_work": { "from": "in_progress", "to": "test" }
          }
        }
      },
      "tempo": {
        "account_field_id": "customfield_10039",
        "accounts": {}
      }
    },
    "time_tracking": {
      "valid_projects": ["TEST"],
      "global_default": {
        "issue_key": "TEST-1",
        "account_key": "TD_KS_0000_Test"
      },
      "agent_defaults": {},
      "pricing": {
        "ratio": { "input": 0.8, "output": 0.2 },
        "default": { "input": 3, "output": 15 },
        "periods": [
          {
            "from": "2025-11-01",
            "models": {
              "anthropic/claude-sonnet-4": { "input": 3, "output": 15 }
            }
          }
        ]
      }
    }
  }
}
```

---

## 8. Dateien

| Datei | Beschreibung |
|---|---|
| `workflow.json` | Exportierter n8n-Workflow (wird bei Aenderungen auf `main` automatisch deployed) |
| `README.md` | Diese Datei |

---

## Quellen

- [README.md](../README.md) -- Projekt-Dokumentation (Abschnitte: "Webhook API", "Configuration", "CI/CD")
- [docs/arc42/05-bausteinsicht.md](../docs/arc42/05-bausteinsicht.md) -- Bausteinsicht (5.5 Architektur)
- [docs/arc42/06-laufzeitsicht.md](../docs/arc42/06-laufzeitsicht.md) -- Laufzeitsicht (6.6 Config-Sync beim Plugin-Start)
- [docs/arc42/08-konzepte.md](../docs/arc42/08-konzepte.md) -- Konzepte (8.9 Config Cascade, 8.10 Validierung)
- [docs/arc42/09-entscheidungen/](../docs/arc42/09-entscheidungen/) -- ADR-009 bis ADR-012

# my-mcps

Personal MCP servers.

---

## tempo-mcp

Wanna just see how it works? Look [here](https://www.loom.com/share/abce116afa5e4ab2b470e0ef5c1bb214)!

Tempo time tracking MCP — log, view, edit, and delete Tempo worklogs directly from OpenCode (or any MCP-compatible client).

### Prerequisites

- Node.js ≥ 18
- Access to a Jira + Tempo workspace

### Installation

```bash
git clone https://github.com/amelieengelmaier-on/my-mcps.git
cd my-mcps/tempo-mcp
npm install
cp .env.example .env
```

### Environment variables

Edit `tempo-mcp/.env`:

```env
TEMPO_API_TOKEN=       # Tempo API token
TEMPO_ACCOUNT_ID=      # Your Atlassian account ID

JIRA_BASE_URL=         # e.g. https://your-org.atlassian.net
JIRA_USER_EMAIL=       # Your Atlassian login email
JIRA_API_TOKEN=        # Atlassian API token
```

#### Where to get each value

| Variable | Where to get it |
|---|---|
| `TEMPO_API_TOKEN` | Tempo → **Settings** → **API Integration** → **New Token** (scopes: *View worklogs* + *Manage worklogs*) |
| `TEMPO_ACCOUNT_ID` | Open `https://<your-org>.atlassian.net/rest/api/3/myself` in a browser while logged in → copy the `accountId` field |
| `JIRA_BASE_URL` | Your Atlassian site URL, e.g. `https://your-org.atlassian.net` |
| `JIRA_USER_EMAIL` | The email you use to log in to Atlassian |
| `JIRA_API_TOKEN` | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) → **Create API token** |

> **CapEx initiative:** `tempo_log_time` requires a `Tempo accountKey` on every call. Use the `capex-time-logging` skill to review Jira's `CAPEX?` and `CAPEX Code`, discover/select the corresponding Tempo account key, and confirm the pair per issue. Do not hardcode initiative mappings.

### OpenCode setup

Add the MCP server to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "tempo": {
      "type": "local",
      "command": "/absolute/path/to/my-mcps/tempo-mcp/start.sh"
    }
  }
}
```

> **Tip:** Use the absolute path. `start.sh` sources the `.env` automatically, so no extra environment wiring is needed.

Restart OpenCode — the `tempo_*` tools will appear in the tool list.

### Available tools

| Tool | Description |
|---|---|
| `tempo_log_time` | Log time to a Jira issue with an explicit confirmed Tempo `accountKey` |
| `tempo_get_my_worklogs` | List your worklogs (defaults to current week) |
| `tempo_get_issue_worklogs` | List all worklogs on a specific issue |
| `tempo_update_worklog` | Update time, description, or date on an existing worklog |
| `tempo_delete_worklog` | Delete a worklog by ID |
| `tempo_list_work_attributes` | List Tempo work attributes (useful for finding CapEx keys) |

### Usage examples

```
log 2h on the current Jira ticket with accountKey <confirmed-account-key> — refactoring the auth flow
show my worklogs for this week
update worklog 98765 to 1h30m
delete worklog 98765
```

### Review-first CapEx logging skill

This repo includes an OpenCode skill at `skills/capex-time-logging/SKILL.md`.
Install it by copying that folder to `~/.config/opencode/skills/` or adding this repo's `skills` directory to `skills.paths`.

The skill makes Jira the source of truth before Tempo logging:

1. Resolves the Jira ticket from the current repository/session context, then asks you to confirm it.
2. Fetches the locally configured `CAPEX?` and `CAPEX Code` Jira fields and requires explicit CAPEX Code confirmation.
3. Shows the Jira CAPEX Code and discovers/selects the corresponding Tempo account key without assuming a hardcoded mapping.
4. Shows the exact Jira field update and Tempo write calls as a dry run.
5. Waits for explicit user confirmation before setting `CAPEX?`, setting `CAPEX Code`, or calling `tempo_log_time`.

### Goes further with the session-processing skill

The MCP works great on its own, but if you use OpenCode with an Obsidian-based second brain, the [`session-processing`](https://github.com/amelieengelmaier-on/my-mcps) skill turns time tracking into something that basically runs itself.

**The idea:** at the end of a coding session you say _"process session"_. The skill:

1. **Computes active time automatically** — it reads the real OpenCode message timestamps for that session and subtracts idle gaps over 60 minutes from the wall-clock duration. No more guessing "was that 2h or 3h?".
2. **Proposes the Tempo entry for your approval** — it pulls the Jira ticket and time from your session note's frontmatter, drafts a description from your session summary, and shows you exactly what it's about to log before touching anything:

   ```
   Ready to log to Tempo:
     Ticket:      COP-123
     Date:        2026-07-16
     Time:        1h43m
     Account:     <confirmed-account-key>
     Description: Refactored auth middleware to remove race condition

   Log it? (yes / no / edit)
   ```

3. **Reviews CAPEX fields first** — the skill shows `CAPEX?`, `CAPEX Code`, and the exact Jira/Tempo writes before anything changes.
4. **Marks the session note** with `tempo-logged: true` so it never double-logs.

The result: you write code, you say "process session", you confirm one prompt. Done. Time is logged, Jira is updated, session is archived.

**To use it:** the skill lives in `~/.config/opencode/skills/` — if you don't have it yet, reach out to [@amelieengelmaier-on](https://github.com/amelieengelmaier-on). Your session notes need a `jira-ticket:` and the active-time computation fills in `time-spent:` automatically.

---

### Manual start (testing)

```bash
cd tempo-mcp
npm start
```

The server communicates over stdio and is meant to be spawned by an MCP client — it won't produce visible output when run directly.

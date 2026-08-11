---
name: capex-time-logging
description: Review-first Jira CapEx and Tempo time logging. Use when logging time, setting CAPEX?, setting CAPEX Code, or preparing a Tempo worklog for Jira issues.
---

# CapEx Time Logging

Use Jira as the source of truth for the CAPEX initiative. Never infer a financial code or Tempo account key from ticket text, project key, summary, branch name, or memory. A Jira CAPEX Code and Tempo account key are related initiative identifiers, but they are not assumed to be identical.

## Required Jira fields

- Read the local `jira_capex_fields.capex` and `jira_capex_fields.code` values
  from `~/.config/opencode/tempo-session.yaml`; do not assume field IDs.

## Workflow

1. **Resolve the Jira ticket.** If the user supplied an issue key, use it. If
   not, inspect the current repository remote, branch name, recent commits,
   pull request context, current session summary, and project note. Search Jira
   for matching issues and present the best candidates with their keys and
   summaries. Ask the user to confirm one ticket before continuing. If no
   candidate is reliable, ask for the issue key. Never choose silently.

2. Fetch the Jira issue with at least these fields:
   - `summary`
   - `status`
    - the configured CapEx field ID
    - the configured CapEx code field ID
3. Fetch the parent issue key, if any.
4. Read the Jira `CAPEX Code`. If it is already set, show it. If it is empty,
   ask the user for the exact CAPEX Code. Sibling issues and Jira metadata may
   suggest valid values, but they must never be selected automatically.

5. If `CAPEX Code` is empty, query sibling issues with `parent = <parent key>` and these fields:
    - the configured CapEx field ID
    - the configured CapEx code field ID
   - issue key
   - Keep only siblings where `CAPEX?` is `Yes` and `CAPEX Code` is non-empty.
    - If all eligible siblings agree on one code, suggest that code with evidence, but still ask the user to confirm it.
    - If siblings split across multiple codes, present the distinct options and ask the user to choose.
    - If there is no parent, or no eligible classified siblings, ask the user for the exact code.
6. Read the CapEx state:
   - If `CAPEX?` is `Yes` and `CAPEX Code` has a value, show that code as eligible.
   - If `CAPEX Code` is empty, fetch Jira field metadata for the issue type and show available options if metadata exposes them.
   - If metadata does not expose options, ask the user to choose the exact code.
7. Prepare a dry-run summary before writes:
   - Jira issue key
   - Current `CAPEX?`
   - Current `CAPEX Code`
   - Proposed Jira field update, if needed
   - Suggested code only as a suggestion, with sibling keys and matching code
    - Proposed `tempo_log_time` call, including the exact confirmed Tempo `accountKey`
8. Wait for explicit user confirmation before each write:
   - setting `CAPEX?` to `Yes`
   - setting `CAPEX Code` to the selected value
    - calling `tempo_log_time`

9. If the Jira CAPEX Code is known but the Tempo account key is not, call
   `tempo_list_work_attributes` to discover available Tempo values. Ask the
   user to confirm the Jira CAPEX Code and corresponding Tempo account key as a
   pair. Never create a hardcoded mapping table.

## Write shapes

Only use the exact value the user confirmed.

```json
{
  "fields": {
    "<configured-capex-field-id>": { "value": "Yes" },
    "<configured-capex-code-field-id>": { "value": "<confirmed-code>" }
  }
}
```

```json
{
  "issueKey": "COP-123",
  "timeSpent": "2h",
  "description": "Worked on reviewed scope",
  "date": "2026-07-29",
  "accountKey": "<confirmed-account-key>"
}
```

If Jira returns a different field shape, preserve that shape and replace only the confirmed value.

## Hard stops

- Do not log time without an explicit confirmed Tempo `accountKey`.
- Do not set either CapEx field without confirmation.
- Do not auto-pick from multiple codes.
- Do not use project-prefix mappings.
- Do not classify with an LLM.
- Do not continue with an empty or unconfirmed Jira ticket.
- Do not continue with an empty or unconfirmed Jira CAPEX Code.

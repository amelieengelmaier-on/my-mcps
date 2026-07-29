---
name: capex-time-logging
description: Review-first Jira CapEx and Tempo time logging. Use when logging time, setting CAPEX?, setting CAPEX Code, or preparing a Tempo worklog for Jira issues.
---

# CapEx Time Logging

Use Jira as the source of truth. Never infer a financial code from ticket text, project key, summary, branch name, or memory.

## Required Jira fields

- `customfield_17056`: `CAPEX?`
- `customfield_17057`: `CAPEX Code`

## Workflow

1. Fetch the Jira issue with at least these fields:
   - `summary`
   - `status`
   - `customfield_17056`
   - `customfield_17057`
2. Fetch the parent issue key, if any.
3. If `CAPEX Code` is empty, query sibling issues with `parent = <parent key>` and these fields:
   - `customfield_17056`
   - `customfield_17057`
   - issue key
   - Keep only siblings where `CAPEX?` is `Yes` and `CAPEX Code` is non-empty.
   - If all eligible siblings agree on one code, suggest that code with evidence: sibling keys and the matching code.
   - If siblings split across multiple codes, present the distinct options and ask the user to choose.
   - If there is no parent, or no eligible classified siblings, do not guess.
4. Read the CapEx state:
   - If `CAPEX?` is `Yes` and `CAPEX Code` has a value, show that code as eligible.
   - If `CAPEX Code` is empty, fetch Jira field metadata for the issue type and show the available `customfield_17057` options if metadata exposes them.
   - If metadata does not expose options, ask the user to choose the exact code.
5. Prepare a dry-run summary before writes:
   - Jira issue key
   - Current `CAPEX?`
   - Current `CAPEX Code`
   - Proposed Jira field update, if needed
   - Suggested code only as a suggestion, with sibling keys and matching code
   - Proposed `tempo_log_time` call, including the exact `accountKey`
6. Wait for explicit user confirmation before each write:
   - setting `CAPEX?` to `Yes`
   - setting `CAPEX Code` to the selected value
   - calling `tempo_log_time`

## Write shapes

Only use the exact value the user confirmed.

```json
{
  "fields": {
    "customfield_17056": { "value": "Yes" },
    "customfield_17057": { "value": "CSW_WS02" }
  }
}
```

```json
{
  "issueKey": "COP-123",
  "timeSpent": "2h",
  "description": "Worked on reviewed scope",
  "date": "2026-07-29",
  "accountKey": "CSW_WS02"
}
```

If Jira returns a different field shape for `customfield_17057`, preserve that shape and replace only the confirmed value.

## Hard stops

- Do not log time without an explicit `accountKey`.
- Do not set either CapEx field without confirmation.
- Do not auto-pick from multiple codes.
- Do not use project-prefix mappings.
- Do not classify with an LLM.

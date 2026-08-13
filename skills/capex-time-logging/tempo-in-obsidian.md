# Tempo in Obsidian

Use this reference from the Obsidian `session-processing` skill when a saved session should be considered for Tempo logging.

## Session metadata

Read these frontmatter fields from the session note:

```yaml
jira-ticket: COP-123
time-spent: ""
tempo-logged: false
tempo-worklog-id: ""
```

- `jira-ticket` is required. Ask if it is missing; never guess.
- Use `time-spent` when present.
- Otherwise calculate active time from the OpenCode session timestamps using the configured gap threshold.
- Treat `tempo-logged: true` as already complete and do not write again.
- If `tempo-worklog-id` exists while `tempo-logged` is false, stop and ask the user to resolve the state.

## Processing flow

1. Read the session note and derive the Jira ticket, duration, date, and description.
2. Resolve and confirm the Jira issue if the note does not contain a confirmed ticket.
3. Run the `capex-time-logging` review before any Tempo or Jira write.
4. Show one dry-run summary containing the ticket, date, duration, description, CapEx state, and confirmed Tempo `accountKey`.
5. Wait for explicit approval. `yes` writes; `edit` revises the proposal; `no` leaves the note unchanged.
6. Call `tempo_log_time` only with the confirmed account key.
7. After a successful write, update the note with:

```yaml
tempo-logged: true
tempo-worklog-id: "<returned-worklog-id>"
```

8. If the write fails, leave `tempo-logged: false`, preserve the note, and report the failure for retry.

## Configuration

Use the optional local configuration file when available:

```text
~/.config/opencode/tempo-session.yaml
```

Keep credentials and personal Tempo account keys in the MCP environment or another approved secret store, never in the session note or shared skill files.

Calendar subtraction is opt-in. If it is disabled or unavailable, calculate time from the session timestamps without calling Calendar.

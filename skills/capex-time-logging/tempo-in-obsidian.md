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

1. Read the session note and derive the Jira ticket, date, and description.
2. Automatically call `calculate_session_time` with the OpenCode session
   timestamps. If Calendar subtraction is enabled and available, include the
   eligible Calendar events in the same call. Use its `total_seconds` and
   `by_day` result for the duration.
3. Resolve and confirm the Jira issue if the note does not contain a confirmed ticket.
4. Run the `capex-time-logging` review before any Tempo or Jira write.
5. Show one dry-run summary containing the ticket, date, duration, description, CapEx state, and confirmed Tempo `accountKey`.
6. Wait for explicit approval. `yes` writes; `edit` revises the proposal; `no` leaves the note unchanged.
7. Call `tempo_log_time` only with the confirmed account key.
8. After a successful write, update the note with:

```yaml
tempo-logged: true
tempo-worklog-id: "<returned-worklog-id>"
```

9. If the calculator or write fails, leave `tempo-logged: false`, preserve the note, and report the failure for retry.

## Configuration

Use the optional local configuration file when available:

```text
~/.config/opencode/tempo-session.yaml
```

Keep credentials and personal Tempo account keys in the MCP environment or another approved secret store, never in the session note or shared skill files.

The local config may also contain `capex_initiatives`, a small initiative-to-code
dictionary. Use it only to make a scoped suggestion. For example, `CSW_02` may
be suggested for explicitly identified SOX or compliance automation work under
the Digital innovation build initiative. It must not be suggested for manual
SOX/compliance work, and the user must still confirm it against Jira.

Calendar subtraction is opt-in. If it is disabled or unavailable, calculate time from the session timestamps without calling Calendar.

# Tempo + Obsidian Session Automation Plan

## Goal

Provide a reusable OpenCode workflow that:

1. Summarizes a coding session into an Obsidian session note.
2. Calculates or accepts the time spent for that session.
3. Prepares a Tempo worklog against the relevant Jira issue.
4. Shows the exact proposed write and waits for explicit approval.
5. Records the Tempo worklog ID back in Obsidian.
6. Still supports standalone Tempo use and weekly ticket-time reporting.

The shared implementation should be generic. User-specific paths, Tempo account
keys, working hours, project mappings, and credentials belong in local config.

## Evidence And Current State

- OpenCode registers a disabled local Tempo MCP at
  `~/.config/opencode/opencode.json:4-10`, starting
  `tempo-mcp/start.sh`.
- `tempo-mcp/index.ts:91-127` exposes `log_time`, which requires an explicit
  `accountKey`; it has no personal default. It resolves Jira keys to numeric
  issue IDs before calling Tempo API v4.
- The MCP also exposes worklog listing, update, delete, and attribute discovery
  tools (`index.ts:129-246`). It is already a suitable write boundary.
- The Obsidian session template already contains `jira-ticket`, `time-spent`,
  and `tempo-logged` fields at
  `Documents/brain/00-system/templates/session.md:1-13`.
- The session-processing skill computes active time from OpenCode timestamps
  with a configurable future gap threshold candidate, then has a review-first
  Tempo phase (`Documents/brain/40-skills/custom/session-processing/SKILL.md:77-139`
  and `:261-343`).
- The current skill contains personal project-path mappings, a stale `~/notes/brain`
  path, hardcoded CapEx field mappings, and an incorrect statement that the MCP
  supplies a default account key. These must be removed before sharing.
- The Slack thread `C09381H1G0Y`, parent timestamp
  `1785335687.959989`, confirms organizational interest. It links the personal
  MCP and an unofficial Tempo MCP. Iago's shared `ticket-time-tracker` skill
  uses Jira in-progress intervals, subtracts attended Google Calendar meetings,
  and asks for confirmation before submitting.
- The shared Drive skill (`capex-tracker-skill`) provides a useful complementary
  weekly estimator: configurable working window, Jira changelog intervals,
  attended-meeting subtraction, deterministic Python date math, dry-run output,
  and per-user Tempo configuration.

## Configuration Options

### Option A: Standalone Tempo MCP

Use the MCP directly for natural-language worklog operations.

- Best for users who do not use Obsidian.
- Supports log, list, update, delete, and attribute discovery.
- Requires a user-scoped Tempo token, Atlassian identity/config, and explicit
  account key where the Tempo instance requires one.
- No session summarization or automatic duration calculation.

Keep this path working independently. It is the minimum useful product and the
fallback when a vault or session record is unavailable.

### Option B: Weekly Jira + Calendar Tracker

Use the shared `ticket-time-tracker` workflow.

- Finds Jira tickets that entered the configured active-development status.
- Reconstructs status intervals from changelogs.
- Clamps intervals to configurable working hours and working days.
- Subtracts attended Calendar meetings, asking about tentative or unanswered
  invitations.
- Produces a report and optionally prepares daily Tempo worklogs.

This is useful for weekly reporting or when work happened outside OpenCode. Do
not merge it into the per-session workflow: its source of truth and unit of
accounting are different.

### Option C: Recommended Session + Obsidian + Tempo Adapter

Use the existing session-processing skill as the primary workflow, with the
Tempo MCP as the only write adapter.

1. `/save-session` creates a structured Obsidian note.
2. Processing derives a summary, project, Jira ticket, and duration.
3. Duration uses an explicit `time-spent` value first, then OpenCode timestamps.
4. Optional Calendar subtraction is enabled only by local config.
5. Processing checks for existing state and presents a dry-run worklog.
6. The user approves, edits, or declines the write.
7. The MCP creates the worklog.
8. The note stores `tempo-logged`, `tempo-worklog-id`, and the final status.

This is the recommended shared design because it preserves the existing
Obsidian workflow, uses the already-built MCP, works per session, and does not
make Calendar or Obsidian mandatory for standalone users.

## Shared Contract

### Session frontmatter

Add only the missing durable write reference:

```yaml
jira-ticket: ""
time-spent: ""
tempo-worklog-id: ""
```

Do not store tokens, email credentials, or personal filesystem paths in notes.

### Local configuration

Create a documented, optional file such as
`~/.config/opencode/tempo-session.yaml`:

```yaml
vault_path: ~/Documents/brain
sessions_rel_path: 20-work/sessions
dev_root: ~/Development
gap_threshold_minutes: 20
timezone: Europe/Zurich
working_hours:
  start: "09:00"
  end: "17:00"
working_days: [Mon, Tue, Wed, Thu, Fri]
subtract_calendar_meetings: false
capex_jira_fields: false
```

Rules:

- Missing file or field means documented default.
- `tempo_account_key` is required only when a Tempo write is requested.
- Per-project configuration may override the account key and active Jira status.
- Credentials remain in the Tempo MCP environment or an approved secret store.
- No shared file contains an individual token or account key.

### Project resolution

Replace the current personal path table with this deterministic lookup:

1. Read the session's `project` wiki-link.
2. Read the configured vault's `AGENTS.md` project table.
3. Extract the repository name from the project's Git URL.
4. Join it to local `dev_root`.
5. Pass the result to the OpenCode session lookup.

If the project is absent or the path does not exist, do not guess. Keep the
session usable and ask for a manual `time-spent` value.

### Duration provider chain

Use the first available provider:

1. Manual `time-spent` in the note.
2. OpenCode message timestamps for the resolved project and date, subtracting
   idle gaps above the configured threshold.
3. Optional Calendar subtraction for overlapping attended meetings.
4. Manual prompt if no trustworthy duration can be computed.

The weekly Jira + Calendar tracker remains a separate provider for batch
reporting and non-OpenCode work.

### Tempo write protocol

Before writing:

1. Skip when `tempo-logged: true`.
2. Surface an anomaly if `tempo-worklog-id` exists while `tempo-logged` is false.
3. Check the user's worklogs for the same Jira issue and date.
4. Show ticket, date, duration, account key, and description.
5. Wait for explicit `yes`, `no`, or `edit`.

Call the MCP with:

```text
issueKey: jira-ticket
timeSpent: time-spent
description: first useful sentence from ## Summary, max 100 characters
date: session date
accountKey: project override or local global config
```

On success, persist the returned worklog ID and links. On failure, leave the
note retryable and do not block ordinary session processing.

### CapEx behavior

Tempo account selection and Jira custom-field updates are separate concerns.

- Default: log only after the user supplies or confirms the account key.
- Default: do not mutate Jira CapEx fields.
- Optional CapEx field writes require a local opt-in, issue-specific writable
  field discovery, and a separate confirmation.
- Never infer financial codes from project prefixes, ticket text, or an LLM.
- Never ship a hardcoded organization-wide field-ID or account-key table.

## Implementation Phases

### Phase 1: Correct The Existing Skill

- Fix the stale vault path.
- Remove the claim that the MCP has a default account key.
- Replace personal project mappings with the AGENTS.md lookup.
- Remove hardcoded CapEx field-ID mappings.
- Document the existing MCP tool names and required inputs accurately.

### Phase 2: Introduce Local Configuration

- Document `tempo-session.yaml` and defaults.
- Add the global-to-project override chain.
- Make the gap threshold, timezone, working window, Calendar subtraction, and
  CapEx field behavior configurable.
- Keep secrets outside this file.

### Phase 3: Complete The Obsidian Contract

- Add `tempo-worklog-id` to the session template and vault `AGENTS.md`.
- Add a small Tempo section to the sessions dashboard showing pending,
  declined, failed, and logged sessions.
- Keep existing session creation, promotion, and non-Tempo workflows unchanged.

### Phase 4: Add Optional Calendar Subtraction

- Only call Calendar when the local flag is true and the MCP is available.
- Filter out declined, solo, all-day, and free events by default.
- Batch tentative or unanswered events into one user question.
- Report exactly what was subtracted.

### Phase 5: Package For Organization Use

- Move the shared skill and optional helper scripts to an organization-owned
  internal repository.
- Provide a setup guide for MCP enablement, credentials, local config, and
  project overrides.
- Provide a report-only mode that needs Jira + Calendar but no Tempo token.
- Provide a standalone Tempo mode for users without Obsidian.
- Keep the weekly tracker as a complementary skill in the same repository or a
  clearly linked package.

### Phase 6: Pilot And Rollout

Pilot with at least two users and different projects/account keys.

- Compare computed session time with manual estimates.
- Compare weekly tracker totals with Tempo's existing worklogs.
- Test a user with no Calendar MCP and a user with a different working window.
- Test a project with a different active Jira status.
- Collect only configuration and usability feedback, not credential material.

## Acceptance Scenarios

### Happy path

Given a session note with a Jira ticket, a resolvable project, a computed
duration, and a configured account key, processing must show one dry-run prompt;
note.

Surface: OpenCode session-processing flow plus Tempo worklog query.

### Manual duration

Given `time-spent` is already populated, processing must not recompute it or
call Calendar. The proposed Tempo entry must use the existing value.

Surface: skill trace and final Obsidian frontmatter.

### Missing configuration

Given no local config or no account key, processing must not call Tempo. It must
leave the session processable and ask for the missing value only when logging is
requested.

Surface: OpenCode flow with Tempo tool-call absence.

### Duplicate protection

Given `tempo-logged: true`, processing must make no Tempo write. Given an
existing same-issue same-date worklog, processing must show it before any new
write.

Surface: Tempo worklog list plus Obsidian note state.

### Calendar edge case

Given an unanswered meeting, processing must ask whether it was attended. A
declined meeting must not be subtracted. With Calendar disabled, no Calendar
call may occur.

Surface: OpenCode tool trace and duration output.

### Standalone regression

Given no Obsidian vault, a user must still be able to list, create, update, and
delete Tempo worklogs through the MCP.

Surface: direct MCP-compatible client invocation.

### Weekly regression

Given work performed outside OpenCode, the weekly Jira + Calendar tracker must
still produce a report and a dry-run without requiring Obsidian session notes.

Surface: tracker report and no-write dry-run.

## Security And Governance

- Personal Tempo and Jira tokens stay local or in the organization's approved
  secret manager.
- MCP write tools remain disabled until the user enables them locally.
- Every write has an explicit confirmation gate.
- Worklog IDs are stored as references, not credentials.
- Financial classification remains human-approved; automation may gather facts
  and prepare a proposal but must not silently classify or write.
- Shared defaults must be safe and non-financial. Team-specific account keys
  belong in local config or project metadata.

## Recommended Decision

Implement Option C first, retain Option A as the standalone base, and ship
Option B as a separate weekly estimator. Do not build a second Tempo client for
the session workflow; fix and generalize the existing skill around the MCP.

The smallest viable rollout is: correct the skill, add local config, add the
worklog ID field, preserve explicit approval, and pilot with two users. Calendar
subtraction and CapEx Jira-field mutation should remain opt-in until the pilot
shows they are needed.

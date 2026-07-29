import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// — env —
const TEMPO_TOKEN = process.env.TEMPO_API_TOKEN;
const ACCOUNT_ID = process.env.TEMPO_ACCOUNT_ID;
const JIRA_BASE_URL   = process.env.JIRA_BASE_URL;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_API_TOKEN  = process.env.JIRA_API_TOKEN;

if (!TEMPO_TOKEN) { console.error('Missing TEMPO_API_TOKEN'); process.exit(1); }
if (!ACCOUNT_ID)  { console.error('Missing TEMPO_ACCOUNT_ID');  process.exit(1); }

// — helpers —
const BASE = 'https://api.tempo.io/4';

function api(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TEMPO_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

function parseTime(input: string): number {
  const hm = input.match(/^(\d+)h\s*(\d+)m$/i);
  if (hm) return +hm[1] * 3600 + +hm[2] * 60;
  const h = input.match(/^(\d+\.?\d*)h$/i);
  if (h)  return Math.round(+h[1] * 3600);
  const m = input.match(/^(\d+\.?\d*)m$/i);
  if (m)  return Math.round(+m[1] * 60);
  throw new Error(`Cannot parse "${input}". Use: "2h", "30m", "1h30m", "1.5h"`);
}

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return d.toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 8); // HH:MM:SS
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Tempo ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

/**
 * Resolves a Jira issue key (e.g. "COP-123") to its numeric issue ID.
 * Tempo API v4 requires issueId (integer), not issueKey.
 */
async function resolveIssueId(issueKey: string): Promise<number> {
  if (!JIRA_BASE_URL || !JIRA_USER_EMAIL || !JIRA_API_TOKEN) {
    throw new Error(
      'Missing Jira credentials (JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN). ' +
      'Add them to .env so issue keys can be resolved to numeric IDs for Tempo.',
    );
  }
  const auth = Buffer.from(`${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const res = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}?fields=id`,
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira ${res.status} resolving ${issueKey}: ${text}`);
  }
  const data = await res.json() as { id: string };
  return parseInt(data.id, 10);
}

// — server —
const server = new McpServer({ name: 'tempo-mcp', version: '1.0.0' });

server.registerTool(
  'log_time',
  {
    description:
      'Log time to a Jira issue in Tempo. ' +
      'Requires an explicit accountKey copied from the reviewed Jira CAPEX Code field.',
    inputSchema: z.object({
      issueKey:   z.string().describe('Jira issue key, e.g. ON-123'),
      timeSpent:  z.string().describe('Time spent: "2h", "30m", "1h30m", "1.5h"'),
      description: z.string().optional().describe('What you worked on'),
      date:        z.string().optional().describe('YYYY-MM-DD, defaults to today'),
      accountKey:  z.string().describe('Reviewed CapEx account key, e.g. CSW_WS02'),
    }),
  },
  async ({ issueKey, timeSpent, description, date, accountKey }) => {
    const seconds = parseTime(timeSpent);
    const issueId = await resolveIssueId(issueKey);
    const body = {
      issueId,
      timeSpentSeconds: seconds,
      startDate: date ?? today(),
      startTime: nowTime(),
      authorAccountId: ACCOUNT_ID,
      ...(description ? { description } : {}),
      attributes: [{ key: '_CAPEXCode_', value: accountKey }],
    };

    const data = await apiJson<{ tempoWorklogId: number }>(
      '/worklogs',
      { method: 'POST', body: JSON.stringify(body) },
    );

    return { content: [{ type: 'text' as const, text:
      `✅ Logged ${fmt(seconds)} on ${issueKey} for ${body.startDate} (account: ${body.attributes[0].value}). Worklog ID: ${data.tempoWorklogId}`,
    }]};
  },
);

server.registerTool(
  'get_my_worklogs',
  {
    description: "Get your Tempo worklogs. Defaults to the current week.",
    inputSchema: z.object({
      from: z.string().optional().describe('Start date YYYY-MM-DD, defaults to Monday of current week'),
      to:   z.string().optional().describe('End date YYYY-MM-DD, defaults to today'),
    }),
  },
  async ({ from, to }) => {
    const startDate = from ?? weekStart();
    const endDate   = to   ?? today();

    const data = await apiJson<{ readonly results?: readonly { readonly tempoWorklogId: number; readonly startDate: string; readonly timeSpentSeconds: number; readonly description?: string; readonly issue?: { readonly key?: string } }[] }>(
      `/worklogs/user/${ACCOUNT_ID}?from=${startDate}&to=${endDate}&limit=50`,
    );

    const worklogs = data.results ?? [];
    if (!worklogs.length) return { content: [{ type: 'text' as const, text: `No worklogs between ${startDate} and ${endDate}.` }] };

    const total = worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0);
    const lines = worklogs.map((w) =>
      `[${w.tempoWorklogId}] ${w.startDate}  ${w.issue?.key ?? '?'}  ${fmt(w.timeSpentSeconds)}${w.description ? `  — ${w.description}` : ''}`,
    );
    lines.push(`\nTotal: ${fmt(total)} across ${worklogs.length} entr${worklogs.length === 1 ? 'y' : 'ies'}`);

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

server.registerTool(
  'get_issue_worklogs',
  {
    description: 'Get all time logged on a specific Jira issue.',
    inputSchema: z.object({
      issueKey: z.string().describe('Jira issue key, e.g. ON-123'),
    }),
  },
  async ({ issueKey }) => {
    const data = await apiJson<{ readonly results?: readonly { readonly tempoWorklogId: number; readonly startDate: string; readonly timeSpentSeconds: number; readonly description?: string; readonly author?: { readonly accountId?: string; readonly displayName?: string } }[] }>(`/issues/${issueKey}/worklogs?limit=50`);
    const worklogs = data.results ?? [];
    if (!worklogs.length) return { content: [{ type: 'text' as const, text: `No worklogs for ${issueKey}.` }] };

    const total = worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0);
    const lines = worklogs.map((w) =>
      `[${w.tempoWorklogId}] ${w.startDate}  ${w.author?.displayName ?? w.author?.accountId ?? '?'}  ${fmt(w.timeSpentSeconds)}${w.description ? `  — ${w.description}` : ''}`,
    );
    lines.push(`\nTotal: ${fmt(total)}`);

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

server.registerTool(
  'update_worklog',
  {
    description: 'Update an existing Tempo worklog. Only pass the fields you want to change.',
    inputSchema: z.object({
      worklogId:   z.number().describe('Tempo worklog ID'),
      timeSpent:   z.string().optional().describe('New time, e.g. "2h"'),
      description: z.string().optional().describe('New description'),
      date:        z.string().optional().describe('New date YYYY-MM-DD'),
    }),
  },
  async ({ worklogId, timeSpent, description, date }) => {
    const current = await apiJson<{ readonly issue?: { readonly id?: number }; readonly timeSpentSeconds: number; readonly startDate: string; readonly startTime?: string; readonly author?: { readonly accountId?: string }; readonly description?: string; readonly attributes?: readonly { readonly key: string; readonly value: string }[] | { readonly values?: readonly { readonly key: string; readonly value: string }[] } }>(`/worklogs/${worklogId}`);
    const attributes = Array.isArray(current.attributes)
      ? current.attributes
      : current.attributes?.values ?? [];

    const body = {
      issueId:          current.issue?.id,
      timeSpentSeconds: timeSpent ? parseTime(timeSpent) : current.timeSpentSeconds,
      startDate:        date ?? current.startDate,
      startTime:        current.startTime ?? '09:00:00',
      authorAccountId:  current.author?.accountId ?? ACCOUNT_ID,
      description:      description ?? current.description ?? '',
      attributes,
    };

    await apiJson(`/worklogs/${worklogId}`, { method: 'PUT', body: JSON.stringify(body) });

    return { content: [{ type: 'text' as const, text: `✅ Updated worklog ${worklogId}.` }] };
  },
);

server.registerTool(
  'delete_worklog',
  {
    description: 'Delete a Tempo worklog by ID.',
    inputSchema: z.object({
      worklogId: z.number().describe('Tempo worklog ID'),
    }),
  },
  async ({ worklogId }) => {
    const res = await api(`/worklogs/${worklogId}`, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tempo ${res.status}: ${text}`);
    }
    return { content: [{ type: 'text' as const, text: `🗑️ Deleted worklog ${worklogId}.` }] };
  },
);

server.registerTool(
  'list_work_attributes',
  {
    description: 'List all Tempo work attributes and their keys (useful for finding the correct account/CapEx attribute key).',
    inputSchema: z.object({}),
  },
  async () => {
    const data = await apiJson<{ readonly results?: readonly { readonly key: string; readonly name: string; readonly type: string }[] }>('/work-attributes');
    const lines = (data.results ?? []).map((a) =>
      `key: ${a.key}  name: ${a.name}  type: ${a.type}`,
    );
    return { content: [{ type: 'text' as const, text: lines.join('\n') || 'No work attributes found.' }] };
  },
);

// — start —
const transport = new StdioServerTransport();
await server.connect(transport);

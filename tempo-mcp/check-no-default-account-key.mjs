import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

assert(!source.includes('TEMPO_ACCOUNT_KEY'), 'Tempo logging must not read TEMPO_ACCOUNT_KEY');
assert(!source.includes('CSW_WS02 for Amelie'), 'Tempo logging must not document a personal default');
assert(!source.includes('accountKey:  z.string().optional()'), 'accountKey must be required');
assert(!source.includes('accountKey ??'), 'Tempo logging must not fall back to a default accountKey');

console.log('ok: tempo_log_time requires an explicit accountKey');

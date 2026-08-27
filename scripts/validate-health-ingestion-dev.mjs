// Explicitly opt-in, isolated DEV only. Never uses the app's production credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SUPABASE_URL as liveURL } from '../js/supabase-config.js';

const required = ['ATLES_DEV_SUPABASE_URL', 'ATLES_DEV_SUPABASE_KEY',
  'ATLES_DEV_USER_A_EMAIL', 'ATLES_DEV_USER_A_PASSWORD',
  'ATLES_DEV_USER_B_EMAIL', 'ATLES_DEV_USER_B_PASSWORD'];
for (const name of required) assert.ok(process.env[name], `Falta ${name}`);
assert.equal(process.env.ATLES_ALLOW_DEV_WRITES, 'health-ingestion-tests',
  'Cal autoritzar les proves amb ATLES_ALLOW_DEV_WRITES=health-ingestion-tests');
const base = new URL(process.env.ATLES_DEV_SUPABASE_URL);
assert.notEqual(base.origin, new URL(liveURL).origin, 'Aquest script rebutja el backend de la PWA actual.');
assert.ok(base.protocol === 'https:' ||
  (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)));
const key = process.env.ATLES_DEV_SUPABASE_KEY;

async function request(path, token, { method = 'GET', body } = {}) {
  const response = await fetch(`${base.origin}/${path}`, {
    method,
    headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  return { ok: response.ok, status: response.status, data };
}

async function signIn(who) {
  const result = await request('auth/v1/token?grant_type=password', null, {
    method: 'POST', body: { email: process.env[`ATLES_DEV_USER_${who}_EMAIL`],
      password: process.env[`ATLES_DEV_USER_${who}_PASSWORD`] }
  });
  assert.ok(result.ok, `Autenticació ${who} fallida: HTTP ${result.status}`);
  return { token: result.data.access_token, id: result.data.user.id };
}

const A = await signIn('A'), B = await signIn('B');
assert.notEqual(A.id, B.id);
const tracked = new Map();
function sample(kind, value, unit, stage = null, category = null) {
  const id = randomUUID();
  tracked.set(id, kind);
  return { external_id: id, started_at: '2099-10-24T22:30:00.125Z',
    ended_at: '2099-10-25T06:30:00.125Z', value, unit,
    sleep_stage: stage, category_value: category,
    source_bundle_id: 'atles.validation.synthetic', source_version: '1',
    source_device: 'TEST ONLY', timezone: 'Europe/Madrid', import_timezone: 'Europe/Madrid' };
}
const rpc = (kind, records = [], ids = [], session = A) => request(
  'rest/v1/rpc/ingest_health_sample_page', session.token,
  { method: 'POST', body: { p_metric_type: kind, p_samples: records, p_deleted_ids: ids } }
);
async function rows(id, session = A, table = 'health_samples') {
  const result = await request(`rest/v1/${table}?select=*&external_id=eq.${id}`, session.token);
  assert.ok(result.ok, `Lectura fallida: HTTP ${result.status}`);
  return result.data;
}
try {
  const records = [
    ['resting_heart_rate_bpm', 55, 'bpm'], ['hrv_sdnn_ms', 42.25, 'ms'],
    ['vo2_max_ml_kg_min', 45.5, 'ml/kg/min'], ['body_mass_kg', 80.2, 'kg'],
    ['body_fat_percent', 25, '%'], ['lean_body_mass_kg', 60, 'kg']
  ].map(([kind, value, unit]) => [kind, sample(kind, value, unit)]);
  for (const [kind, record] of records) assert.ok((await rpc(kind, [record])).ok);
  const [kind, record] = records[0];
  const original = (await rows(record.external_id))[0];
  assert.ok((await rpc(kind, [{ ...record, value: 56 }])).ok);
  const repeated = await rows(record.external_id);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].id, original.id);
  assert.equal(repeated[0].created_at, original.created_at);
  assert.equal(Number(repeated[0].value), 56);
  console.log('PASS — sis mètriques, unitats, upsert i identitat estable');

  assert.deepEqual(await rows(record.external_id, B), []);
  const forged = await request('rest/v1/health_samples', B.token, { method: 'POST',
    body: { ...record, external_id: randomUUID(), user_id: A.id, metric_type: kind } });
  assert.equal(forged.ok, false);
  const crossUpdate = await request(`rest/v1/health_samples?id=eq.${original.id}`, B.token,
    { method: 'PATCH', body: { value: 999 } });
  assert.ok(crossUpdate.ok);
  assert.deepEqual(crossUpdate.data, []);
  assert.equal(Number((await rows(record.external_id))[0].value), 56);
  const anonymous = await request('rest/v1/rpc/ingest_health_sample_page', null,
    { method: 'POST', body: { p_metric_type: kind, p_samples: [], p_deleted_ids: [] } });
  assert.equal(anonymous.ok, false);
  console.log('PASS — RLS: lectura, atribució, actualització creuades i accés anònim bloquejats');

  const good = sample(kind, 54, 'bpm'), bad = sample(kind, 54, 'kg');
  assert.equal((await rpc(kind, [good, bad], [record.external_id])).ok, false);
  assert.deepEqual(await rows(good.external_id), []);
  assert.equal((await rows(record.external_id))[0].deleted_at, null);
  assert.deepEqual(await rows(record.external_id, A, 'health_sample_tombstones'), []);
  console.log('PASS — bloc invàlid: rollback de mostres i baixes');

  assert.ok((await rpc(kind, [], [record.external_id])).ok);
  assert.ok((await rows(record.external_id))[0].deleted_at);
  assert.deepEqual(await rows(record.external_id, B, 'health_sample_tombstones'), []);
  assert.ok((await rpc(kind, [record])).ok);
  assert.ok((await rows(record.external_id))[0].deleted_at);
  const neverSeen = sample(kind, 57, 'bpm');
  assert.ok((await rpc(kind, [], [neverSeen.external_id])).ok);
  assert.ok((await rpc(kind, [neverSeen])).ok);
  assert.deepEqual(await rows(neverSeen.external_id), []);
  console.log('PASS — baixes conegudes/desconegudes i retries sense resurrecció');

  const inBed = sample('sleep_stage', null, null, 'in_bed', 0);
  const core = sample('sleep_stage', null, null, 'core', 3);
  const unknown = sample('sleep_stage', null, null, 'unknown', 99);
  assert.ok((await rpc('sleep_stage', [inBed, core, unknown])).ok);
  for (const r of [inBed, core, unknown]) {
    const stored = (await rows(r.external_id))[0];
    assert.equal(stored.sleep_stage, r.sleep_stage);
    assert.equal(Date.parse(stored.started_at), Date.parse(r.started_at));
    assert.equal(Date.parse(stored.ended_at), Date.parse(r.ended_at));
    assert.equal(stored.timezone, 'Europe/Madrid');
  }
  assert.equal((await rpc('sleep_stage', [{ ...core, sleep_stage: 'rem' }])).ok, false);
  assert.equal((await rpc('not_a_health_type')).ok, false);
  assert.equal((await rpc('body_fat_percent', [sample('body_fat_percent', 101, '%')])).ok, false);
  console.log('PASS — son solapat, fases futures, timestamps i validació de tipus');
} finally {
  let cleanupFailed = false;
  for (const kind of new Set(tracked.values())) {
    const ids = [...tracked].filter(([, k]) => k === kind).map(([id]) => id);
    if (!(await rpc(kind, [], ids)).ok) cleanupFailed = true;
  }
  console.log('Les mostres sintètiques es conserven amb soft delete i tombstones per auditar la prova.');
  assert.equal(cleanupFailed, false, 'Neteja incompleta: revisa les mostres atles.validation.synthetic en DEV.');
}

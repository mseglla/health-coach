import assert from 'node:assert/strict';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from '../js/supabase-config.js';

const requiredVariables = [
  'ATLES_TEST_USER_A_EMAIL',
  'ATLES_TEST_USER_A_PASSWORD',
  'ATLES_TEST_USER_B_EMAIL',
  'ATLES_TEST_USER_B_PASSWORD'
];

for (const name of requiredVariables) {
  if (!process.env[name]) {
    throw new Error(`Falta la variable d’entorn ${name}`);
  }
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function signIn(email, password) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    }
  );

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `No s’ha pogut autenticar ${email}: ${JSON.stringify(data)}`
    );
  }

  return {
    accessToken: data.access_token,
    userId: data.user.id
  };
}

async function restRequest(session, path, {
  method = 'GET',
  body,
  prefer
} = {}) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.accessToken}`,
    Accept: 'application/json'
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  return {
    response,
    data: await readJson(response)
  };
}

const userA = await signIn(
  process.env.ATLES_TEST_USER_A_EMAIL,
  process.env.ATLES_TEST_USER_A_PASSWORD
);
const userB = await signIn(
  process.env.ATLES_TEST_USER_B_EMAIL,
  process.env.ATLES_TEST_USER_B_PASSWORD
);

assert.notEqual(userA.userId, userB.userId);
console.log('PASS — dos usuaris diferents autenticats');

const metricDate = '2099-12-31';
const identityQuery = [
  `user_id=eq.${encodeURIComponent(userA.userId)}`,
  `metric_date=eq.${metricDate}`,
  'metric_type=eq.steps',
  'source=eq.healthkit'
].join('&');

async function upsertMetric(value) {
  const result = await restRequest(
    userA,
    'health_daily_metrics?on_conflict=user_id,metric_date,metric_type,source',
    {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        user_id: userA.userId,
        metric_date: metricDate,
        metric_type: 'steps',
        value,
        unit: 'count',
        source: 'healthkit',
        timezone: 'Europe/Madrid',
        metadata: { validation_test: true },
        imported_at: new Date().toISOString(),
        deleted_at: null
      }
    }
  );

  assert.equal(
    result.response.ok,
    true,
    `Upsert fallit: ${JSON.stringify(result.data)}`
  );
}

try {
  await upsertMetric(1111);
  await upsertMetric(2222);

  const ownRead = await restRequest(
    userA,
    `health_daily_metrics?select=id,value,deleted_at&${identityQuery}`
  );

  assert.equal(ownRead.response.ok, true);
  assert.equal(ownRead.data.length, 1);
  assert.equal(Number(ownRead.data[0].value), 2222);
  assert.equal(ownRead.data[0].deleted_at, null);
  console.log('PASS — l’upsert actualitza una única mètrica sense duplicar-la');

  const otherUserRead = await restRequest(
    userB,
    `health_daily_metrics?select=id,value&${identityQuery}`
  );

  assert.equal(otherUserRead.response.ok, true);
  assert.deepEqual(otherUserRead.data, []);
  console.log('PASS — RLS impedeix que l’usuari B llegeixi dades de l’usuari A');

  const spoofedInsert = await restRequest(userB, 'health_daily_metrics', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      user_id: userA.userId,
      metric_date: '2099-12-30',
      metric_type: 'steps',
      value: 3333,
      unit: 'count',
      source: 'healthkit'
    }
  });

  assert.equal(spoofedInsert.response.ok, false);
  assert.ok([401, 403].includes(spoofedInsert.response.status));
  console.log('PASS — RLS impedeix que l’usuari B suplanti l’usuari A');
} finally {
  const cleanup = await restRequest(
    userA,
    `health_daily_metrics?${identityQuery}`,
    {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { deleted_at: new Date().toISOString() }
    }
  );

  if (!cleanup.response.ok) {
    console.warn(
      `AVÍS — no s’ha pogut fer el soft delete de prova: ${JSON.stringify(cleanup.data)}`
    );
  }
}

console.log('PASS — validació remota de HealthKit completada');

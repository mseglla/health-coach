import assert from 'node:assert/strict';
import { StorageService } from '../js/storage.js';

class MemoryAdapter {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }

  async getItem(key) {
    return this.data.get(key) ?? null;
  }

  async setItem(key, value) {
    this.data.set(key, value);
  }
}

const adapter = new MemoryAdapter();
const service = new StorageService(adapter);
const defaultState = await service.loadState();

assert.equal(defaultState.version, 3);
assert.deepEqual(defaultState.days, []);
assert.deepEqual(defaultState.weights, []);
assert.deepEqual(defaultState.meals, []);

console.log('PASS — estat per defecte');

const persistedState = {
  ...defaultState,
  weights: [{
    id: 'weight-test',
    value: 80,
    measuredAt: '2026-07-25T08:00',
    createdAt: '2026-07-25T08:00:00.000Z'
  }]
};

await service.persistState(persistedState);

assert.deepEqual(
  JSON.parse(await adapter.getItem('healthCoachV3')),
  persistedState
);

console.log('PASS — persistència mitjançant StorageService');

const legacyAdapter = new MemoryAdapter({
  healthCoachV2: JSON.stringify({
    settings: { name: 'Legacy user' },
    days: [{
      date: '2026-07-24',
      weight: 81,
      steps: 10000
    }],
    meals: []
  })
});

const legacyService = new StorageService(legacyAdapter);
const migratedState = await legacyService.loadState();

assert.equal(migratedState.version, 3);
assert.equal(migratedState.settings.name, 'Legacy user');
assert.equal(migratedState.weights.length, 1);
assert.equal(migratedState.weights[0].value, 81);
assert.equal(migratedState.days[0].weight, undefined);
assert.ok(await legacyAdapter.getItem('healthCoachV3'));

console.log('PASS — migració de dades antigues');

const backup = JSON.stringify({
  ...defaultState,
  settings: {
    ...defaultState.settings,
    name: 'Restored user'
  },
  weights: [{
    id: 'restored-weight',
    value: 78.5,
    measuredAt: '2026-07-25T09:00',
    createdAt: '2026-07-25T09:00:00.000Z'
  }]
});

const restoredState = await service.importState(backup);

assert.equal(restoredState.settings.name, 'Restored user');
assert.equal(restoredState.weights[0].value, 78.5);
assert.deepEqual(
  JSON.parse(await adapter.getItem('healthCoachV3')),
  restoredState
);

console.log('PASS — restaura una còpia vàlida');

const stateBeforeInvalidImport = await adapter.getItem('healthCoachV3');

await assert.rejects(
  () => service.importState('{invalid json'),
  /JSON vàlid/
);

await assert.rejects(
  () => service.importState(JSON.stringify({
    ...defaultState,
    version: 99
  })),
  /compatible/
);

await assert.rejects(
  () => service.importState(JSON.stringify({
    ...defaultState,
    weights: [{
      id: 'invalid-weight',
      value: 'not-a-number',
      measuredAt: '2026-07-25T10:00'
    }]
  })),
  /pes invàlids/
);

assert.equal(
  await adapter.getItem('healthCoachV3'),
  stateBeforeInvalidImport
);

console.log('PASS — rebutja còpies invàlides sense alterar les dades');

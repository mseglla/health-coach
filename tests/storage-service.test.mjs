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

const emptyAdapter = new MemoryAdapter();
const emptyService = new StorageService(emptyAdapter);
const defaultState = await emptyService.loadState();

assert.equal(defaultState.version, 3);
assert.deepEqual(defaultState.days, []);
assert.deepEqual(defaultState.weights, []);
assert.deepEqual(defaultState.meals, []);

const persistedState = {
  ...defaultState,
  weights: [{
    id: 'weight-test',
    value: 80,
    measuredAt: '2026-07-25T08:00',
    createdAt: '2026-07-25T08:00:00.000Z'
  }]
};

await emptyService.persistState(persistedState);

assert.deepEqual(
  JSON.parse(await emptyAdapter.getItem('healthCoachV3')),
  persistedState
);

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

console.log('PASS — estat per defecte');
console.log('PASS — persistència mitjançant StorageService');
console.log('PASS — migració de dades antigues');

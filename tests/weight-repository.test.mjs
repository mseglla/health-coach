import assert from 'node:assert/strict';
import {
  WeightRepository,
  isUuid
} from '../js/weight-repository.js';

const migratedUuid =
  '11111111-1111-4111-8111-111111111111';
const newUuid =
  '22222222-2222-4222-8222-222222222222';
const existingUuid =
  '33333333-3333-4333-8333-333333333333';

const generatedIds = [migratedUuid, newUuid];
const persistedStates = [];
let currentTime = '2026-07-27T20:00:00.000Z';

const storageService = {
  async persistState(state) {
    persistedStates.push(structuredClone(state));
  }
};

const repository = new WeightRepository({
  storageService,
  idFactory: () => generatedIds.shift(),
  now: () => currentTime
});

const state = {
  version: 3,
  settings: {},
  days: [],
  weights: [
    {
      id: 'weight-old-format',
      value: '80.5',
      measuredAt: '2026-07-25T08:00',
      createdAt: '2026-07-25T08:00:00.000Z'
    },
    {
      id: existingUuid,
      value: 80,
      measuredAt: '2026-07-26T08:00',
      source: 'manual',
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T08:00:00.000Z',
      deletedAt: null
    }
  ]
};

await repository.initialize(state);

assert.equal(state.weights[0].id, migratedUuid);
assert.ok(isUuid(state.weights[0].id));
assert.equal(state.weights[0].value, 80.5);
assert.equal(state.weights[0].source, 'manual');
assert.equal(
  state.weights[0].updatedAt,
  '2026-07-25T08:00:00.000Z'
);
assert.equal(persistedStates.length, 1);

console.log('PASS — migra identificadors antics a UUID');
console.log('PASS — conserva valors i metadades existents');
console.log('PASS — persisteix la migració una sola vegada');

currentTime = '2026-07-27T20:05:00.000Z';

const created = await repository.save(state, {
  value: 79.8,
  measuredAt: '2026-07-27T08:00'
});

assert.equal(created.id, newUuid);
assert.equal(created.createdAt, currentTime);
assert.equal(created.updatedAt, currentTime);
assert.equal(created.deletedAt, null);
assert.equal(created.source, 'manual');

console.log('PASS — crea pesos nous amb UUID pur');

const originalCreatedAt = created.createdAt;
currentTime = '2026-07-27T20:10:00.000Z';

const updated = await repository.save(state, {
  id: created.id,
  value: 79.7,
  measuredAt: '2026-07-27T08:30'
});

assert.equal(updated.id, newUuid);
assert.equal(updated.value, 79.7);
assert.equal(updated.createdAt, originalCreatedAt);
assert.equal(updated.updatedAt, currentTime);

console.log('PASS — actualitza sense canviar identitat ni creació');

currentTime = '2026-07-27T20:15:00.000Z';
const deleted = await repository.softDelete(state, created.id);

assert.equal(deleted.deletedAt, currentTime);
assert.equal(repository.findById(state, created.id), null);
assert.equal(
  repository.findById(
    state,
    created.id,
    { includeDeleted: true }
  ).id,
  created.id
);

console.log('PASS — aplica soft delete');
console.log('PASS — oculta tombstones però els conserva per sincronitzar');

await assert.rejects(
  repository.save(state, {
    value: 0,
    measuredAt: '2026-07-27T09:00'
  }),
  /positive/
);

await assert.rejects(
  repository.save(state, {
    value: 80,
    measuredAt: ''
  }),
  /measuredAt/
);

console.log('PASS — rebutja registres invàlids');

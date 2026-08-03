import assert from 'node:assert/strict';
import {
  averageWeight,
  dailyWeightSeries,
  latestWeight,
  weightForDate
} from '../js/calculations.js';
import { StorageService } from '../js/storage.js';

class MemoryAdapter {
  constructor(value) {
    this.value = value;
  }

  async getItem() {
    return this.value;
  }

  async setItem(key, value) {
    this.value = value;
  }
}

const activeId =
  '11111111-1111-4111-8111-111111111111';
const deletedId =
  '22222222-2222-4222-8222-222222222222';

const rawState = {
  version: 3,
  settings: {},
  days: [],
  weights: [
    {
      id: activeId,
      value: 80,
      measuredAt: '2026-07-26T08:00',
      source: 'manual',
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T08:00:00.000Z',
      deletedAt: null
    },
    {
      id: deletedId,
      value: 60,
      measuredAt: '2026-07-27T08:00',
      source: 'manual',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T09:00:00.000Z',
      deletedAt: '2026-07-27T09:00:00.000Z'
    }
  ]
};

const adapter = new MemoryAdapter(JSON.stringify(rawState));
const service = new StorageService(adapter);
const loaded = await service.loadState();

assert.equal(loaded.weights[1].deletedAt, rawState.weights[1].deletedAt);
assert.equal(loaded.weights[1].updatedAt, rawState.weights[1].updatedAt);
assert.equal(loaded.weights[1].source, 'manual');

console.log('PASS — conserva metadades i tombstones en carregar');

assert.equal(latestWeight(loaded.weights), 80);
assert.equal(
  weightForDate(loaded.weights, '2026-07-27'),
  null
);
assert.equal(dailyWeightSeries(loaded.weights).length, 1);
assert.equal(averageWeight(loaded.weights, 7), 80);

console.log('PASS — exclou tombstones del pes actual');
console.log('PASS — exclou tombstones dels càlculs diaris');
console.log('PASS — exclou tombstones de mitjanes i sèries');

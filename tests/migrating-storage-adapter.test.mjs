import assert from 'node:assert/strict';
import { MigratingStorageAdapter } from '../js/migrating-storage-adapter.js';

class MemoryAdapter {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
    this.failReads = false;
    this.failWrites = false;
  }

  async getItem(key) {
    if (this.failReads) throw new Error('read failure');
    return this.data.get(key) ?? null;
  }

  async setItem(key, value) {
    if (this.failWrites) throw new Error('write failure');
    this.data.set(key, value);
  }
}

const errors = [];
const onError = (...args) => errors.push(args);

const primary = new MemoryAdapter();
const fallback = new MemoryAdapter({
  healthCoachV3: '{"version":3}'
});

const adapter = new MigratingStorageAdapter({
  primary,
  fallback,
  onError
});

assert.equal(
  await adapter.getItem('healthCoachV3'),
  '{"version":3}'
);

assert.equal(
  await primary.getItem('healthCoachV3'),
  '{"version":3}'
);

console.log('PASS — migra localStorage cap a IndexedDB');

await adapter.setItem('healthCoachV3', '{"version":4}');

assert.equal(
  await primary.getItem('healthCoachV3'),
  '{"version":4}'
);

assert.equal(
  await fallback.getItem('healthCoachV3'),
  '{"version":4}'
);

console.log('PASS — escriptura dual');

primary.failReads = true;

assert.equal(
  await adapter.getItem('healthCoachV3'),
  '{"version":4}'
);

assert.equal(adapter.getStatus().primaryAvailable, false);
assert.equal(errors.length, 1);

console.log('PASS — fallback quan falla IndexedDB');

primary.failReads = false;
primary.failWrites = true;

await adapter.setItem('healthCoachV3', '{"version":5}');

assert.equal(
  await fallback.getItem('healthCoachV3'),
  '{"version":5}'
);

assert.equal(adapter.getStatus().primaryAvailable, false);

console.log('PASS — conserva dades si falla l’escriptura principal');

fallback.failWrites = true;

await assert.rejects(
  () => adapter.setItem('healthCoachV3', '{"version":6}'),
  AggregateError
);

console.log('PASS — informa si fallen els dos sistemes');

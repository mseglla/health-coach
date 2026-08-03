import assert from 'node:assert/strict';
import { SupabaseDailySummaryRepository } from '../js/supabase-daily-summary-repository.js';

const rows = [{
  summary_date: '2026-07-22',
  steps: 13615,
  intake_kcal: 2200,
  active_kcal: 987,
  total_kcal: 2953
}];
let upserted = null;

class Query {
  constructor(mode) {
    this.mode = mode;
  }

  select() { return this; }
  eq() { return this; }
  is() { return this; }
  order() { return Promise.resolve({ data: rows, error: null }); }

  upsert(values) {
    upserted = values;
    this.mode = 'save';
    return this;
  }

  single() {
    return Promise.resolve({
      data: {
        summary_date: upserted.summary_date,
        steps: upserted.steps,
        intake_kcal: upserted.intake_kcal,
        active_kcal: upserted.active_kcal,
        total_kcal: upserted.total_kcal
      },
      error: null
    });
  }
}

const client = {
  from(table) {
    assert.equal(table, 'daily_summaries');
    return new Query('read');
  }
};

const repository = new SupabaseDailySummaryRepository({
  clientFactory: async () => client
});
const state = { days: [] };

await repository.initialize(state, {
  userId: '8603d5cb-45ba-4ff9-bc4b-979071458c2d'
});

assert.deepEqual(state.days, [{
  date: '2026-07-22',
  steps: 13615,
  intake: 2200,
  active: 987,
  total: 2953
}]);

console.log('PASS — carrega i transforma els resums de Supabase');

const saved = await repository.save(state, {
  date: '2026-07-23',
  steps: 8031,
  intake: 2250,
  active: 604,
  total: 2513
});

assert.equal(upserted.user_id, '8603d5cb-45ba-4ff9-bc4b-979071458c2d');
assert.equal(upserted.summary_date, '2026-07-23');
assert.equal(upserted.intake_kcal, 2250);
assert.deepEqual(saved, state.days[1]);

console.log('PASS — desa un resum amb upsert per usuari i dia');

await assert.rejects(
  () => repository.save(state, { date: '' }),
  /data/
);

console.log('PASS — rebutja resums sense data');

const failingRepository = new SupabaseDailySummaryRepository({
  clientFactory: async () => ({
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        order() {
          return Promise.resolve({
            data: null,
            error: { message: 'xarxa caiguda' }
          });
        }
      };
    }
  })
});

await assert.rejects(
  () => failingRepository.initialize({ days: [] }, { userId: 'user-test' }),
  /xarxa caiguda/
);

console.log('PASS — no oculta els errors remots');

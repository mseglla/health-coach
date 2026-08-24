import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localDateISO } from '../js/calculations.js';
import { chartTickIndexes } from '../js/charts.js';
import { createHistorySummary } from '../js/history-summary.js';

function dateWithOffset({
  days = 0,
  months = 0,
  years = 0
}) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  date.setMonth(date.getMonth() - months);
  date.setFullYear(date.getFullYear() - years);
  return localDateISO(date);
}

const dates = [
  dateWithOffset({}),
  dateWithOffset({ days: 1 }),
  dateWithOffset({ days: 8 }),
  dateWithOffset({ months: 1 }),
  dateWithOffset({ months: 4 }),
  dateWithOffset({ months: 8 }),
  dateWithOffset({ years: 2 }),
  dateWithOffset({ years: 6 })
];

const healthMetrics = [];

dates.forEach((date, index) => {
  healthMetrics.push(
    {
      date,
      type: 'steps',
      value: 10000 + index * 1000,
      importedAt: '2026-08-24T09:00:00Z'
    },
    {
      date,
      type: 'heart_rate_avg_bpm',
      value: 60 + index,
      importedAt: '2026-08-24T09:00:00Z'
    },
    {
      date,
      type: 'heart_rate_min_bpm',
      value: 45 + index,
      importedAt: '2026-08-24T09:00:00Z'
    },
    {
      date,
      type: 'heart_rate_max_bpm',
      value: 150 + index,
      importedAt: '2026-08-24T09:00:00Z'
    }
  );
});

healthMetrics.push({
  date: dates[0],
  type: 'heart_rate_avg_bpm',
  value: 40,
  importedAt: '2026-08-24T08:00:00Z'
});

const state = {
  weights: dates.map(
    (date, index) => ({
      id: `weight-${index}`,
      value: 90 - index,
      measuredAt:
        `${date}T08:00:00`,
      createdAt:
        `${date}T08:00:00Z`
    })
  ),
  goals: [],
  activities: dates.map(
    (date, index) => ({
      id: `activity-${index}`,
      startedAt:
        `${date}T08:00:00Z`,
      durationMinutes:
        30 + index,
      deletedAt: null
    })
  ),
  days: [],
  healthMetrics
};

const expectedCoverage = {
  '7d': 2,
  '14d': 3,
  '30d': 3,
  '3m': 4,
  '6m': 5,
  '1y': 6,
  all: 8
};

for (
  const [period, coverage]
  of Object.entries(expectedCoverage)
) {
  const history = createHistorySummary(
    state,
    {
      historyPeriod: period
    }
  );

  assert.equal(
    history.steps.coverage,
    coverage,
    `Cobertura incorrecta per ${period}`
  );

  assert.equal(
    history.heartRate.coverage,
    coverage,
    `Cobertura cardíaca incorrecta per ${period}`
  );

  assert.equal(
    history.weight.records.length,
    coverage,
    `Cobertura de pes incorrecta per ${period}`
  );

  assert.equal(
    history.training.totalSessions,
    coverage,
    `Cobertura d'entrenament incorrecta per ${period}`
  );
}

const history14 = createHistorySummary(
  state,
  {
    historyPeriod: '14d'
  }
);

assert.equal(
  history14.heartRate.values.length,
  14
);

assert.equal(
  history14.heartRate.average,
  61
);

assert.equal(
  history14.heartRate.observedMin,
  45
);

assert.equal(
  history14.heartRate.observedMax,
  152
);

const historyAll = createHistorySummary(
  state,
  {
    historyPeriod: 'all'
  }
);

assert.equal(
  historyAll.heartRate.coverage,
  8
);

assert.ok(
  historyAll.heartRate.values.length > 12
);

assert.deepEqual(
  chartTickIndexes(14, 400),
  [0, 7, 13]
);

assert.deepEqual(
  chartTickIndexes(14, 700),
  [0, 3, 7, 10, 13]
);

const index = readFileSync('index.html', 'utf8');
const ui = readFileSync('js/ui.js', 'utf8');
const serviceWorker = readFileSync('sw.js', 'utf8');

for (const period of [
  '7d',
  '14d',
  '30d',
  '3m',
  '6m',
  '1y',
  'all'
]) {
  assert.match(
    index,
    new RegExp(
      `data-history-period="${period}"`
    )
  );
}

assert.match(index, /id="heartRateChart"/);
assert.match(index, /id="historyHeartRatePeriod"/);
assert.match(index, /id="historyWeightPeriod"/);
assert.match(index, /id="historyTrainingPeriod"/);
assert.match(index, /id="trainingPeriodChip"/);
assert.match(ui, /activeHistoryPeriod/);
assert.match(ui, /mínim/);
assert.match(ui, /màxim/);
assert.match(
  serviceWorker,
  /\.\/js\/history-periods\.js/
);
assert.match(serviceWorker, /health-coach-v29/);

console.log(
  'PASS — períodes de passos i freqüència cardíaca'
);

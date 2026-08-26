import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localDateISO } from '../js/calculations.js';
import { chartTickIndexes } from '../js/charts.js';
import { createHistorySummary } from '../js/history-summary.js';
import { createPersonalRecords } from '../js/personal-records.js';
import { rollingAverage } from '../js/history-periods.js';

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
    },
    {
      date,
      type: 'active_kcal',
      value: 500 + index * 100,
      importedAt: '2026-08-24T09:00:00Z'
    },
    {
      date,
      type: 'resting_kcal',
      value: 1800 + index * 10,
      importedAt: '2026-08-24T09:00:00Z'
    },
    {
      date,
      type: 'total_kcal',
      value: 2300 + index * 110,
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

  for (const energyType of [
    'active',
    'resting',
    'total'
  ]) {
    assert.equal(
      history.energy[energyType].coverage,
      coverage,
      `Cobertura energètica incorrecta per ${energyType} · ${period}`
    );
  }

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

assert.equal(
  history14.energy.active.average,
  600
);

assert.equal(
  history14.energy.resting.average,
  1810
);

assert.equal(
  history14.energy.total.average,
  2410
);

for (const energyType of [
  'active',
  'resting',
  'total'
]) {
  assert.equal(
    history14.energy[energyType].values.length,
    14
  );

  assert.equal(
    history14.energy[energyType].trendValues.length,
    history14.energy[energyType].values.length
  );
}

assert.equal(
  history14.steps.trendValues.length,
  history14.steps.values.length
);

assert.equal(
  history14.heartRate.trendValues.length,
  history14.heartRate.values.length
);

assert.equal(
  history14.training.trendValues.length,
  history14.training.minutesByWeek.length
);

assert.deepEqual(
  rollingAverage(
    [1, 2, 3, 4],
    3
  ),
  [null, null, 2, 3]
);

const records =
  createPersonalRecords(state);

assert.equal(records.weight.min.value, 83);
assert.equal(records.weight.max.value, 90);
assert.equal(records.steps.min.value, 10000);
assert.equal(records.steps.max.value, 17000);
assert.equal(
  records.energy.active.max.value,
  1200
);
assert.equal(
  records.energy.active.today.value,
  500
);
assert.equal(records.heartRate.min.value, 45);
assert.equal(records.heartRate.max.value, 157);
assert.equal(records.training.min.value, 30);
assert.equal(records.training.max.value, 37);

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
assert.doesNotMatch(
  ui,
  /sessió més curta/
);
assert.doesNotMatch(
  ui,
  /stepRecords\.min/
);
assert.match(
  index,
  /id="historyWeightTrend"/
);
assert.match(
  index,
  /id="historyStepsTrend"/
);
assert.match(
  index,
  /id="historyEnergyTrend"/
);
assert.match(
  index,
  /id="historyEnergyActiveAverage"/
);
assert.match(
  index,
  /id="historyEnergyDetail"/
);
assert.match(
  index,
  /id="historyHeartRateTrend"/
);
assert.match(
  index,
  /id="historyTrainingTrend"/
);
assert.match(
  ui,
  /trend-indicator--positive/
);
assert.match(
  ui,
  /trend-indicator--negative/
);
assert.match(index, /id="energyChart"/);
assert.match(index, /id="energyPeriodChip"/);
assert.match(ui, /history\.energy\.active/);
assert.match(ui, /history\.energy\.resting/);
assert.match(ui, /history\.energy\.total/);
assert.match(index, /id="recordStepsMax"/);
assert.match(index, /id="recordEnergyMax"/);
assert.match(
  index,
  /id="recordEnergyMaxDate"/
);
assert.match(
  index,
  /id="recordEnergyToday"/
);
assert.match(
  index,
  /id="recordEnergyProgress"/
);
assert.match(
  index,
  /id="recordEnergyProgressLabel"/
);
assert.match(
  index,
  /record-compact--energy/
);
assert.match(
  ui,
  /history\.records\.energy\.active/
);
assert.match(
  ui,
  /activeEnergyRecords\.today/
);
assert.match(
  index,
  /id="recordHeartRateMin"/
);
assert.match(
  index,
  /id="recordHeartRateMax"/
);
assert.match(index, /id="recordTrainingMax"/);
assert.match(
  index,
  />SESSIÓ</
);
assert.doesNotMatch(
  index,
  /recordTrainingProgress/
);
assert.doesNotMatch(
  ui,
  /recordTrainingDetail/
);
assert.match(
  ui,
  /stepRecords\.today/
);
assert.doesNotMatch(
  ui,
  /stepRecords\.selectedMax/
);
assert.match(
  index,
  /id="recordStepsToday"/
);
assert.match(
  index,
  /id="recordStepsProgressLabel"/
);
assert.doesNotMatch(
  ui,
  /% DEL RÈCORD/
);
assert.match(
  index,
  /progress-kpi-strip/
);
assert.ok(
  index.indexOf(
    'history-period-selector'
  ) <
  index.indexOf(
    'progress-kpi-strip'
  )
);
assert.doesNotMatch(
  index,
  /<p class="eyebrow">PROGRÉS<\/p>/
);
assert.match(
  ui,
  /Final del període comparat amb l’inici/
);
assert.match(
  index,
  /records-strip/
);
assert.doesNotMatch(
  index,
  /personal-record-card/
);
assert.doesNotMatch(
  index,
  /recordStepsDetail/
);
assert.doesNotMatch(
  index,
  /recordWeightMaxDetail/
);
assert.doesNotMatch(
  index,
  /recordHeartRateDetail/
);
assert.match(
  serviceWorker,
  /\.\/js\/personal-records\.js/
);
assert.match(
  serviceWorker,
  /\.\/js\/history-periods\.js/
);
assert.match(serviceWorker, /health-coach-v42/);

console.log(
  'PASS — períodes de passos i freqüència cardíaca'
);

import assert from 'node:assert/strict';

import {
  createPerformanceAnalysis
} from '../js/performance-analyst.js';

import {
  localDateISO
} from '../js/calculations.js';

const referenceDate =
  new Date(2026, 7, 26, 12, 0, 0);

function dateOffset(days) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

const healthMetrics = [];

for (let offset = -28; offset <= -1; offset += 1) {
  const currentPeriod = offset >= -14;

  healthMetrics.push(
    {
      date: dateOffset(offset),
      type: 'steps',
      value:
        currentPeriod ? 12000 : 10000,
      importedAt:
        '2026-08-26T08:00:00Z'
    },
    {
      date: dateOffset(offset),
      type: 'active_kcal',
      value:
        currentPeriod ? 400 : 500,
      importedAt:
        '2026-08-26T08:00:00Z'
    }
  );
}

healthMetrics.push(
  {
    date: dateOffset(-1),
    type: 'steps',
    value: 3000,
    importedAt:
      '2026-08-26T07:00:00Z'
  },
  {
    date: dateOffset(0),
    type: 'steps',
    value: 99999,
    importedAt:
      '2026-08-26T09:00:00Z'
  },
  {
    date: dateOffset(-2),
    type: 'active_kcal',
    value: 9999,
    importedAt:
      '2026-08-26T10:00:00Z',
    deletedAt:
      '2026-08-26T10:01:00Z'
  }
);

const activities = [];

for (const offset of [-27, -23, -19, -15]) {
  activities.push({
    startedAt:
      `${dateOffset(offset)}T08:00:00Z`,
    durationMinutes: 30,
    deletedAt: null
  });
}

for (const offset of [-13, -11, -9, -7, -5, -3]) {
  activities.push({
    startedAt:
      `${dateOffset(offset)}T08:00:00Z`,
    durationMinutes: 40,
    deletedAt: null
  });
}

activities.push({
  startedAt:
    `${dateOffset(-1)}T08:00:00Z`,
  durationMinutes: 500,
  deletedAt:
    '2026-08-26T10:00:00Z'
});

const analysis = createPerformanceAnalysis(
  {
    healthMetrics,
    activities
  },
  {
    periodKey: '14d',
    referenceDate
  }
);

assert.equal(
  analysis.comparisonAvailable,
  true
);

assert.deepEqual(
  analysis.windows.current,
  {
    startDate: '2026-08-12',
    endDate: '2026-08-25'
  }
);

assert.deepEqual(
  analysis.windows.previous,
  {
    startDate: '2026-07-29',
    endDate: '2026-08-11'
  }
);

assert.equal(
  analysis.comparisons.steps.current.average,
  12000
);

assert.equal(
  analysis.comparisons.steps.previous.average,
  10000
);

assert.equal(
  analysis.comparisons.steps.percent,
  20
);

assert.equal(
  analysis.comparisons.steps.direction,
  'up'
);

assert.equal(
  analysis.comparisons.steps.confidence,
  'high'
);

assert.equal(
  analysis.comparisons.activeEnergy.current.average,
  400
);

assert.equal(
  analysis.comparisons.activeEnergy.previous.average,
  500
);

assert.equal(
  analysis.comparisons.activeEnergy.direction,
  'down'
);

assert.equal(
  analysis.comparisons.activeEnergy.percent,
  -20
);

assert.equal(
  analysis.comparisons.training.current.sessions,
  6
);

assert.equal(
  analysis.comparisons.training.current.minutes,
  240
);

assert.equal(
  analysis.comparisons.training.previous.sessions,
  4
);

assert.equal(
  analysis.comparisons.training.previous.minutes,
  120
);

assert.equal(
  analysis.comparisons.training.direction,
  'up'
);

assert.equal(
  analysis.comparisons.training.percent,
  100
);

assert.equal(
  analysis.primary.id,
  'training'
);

assert.equal(
  analysis.findings.length,
  3
);

const sparseMetrics = [
  {
    date: dateOffset(-1),
    type: 'steps',
    value: 8000,
    importedAt:
      '2026-08-26T08:00:00Z'
  },
  {
    date: dateOffset(-8),
    type: 'steps',
    value: 7000,
    importedAt:
      '2026-08-26T08:00:00Z'
  }
];

const sparse = createPerformanceAnalysis(
  {
    healthMetrics: sparseMetrics,
    activities: []
  },
  {
    periodKey: '7d',
    referenceDate
  }
);

assert.equal(
  sparse.comparisons.steps.comparable,
  false
);

assert.equal(
  sparse.comparisons.steps.confidence,
  'insufficient'
);

assert.equal(
  sparse.comparisons.steps.current.average,
  8000
);

assert.equal(
  sparse.findings.length,
  0
);

const allHistory = createPerformanceAnalysis(
  {
    healthMetrics,
    activities
  },
  {
    periodKey: 'all',
    referenceDate
  }
);

assert.equal(
  allHistory.comparisonAvailable,
  false
);

assert.equal(
  allHistory.reason,
  'all_history_has_no_previous_period'
);

console.log(
  'PASS — Analista compara períodes complets amb cobertura explícita'
);

import {
  localDateISO
} from './calculations.js';

import {
  getHistoryPeriod
} from './history-periods.js';

function atNoon(date = new Date()) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  return result;
}

function fromISO(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function addDays(date, days) {
  const result = atNoon(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(startDate, endDate) {
  return Math.round(
    (
      fromISO(endDate) -
      fromISO(startDate)
    ) / 86400000
  ) + 1;
}

function comparisonWindows(
  period,
  referenceDate
) {
  if (period.all) {
    return null;
  }

  const today = atNoon(referenceDate);
  const currentEnd = addDays(today, -1);
  const currentStart = atNoon(today);

  if (period.days) {
    currentStart.setDate(
      currentStart.getDate() - period.days
    );
  }

  if (period.months) {
    currentStart.setMonth(
      currentStart.getMonth() - period.months
    );
  }

  if (period.years) {
    currentStart.setFullYear(
      currentStart.getFullYear() - period.years
    );
  }

  const currentStartISO =
    localDateISO(currentStart);

  const currentEndISO =
    localDateISO(currentEnd);

  const expectedDays = daysBetween(
    currentStartISO,
    currentEndISO
  );

  const previousEnd =
    addDays(currentStart, -1);

  const previousStart =
    addDays(
      previousEnd,
      -(expectedDays - 1)
    );

  return {
    expectedDays,
    current: {
      startDate: currentStartISO,
      endDate: currentEndISO
    },
    previous: {
      startDate:
        localDateISO(previousStart),
      endDate:
        localDateISO(previousEnd)
    }
  };
}

function latestMetrics(metrics, type) {
  const records = new Map();

  (metrics || [])
    .filter(metric =>
      !metric.deletedAt &&
      metric.type === type &&
      metric.date &&
      Number.isFinite(Number(metric.value)) &&
      Number(metric.value) >= 0
    )
    .forEach(metric => {
      const previous = records.get(metric.date);

      if (
        !previous ||
        String(metric.importedAt || '') >
          String(previous.importedAt || '')
      ) {
        records.set(metric.date, metric);
      }
    });

  return records;
}

function metricWindow(
  records,
  window,
  expectedDays
) {
  const values = [...records.entries()]
    .filter(([date]) =>
      date >= window.startDate &&
      date <= window.endDate
    )
    .map(([, metric]) =>
      Number(metric.value)
    );

  return {
    average:
      values.length
        ? values.reduce(
            (sum, value) => sum + value,
            0
          ) / values.length
        : null,
    coverage: values.length,
    expectedDays,
    coverageRatio:
      expectedDays
        ? values.length / expectedDays
        : 0
  };
}

function directionFor(
  current,
  previous,
  stableThreshold
) {
  if (
    current == null ||
    previous == null
  ) {
    return {
      direction: 'unknown',
      delta: null,
      percent: null
    };
  }

  const delta = current - previous;

  if (previous === 0) {
    return {
      direction:
        current === 0
          ? 'stable'
          : delta > 0
            ? 'up'
            : 'down',
      delta,
      percent:
        current === 0 ? 0 : null
    };
  }

  const percent =
    delta / Math.abs(previous) * 100;

  return {
    direction:
      Math.abs(percent) < stableThreshold
        ? 'stable'
        : delta > 0
          ? 'up'
          : 'down',
    delta,
    percent
  };
}

function confidenceFor(
  currentCoverage,
  previousCoverage
) {
  const minimum = Math.min(
    currentCoverage,
    previousCoverage
  );

  if (minimum >= 0.8) {
    return 'high';
  }

  if (minimum >= 0.5) {
    return 'medium';
  }

  return 'low';
}

function compareMetric(
  metrics,
  {
    id,
    label,
    type,
    unit,
    windows,
    stableThreshold = 3
  }
) {
  const records =
    latestMetrics(metrics, type);

  const current = metricWindow(
    records,
    windows.current,
    windows.expectedDays
  );

  const previous = metricWindow(
    records,
    windows.previous,
    windows.expectedDays
  );

  const minimumCoverage = Math.max(
    3,
    Math.ceil(windows.expectedDays * 0.5)
  );

  const comparable =
    current.coverage >= minimumCoverage &&
    previous.coverage >= minimumCoverage;

  const change = comparable
    ? directionFor(
        current.average,
        previous.average,
        stableThreshold
      )
    : {
        direction: 'unknown',
        delta: null,
        percent: null
      };

  return {
    id,
    label,
    unit,
    comparison: 'daily_average',
    comparable,
    confidence:
      comparable
        ? confidenceFor(
            current.coverageRatio,
            previous.coverageRatio
          )
        : 'insufficient',
    ...change,
    current,
    previous
  };
}

function activityDate(activity) {
  return String(
    activity?.startedAt || ''
  ).slice(0, 10);
}

function activityWindow(
  activities,
  window
) {
  const records = activities.filter(activity => {
    const date = activityDate(activity);

    return (
      !activity.deletedAt &&
      date >= window.startDate &&
      date <= window.endDate
    );
  });

  return {
    sessions: records.length,
    minutes: records.reduce(
      (sum, activity) =>
        sum +
        (
          Number(activity.durationMinutes) ||
          0
        ),
      0
    )
  };
}

function compareTraining(
  activities,
  windows
) {
  const validActivities =
    (activities || []).filter(
      activity =>
        !activity.deletedAt &&
        activity.startedAt
    );

  const current = activityWindow(
    validActivities,
    windows.current
  );

  const previous = activityWindow(
    validActivities,
    windows.previous
  );

  const hasEvidence =
    current.sessions +
    previous.sessions > 0;

  const change = hasEvidence
    ? directionFor(
        current.minutes,
        previous.minutes,
        5
      )
    : {
        direction: 'unknown',
        delta: null,
        percent: null
      };

  return {
    id: 'training',
    label: 'Entrenament',
    unit: 'min',
    comparison: 'total',
    comparable: hasEvidence,
    confidence:
      hasEvidence
        ? 'medium'
        : 'insufficient',
    ...change,
    current,
    previous
  };
}

function relevance(comparison) {
  if (!comparison.comparable) {
    return -1;
  }

  if (comparison.direction === 'stable') {
    return 0;
  }

  if (comparison.percent != null) {
    return Math.abs(comparison.percent);
  }

  return Math.abs(
    Number(comparison.delta) || 0
  );
}

export function createPerformanceAnalysis(
  state,
  {
    periodKey = '14d',
    referenceDate = new Date()
  } = {}
) {
  const period = getHistoryPeriod(periodKey);

  const windows = comparisonWindows(
    period,
    referenceDate
  );

  if (!windows) {
    return {
      period,
      comparisonAvailable: false,
      reason: 'all_history_has_no_previous_period',
      windows: null,
      comparisons: {},
      findings: [],
      primary: null
    };
  }

  const comparisons = {
    steps: compareMetric(
      state.healthMetrics || [],
      {
        id: 'steps',
        label: 'Passos',
        type: 'steps',
        unit: 'passos/dia',
        windows
      }
    ),
    activeEnergy: compareMetric(
      state.healthMetrics || [],
      {
        id: 'active_energy',
        label: 'Kcal actives',
        type: 'active_kcal',
        unit: 'kcal/dia',
        windows
      }
    ),
    training: compareTraining(
      state.activities || [],
      windows
    )
  };

  const findings = Object.values(comparisons)
    .filter(item => item.comparable)
    .sort(
      (a, b) =>
        relevance(b) - relevance(a)
    );

  return {
    period,
    comparisonAvailable: true,
    windows,
    comparisons,
    findings,
    primary:
      findings.find(
        item =>
          item.direction !== 'stable'
      ) ||
      findings[0] ||
      null
  };
}

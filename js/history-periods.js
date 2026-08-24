import { localDateISO } from './calculations.js';

export const HISTORY_PERIODS = [
  {
    key: '7d',
    label: '7D',
    title: '7 dies',
    mode: 'daily',
    days: 7
  },
  {
    key: '14d',
    label: '14D',
    title: '14 dies',
    mode: 'daily',
    days: 14
  },
  {
    key: '30d',
    label: '30D',
    title: '30 dies',
    mode: 'daily',
    days: 30
  },
  {
    key: '3m',
    label: '3M',
    title: '3 mesos',
    mode: 'weekly',
    months: 3
  },
  {
    key: '6m',
    label: '6M',
    title: '6 mesos',
    mode: 'weekly',
    months: 6
  },
  {
    key: '1y',
    label: '1A',
    title: '1 any',
    mode: 'monthly',
    years: 1
  },
  {
    key: 'all',
    label: 'TOT',
    title: 'tot l’històric',
    mode: 'monthly',
    all: true
  }
];

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

function average(values) {
  if (!values.length) return null;

  return values.reduce(
    (sum, value) => sum + Number(value),
    0
  ) / values.length;
}

function latestMetricMap(
  metrics,
  type,
  startDate
) {
  const map = new Map();

  metrics
    .filter(metric =>
      metric.type === type &&
      metric.date &&
      metric.date >= startDate
    )
    .forEach(metric => {
      const previous = map.get(metric.date);

      if (
        !previous ||
        String(metric.importedAt || '') >
          String(previous.importedAt || '')
      ) {
        map.set(metric.date, metric);
      }
    });

  return map;
}

function earliestDateForType(
  metrics,
  type,
  fallback
) {
  const dates = metrics
    .filter(metric =>
      metric.type === type &&
      metric.date
    )
    .map(metric => metric.date)
    .sort();

  return dates[0] || fallback;
}

function startDateForPeriod(
  period,
  metrics,
  valueType,
  today
) {
  if (period.all) {
    return earliestDateForType(
      metrics,
      valueType,
      localDateISO(today)
    );
  }

  const start = atNoon(today);

  if (period.days) {
    start.setDate(
      start.getDate() - (period.days - 1)
    );
  }

  if (period.months) {
    start.setMonth(
      start.getMonth() - period.months
    );
  }

  if (period.years) {
    start.setFullYear(
      start.getFullYear() - period.years
    );
  }

  return localDateISO(start);
}

function formatShortDate(dateString) {
  return new Intl.DateTimeFormat('ca-ES', {
    day: 'numeric',
    month: 'short'
  }).format(fromISO(dateString));
}

function formatMonth(
  dateString,
  includeYear
) {
  return new Intl.DateTimeFormat('ca-ES', {
    month: 'short',
    ...(includeYear
      ? { year: '2-digit' }
      : {})
  }).format(fromISO(dateString));
}

function valuesBetween(
  map,
  startDate,
  endDate
) {
  return [...map.entries()]
    .filter(([date]) =>
      date >= startDate &&
      date <= endDate
    )
    .map(([, metric]) =>
      Number(metric.value)
    );
}

function dailyBuckets(
  map,
  startDate,
  endDate
) {
  const buckets = [];

  for (
    let cursor = fromISO(startDate);
    cursor <= fromISO(endDate);
    cursor = addDays(cursor, 1)
  ) {
    const date = localDateISO(cursor);

    buckets.push({
      date,
      label: formatShortDate(date),
      value: map.get(date)?.value ?? null
    });
  }

  return buckets;
}

function weeklyBuckets(
  map,
  startDate,
  endDate
) {
  const buckets = [];
  const finalDate = fromISO(endDate);

  for (
    let cursor = fromISO(startDate);
    cursor <= finalDate;
    cursor = addDays(cursor, 7)
  ) {
    const bucketStart = localDateISO(cursor);
    const bucketEnd = localDateISO(
      new Date(
        Math.min(
          addDays(cursor, 6).getTime(),
          finalDate.getTime()
        )
      )
    );

    buckets.push({
      date: bucketStart,
      label: formatShortDate(bucketStart),
      value: average(
        valuesBetween(
          map,
          bucketStart,
          bucketEnd
        )
      )
    });
  }

  return buckets;
}

function monthlyBuckets(
  map,
  startDate,
  endDate,
  includeYear
) {
  const buckets = [];
  const first = fromISO(startDate);
  first.setDate(1);

  const finalDate = fromISO(endDate);

  for (
    let cursor = first;
    cursor <= finalDate;
    cursor = (() => {
      const next = atNoon(cursor);
      next.setMonth(next.getMonth() + 1);
      return next;
    })()
  ) {
    const monthStart = localDateISO(cursor);
    const nextMonth = atNoon(cursor);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthEnd = localDateISO(
      addDays(nextMonth, -1)
    );

    const effectiveStart =
      monthStart < startDate
        ? startDate
        : monthStart;

    const effectiveEnd =
      monthEnd > endDate
        ? endDate
        : monthEnd;

    buckets.push({
      date: effectiveStart,
      label: formatMonth(
        effectiveStart,
        includeYear
      ),
      value: average(
        valuesBetween(
          map,
          effectiveStart,
          effectiveEnd
        )
      )
    });
  }

  return buckets;
}

export function getHistoryPeriod(
  periodKey
) {
  return HISTORY_PERIODS.find(
    item => item.key === periodKey
  ) || HISTORY_PERIODS[1];
}

export function historyStartForDates(
  periodKey,
  dates
) {
  const period =
    getHistoryPeriod(periodKey);

  const today = atNoon();
  const todayString =
    localDateISO(today);

  if (period.all) {
    return [...dates]
      .filter(Boolean)
      .sort()[0] || todayString;
  }

  const start = atNoon(today);

  if (period.days) {
    start.setDate(
      start.getDate() -
      (period.days - 1)
    );
  }

  if (period.months) {
    start.setMonth(
      start.getMonth() -
      period.months
    );
  }

  if (period.years) {
    start.setFullYear(
      start.getFullYear() -
      period.years
    );
  }

  return localDateISO(start);
}

export function rollingAverage(
  values,
  windowSize
) {
  return values.map(
    (_, index) => {
      const window = values
        .slice(
          Math.max(
            0,
            index - windowSize + 1
          ),
          index + 1
        )
        .filter(
          value => value != null
        )
        .map(Number);

      if (
        window.length <
        Math.min(3, windowSize)
      ) {
        return null;
      }

      return window.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / window.length;
    }
  );
}

export function createDailyMetricHistory(
  metrics,
  {
    valueType,
    minType = null,
    maxType = null,
    periodKey = '14d'
  }
) {
  const period =
    HISTORY_PERIODS.find(
      item => item.key === periodKey
    ) || HISTORY_PERIODS[1];

  const today = atNoon();
  const endDate = localDateISO(today);

  const startDate = startDateForPeriod(
    period,
    metrics,
    valueType,
    today
  );

  const valueMap = latestMetricMap(
    metrics,
    valueType,
    startDate
  );

  const minMap = minType
    ? latestMetricMap(
        metrics,
        minType,
        startDate
      )
    : new Map();

  const maxMap = maxType
    ? latestMetricMap(
        metrics,
        maxType,
        startDate
      )
    : new Map();

  let buckets;

  if (period.mode === 'weekly') {
    buckets = weeklyBuckets(
      valueMap,
      startDate,
      endDate
    );
  } else if (period.mode === 'monthly') {
    buckets = monthlyBuckets(
      valueMap,
      startDate,
      endDate,
      period.all
    );
  } else {
    buckets = dailyBuckets(
      valueMap,
      startDate,
      endDate
    );
  }

  const dailyValues = [...valueMap.values()]
    .map(metric => Number(metric.value));

  const minimumValues = [...minMap.values()]
    .map(metric => Number(metric.value));

  const maximumValues = [...maxMap.values()]
    .map(metric => Number(metric.value));

  const expectedDays =
    Math.round(
      (
        fromISO(endDate) -
        fromISO(startDate)
      ) / 86400000
    ) + 1;

  return {
    period,
    startDate,
    endDate,
    dates:
      buckets.map(bucket => bucket.date),
    labels:
      buckets.map(bucket => bucket.label),
    values:
      buckets.map(bucket => bucket.value),
    trendValues:
      rollingAverage(
        buckets.map(
          bucket => bucket.value
        ),
        period.mode === 'daily'
          ? 7
          : period.mode === 'weekly'
            ? 4
            : 3
      ),
    average: average(dailyValues),
    observedMin:
      minimumValues.length
        ? Math.min(...minimumValues)
        : null,
    observedMax:
      maximumValues.length
        ? Math.max(...maximumValues)
        : null,
    coverage: dailyValues.length,
    expectedDays
  };
}

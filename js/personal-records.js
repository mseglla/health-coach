import {
  dailyWeightSeries,
  localDateISO,
  recordDate
} from './calculations.js';

function extrema(records) {
  if (!records.length) {
    return {
      min: null,
      max: null
    };
  }

  return records.reduce(
    (result, record) => ({
      min:
        !result.min ||
        record.value < result.min.value
          ? record
          : result.min,
      max:
        !result.max ||
        record.value > result.max.value
          ? record
          : result.max
    }),
    {
      min: null,
      max: null
    }
  );
}

function metricRecords(
  metrics,
  type
) {
  const map = new Map();

  metrics
    .filter(metric =>
      metric.type === type &&
      metric.date &&
      metric.value != null
    )
    .forEach(metric => {
      const previous =
        map.get(metric.date);

      if (
        !previous ||
        String(metric.importedAt || '') >
          String(previous.importedAt || '')
      ) {
        map.set(metric.date, metric);
      }
    });

  return [...map.values()]
    .map(metric => ({
      date: metric.date,
      value: Number(metric.value)
    }))
    .filter(record =>
      Number.isFinite(record.value)
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    );
}

export function createPersonalRecords(
  state
) {
  const weights =
    dailyWeightSeries(
      state.weights || []
    )
      .map(record => ({
        date:
          recordDate(
            record.measuredAt
          ),
        value:
          Number(record.value)
      }))
      .filter(record =>
        Number.isFinite(record.value)
      );

  const steps =
    metricRecords(
      state.healthMetrics || [],
      'steps'
    );

  const todaySteps =
    steps.find(
      record =>
        record.date === localDateISO()
    ) || null;

  const heartRateMinimums =
    metricRecords(
      state.healthMetrics || [],
      'heart_rate_min_bpm'
    );

  const heartRateMaximums =
    metricRecords(
      state.healthMetrics || [],
      'heart_rate_max_bpm'
    );

  const training =
    (state.activities || [])
      .filter(activity =>
        !activity.deletedAt &&
        Number(
          activity.durationMinutes
        ) > 0
      )
      .map(activity => ({
        date:
          recordDate(
            activity.startedAt
          ),
        value:
          Number(
            activity.durationMinutes
          )
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );

  return {
    weight: {
      ...extrema(weights),
      latest:
        weights.at(-1) || null
    },

    steps: {
      ...extrema(steps),
      today: todaySteps
    },

    heartRate: {
      min:
        extrema(
          heartRateMinimums
        ).min,
      max:
        extrema(
          heartRateMaximums
        ).max
    },

    training: {
      ...extrema(training)
    }
  };
}

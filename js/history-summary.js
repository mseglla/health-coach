import {
  dailyWeightSeries,
  inferEnergyBalance,
  localDateISO,
  recordDate
} from './calculations.js';
import {
  createDailyMetricHistory,
  getHistoryPeriod,
  historyStartForDates,
  rollingAverage
} from './history-periods.js';
import {
  createPersonalRecords
} from './personal-records.js';

function formatShortDate(dateString) {
  if (!dateString) return '';

  return new Intl.DateTimeFormat('ca-ES', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${dateString}T12:00:00`));
}

function getWeightGoal(state) {
  return (state.goals || []).find(goal =>
    goal.goalType === 'weight' &&
    goal.isActive !== false &&
    !goal.deletedAt
  ) || null;
}

function expectedWeightForDate(goal, dateString) {
  if (
    !goal ||
    goal.startWeightKg == null ||
    goal.targetValue == null ||
    !goal.targetDate ||
    !goal.createdAt
  ) {
    return null;
  }

  const startDate =
    String(goal.createdAt).slice(0, 10);

  const start =
    new Date(`${startDate}T12:00:00`);

  const target =
    new Date(`${goal.targetDate}T12:00:00`);

  const date =
    new Date(`${dateString}T12:00:00`);

  const totalDays =
    (target - start) / 86400000;

  if (totalDays <= 0) return null;

  const elapsedDays =
    (date - start) / 86400000;

  if (elapsedDays < 0) return null;

  const progress = Math.min(
    1,
    elapsedDays / totalDays
  );

  return Number(goal.startWeightKg) +
    (
      Number(goal.targetValue) -
      Number(goal.startWeightKg)
    ) * progress;
}

function rollingWeightTrend(records, windowSize = 7) {
  return records.map((record, index) => {
    const start =
      Math.max(0, index - windowSize + 1);

    const window =
      records.slice(start, index + 1);

    // Evitem presentar una "tendència" amb només 1-2 punts.
    if (window.length < 3) {
      return null;
    }

    return window.reduce(
      (sum, item) =>
        sum + Number(item.value),
      0
    ) / window.length;
  });
}

function dateAtNoon(dateString) {
  return new Date(
    `${dateString}T12:00:00`
  );
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(
    result.getDate() + days
  );
  return result;
}

function formatMonthLabel(
  dateString,
  includeYear
) {
  return new Intl.DateTimeFormat(
    'ca-ES',
    {
      month: 'short',
      ...(includeYear
        ? { year: '2-digit' }
        : {})
    }
  ).format(
    dateAtNoon(dateString)
  );
}

function buildTrainingPeriod(
  state,
  periodKey
) {
  const activities =
    (state.activities || [])
      .filter(
        activity => !activity.deletedAt
      );

  const activityDates =
    activities.map(
      activity =>
        recordDate(activity.startedAt)
    );

  const startDate =
    historyStartForDates(
      periodKey,
      activityDates
    );

  const endDate =
    localDateISO();

  const period =
    getHistoryPeriod(periodKey);

  const buckets = [];

  if (period.mode === 'daily') {
    for (
      let cursor = dateAtNoon(startDate);
      cursor <= dateAtNoon(endDate);
      cursor = addDays(cursor, 1)
    ) {
      const date = localDateISO(cursor);

      buckets.push({
        start: date,
        end: date,
        label: formatShortDate(date),
        minutes: 0,
        sessions: 0
      });
    }
  } else if (period.mode === 'weekly') {
    const finalDate =
      dateAtNoon(endDate);

    for (
      let cursor = dateAtNoon(startDate);
      cursor <= finalDate;
      cursor = addDays(cursor, 7)
    ) {
      const bucketStart =
        localDateISO(cursor);

      const bucketEnd =
        localDateISO(
          new Date(
            Math.min(
              addDays(cursor, 6).getTime(),
              finalDate.getTime()
            )
          )
        );

      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        label:
          formatShortDate(bucketStart),
        minutes: 0,
        sessions: 0
      });
    }
  } else {
    const first =
      dateAtNoon(startDate);

    first.setDate(1);

    const finalDate =
      dateAtNoon(endDate);

    for (
      let cursor = first;
      cursor <= finalDate;
      cursor = (() => {
        const next = new Date(cursor);
        next.setMonth(
          next.getMonth() + 1
        );
        return next;
      })()
    ) {
      const monthStart =
        localDateISO(cursor);

      const nextMonth =
        new Date(cursor);

      nextMonth.setMonth(
        nextMonth.getMonth() + 1
      );

      const monthEnd =
        localDateISO(
          addDays(nextMonth, -1)
        );

      buckets.push({
        start:
          monthStart < startDate
            ? startDate
            : monthStart,
        end:
          monthEnd > endDate
            ? endDate
            : monthEnd,
        label: formatMonthLabel(
          monthStart,
          period.all
        ),
        minutes: 0,
        sessions: 0
      });
    }
  }

  activities.forEach(activity => {
    const date =
      recordDate(activity.startedAt);

    if (
      date < startDate ||
      date > endDate
    ) {
      return;
    }

    const bucket = buckets.find(
      item =>
        date >= item.start &&
        date <= item.end
    );

    if (!bucket) return;

    bucket.sessions += 1;
    bucket.minutes +=
      Number(
        activity.durationMinutes
      ) || 0;
  });

  const minutesByPeriod =
    buckets.map(
      bucket => bucket.minutes
    );

  return {
    period,
    startDate,
    labels:
      buckets.map(
        bucket => bucket.label
      ),
    sessionsByWeek:
      buckets.map(
        bucket => bucket.sessions
      ),
    minutesByWeek:
      minutesByPeriod,
    trendValues:
      rollingAverage(
        minutesByPeriod,
        period.mode === 'daily'
          ? 7
          : period.mode === 'weekly'
            ? 4
            : 3
      ),
    totalSessions:
      buckets.reduce(
        (sum, bucket) =>
          sum + bucket.sessions,
        0
      ),
    totalMinutes:
      buckets.reduce(
        (sum, bucket) =>
          sum + bucket.minutes,
        0
      )
  };
}

export function createHistorySummary(
  state,
  {
    historyPeriod = '14d'
  } = {}
) {
  const allWeightSeries =
    dailyWeightSeries(
      state.weights || []
    );

  const weightStartDate =
    historyStartForDates(
      historyPeriod,
      allWeightSeries.map(
        record =>
          recordDate(
            record.measuredAt
          )
      )
    );

  const weightSeries =
    allWeightSeries.filter(
      record =>
        recordDate(
          record.measuredAt
        ) >= weightStartDate
    );

  const weightGoal =
    getWeightGoal(state);

  const weightDates =
    weightSeries.map(
      record =>
        recordDate(record.measuredAt)
    );

  const rawWeightValues =
    weightSeries.map(
      record => Number(record.value)
    );

  const trendValues =
    rollingWeightTrend(
      weightSeries,
      7
    );

  const trajectoryValues =
    weightDates.map(
      date =>
        expectedWeightForDate(
          weightGoal,
          date
        )
    );

  const expectedToday =
    expectedWeightForDate(
      weightGoal,
      localDateISO()
    );

  const currentTrend =
    [...trendValues]
      .reverse()
      .find(value => value != null) ?? null;

  const trajectoryDeviation =
    currentTrend != null &&
    expectedToday != null
      ? currentTrend - expectedToday
      : null;

  const balance =
    inferEnergyBalance(state);

  // Negatiu = pèrdua de pes per setmana.
  const observedWeeklyRate =
    balance.available
      ? Number(balance.weeklyWeightChangeKg)
      : null;

  let requiredWeeklyRate = null;

  if (
    weightGoal &&
    currentTrend != null &&
    weightGoal.targetValue != null &&
    weightGoal.targetDate
  ) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const targetDate =
      new Date(`${weightGoal.targetDate}T12:00:00`);

    const remainingDays =
      Math.ceil(
        (targetDate - today) / 86400000
      );

    if (remainingDays > 0) {
      requiredWeeklyRate =
        (
          Number(weightGoal.targetValue) -
          currentTrend
        ) /
        (remainingDays / 7);
    }
  }

  const stepsHistory =
    createDailyMetricHistory(
      state.healthMetrics || [],
      {
        valueType: 'steps',
        periodKey: historyPeriod
      }
    );

  const heartRateHistory =
    createDailyMetricHistory(
      state.healthMetrics || [],
      {
        valueType: 'heart_rate_avg_bpm',
        minType: 'heart_rate_min_bpm',
        maxType: 'heart_rate_max_bpm',
        periodKey: historyPeriod
      }
    );

  const activeEnergyHistory =
    createDailyMetricHistory(
      state.healthMetrics || [],
      {
        valueType: 'active_kcal',
        periodKey: historyPeriod
      }
    );

  const restingEnergyHistory =
    createDailyMetricHistory(
      state.healthMetrics || [],
      {
        valueType: 'resting_kcal',
        periodKey: historyPeriod
      }
    );

  const totalEnergyHistory =
    createDailyMetricHistory(
      state.healthMetrics || [],
      {
        valueType: 'total_kcal',
        periodKey: historyPeriod
      }
    );

  const weeks =
    buildTrainingPeriod(
      state,
      historyPeriod
    );

  const personalRecords =
    createPersonalRecords(state);

  return {
    weight: {
      values: rawWeightValues,
      trendValues,
      labels:
        weightDates.map(formatShortDate),
      records: weightSeries,
      start:
        weightSeries[0]?.value ?? null,
      end:
        weightSeries.at(-1)?.value ?? null,
      trajectoryValues,
      trajectoryDeviation,
      expectedToday,
      currentTrend,
      observedWeeklyRate,
      requiredWeeklyRate
    },

    steps: stepsHistory,

    heartRate: heartRateHistory,

    energy: {
      active: activeEnergyHistory,
      resting: restingEnergyHistory,
      total: totalEnergyHistory
    },

    training: weeks,

    records: personalRecords
  };
}

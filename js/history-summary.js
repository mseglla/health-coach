import {
  dailyWeightSeries,
  inferEnergyBalance,
  localDateISO,
  recordDate
} from './calculations.js';

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localDateISO(date);
}

function formatShortDate(dateString) {
  if (!dateString) return '';

  return new Intl.DateTimeFormat('ca-ES', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${dateString}T12:00:00`));
}

function metricByDate(state, type, days) {
  const start = dateOffset(days - 1);
  const map = new Map();

  (state.healthMetrics || [])
    .filter(metric =>
      metric.type === type &&
      metric.date >= start
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

function dateRange(days) {
  return Array.from(
    { length: days },
    (_, index) => dateOffset(days - 1 - index)
  );
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

function buildTrainingWeeks(state) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const weeks = [];

  for (let index = 3; index >= 0; index -= 1) {
    const end = new Date(today);
    end.setDate(end.getDate() - index * 7);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    weeks.push({
      start: localDateISO(start),
      end: localDateISO(end),
      minutes: 0,
      sessions: 0
    });
  }

  (state.activities || [])
    .filter(activity => !activity.deletedAt)
    .forEach(activity => {
      const date =
        recordDate(activity.startedAt);

      const week = weeks.find(
        item =>
          date >= item.start &&
          date <= item.end
      );

      if (!week) return;

      week.sessions += 1;
      week.minutes +=
        Number(activity.durationMinutes) || 0;
    });

  return weeks;
}

export function createHistorySummary(state) {
  const weightSeries =
    dailyWeightSeries(
      state.weights || []
    ).slice(-30);

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

  const stepDates =
    dateRange(14);

  const stepMap =
    metricByDate(
      state,
      'steps',
      14
    );

  const stepValues =
    stepDates.map(
      date =>
        stepMap.get(date)?.value ?? null
    );

  const availableSteps =
    stepValues.filter(
      value => value != null
    );

  const averageSteps =
    availableSteps.length
      ? availableSteps.reduce(
          (sum, value) =>
            sum + Number(value),
          0
        ) / availableSteps.length
      : null;

  const weeks =
    buildTrainingWeeks(state);

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

    steps: {
      dates: stepDates,
      labels:
        stepDates.map(formatShortDate),
      values: stepValues,
      average: averageSteps,
      coverage:
        availableSteps.length
    },

    training: {
      labels: weeks.map(
        week =>
          `${formatShortDate(week.start)}–${formatShortDate(week.end)}`
      ),
      sessionsByWeek:
        weeks.map(
          week => week.sessions
        ),
      minutesByWeek:
        weeks.map(
          week => week.minutes
        ),
      totalSessions:
        weeks.reduce(
          (sum, week) =>
            sum + week.sessions,
          0
        ),
      totalMinutes:
        weeks.reduce(
          (sum, week) =>
            sum + week.minutes,
          0
        )
    }
  };
}

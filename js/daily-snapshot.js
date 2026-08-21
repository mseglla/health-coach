import {
  averageWeight,
  inferEnergyBalance,
  latestWeightRecord,
  weightForDate,
  weightTrend
} from './calculations.js';

function metricForDate(state, date, type) {
  return (state.healthMetrics || [])
    .filter(metric =>
      metric.date === date &&
      metric.type === type
    )
    .sort((a, b) =>
      String(b.importedAt || '').localeCompare(
        String(a.importedAt || '')
      )
    )[0] || null;
}

function activityDate(activity) {
  return String(activity?.startedAt || '').slice(0, 10);
}

export function createDailySnapshot(state, date) {
  const todayWeight = weightForDate(state.weights || [], date);
  const latestWeight = latestWeightRecord(state.weights || []);

  const checkin = (state.checkins || []).find(
    item =>
      item.date === date &&
      !item.deletedAt
  ) || null;

  const activitiesToday = (state.activities || [])
    .filter(activity =>
      !activity.deletedAt &&
      activityDate(activity) === date
    )
    .sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );

  const stepsMetric = metricForDate(
    state,
    date,
    'steps'
  );

  const activeKcalMetric = metricForDate(
    state,
    date,
    'active_kcal'
  );

  const totalKcalMetric = metricForDate(
    state,
    date,
    'total_kcal'
  );

  const energyBalance = inferEnergyBalance(state);

  return {
    date,

    weight: {
      record: todayWeight || latestWeight,
      measuredToday: Boolean(todayWeight),
      average7d: averageWeight(state.weights || [], 7),
      trend7d: weightTrend(state.weights || [])
    },

    energy: {
      balance: energyBalance,
      activeKcal:
        activeKcalMetric?.value ?? null,
      totalKcal:
        totalKcalMetric?.value ?? null
    },

    movement: {
      steps: stepsMetric?.value ?? null,
      stepsSource: stepsMetric?.source ?? null
    },

    wellbeing: {
      checkin
    },

    training: {
      activities: activitiesToday,
      count: activitiesToday.length,
      latest: activitiesToday[0] || null,
      durationMinutes: activitiesToday.reduce(
        (sum, activity) =>
          sum + (Number(activity.durationMinutes) || 0),
        0
      ),
      activeCalories: activitiesToday.reduce(
        (sum, activity) =>
          sum + (Number(activity.activeCalories) || 0),
        0
      )
    }
  };
}

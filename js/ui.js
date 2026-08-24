import {
  activeWeightRecords,
  averageWeight,
  burnSource,
  dailyWeightSeries,
  daysUntil,
  formatDateShort,
  formatDateTime,
  formatKg,
  inferEnergyBalance,
  latestWeightRecord,
  totalBurn,
  totalIntake,
  weightForDate,
  weightTrend
} from './calculations.js';
import { createDailyInsight } from './daily-insight.js';
import { createDailySnapshot } from './daily-snapshot.js';
import { drawChart } from './charts.js';
import { createHistorySummary } from './history-summary.js';

export const $ = id => document.getElementById(id);

let activeHistoryPeriod = '14d';

export function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

export function getTodayRecord(state, date) {
  return state.days.find(day => day.date === date) || { date };
}


function renderWeightHistory(state) {
  const records = activeWeightRecords(state.weights)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    .slice(0, 12);
  $('weightHistory').innerHTML = records.map(record => `
    <article class="record-row">
      <div class="record-row__main">
        <strong>${formatKg(record.value)}</strong>
        <span>${formatDateTime(record.measuredAt)}</span>
      </div>
      <div class="record-row__actions">
        <button class="mini-button" type="button" data-weight-action="edit" data-id="${record.id}" aria-label="Editar pes">Editar</button>
        <button class="mini-button mini-button--danger" type="button" data-weight-action="delete" data-id="${record.id}" aria-label="Eliminar pes">Eliminar</button>
      </div>
    </article>`).join('') || '<p class="empty-state">Encara no hi ha pesos registrats.</p>';
}

function renderWaistHistory(state) {
  const records = (state.bodyMeasurements || [])
    .filter(record =>
      record.type === 'waist' &&
      !record.deletedAt
    )
    .sort((a, b) =>
      b.measuredAt.localeCompare(a.measuredAt)
    )
    .slice(0, 12);

  $('waistHistory').innerHTML = records.map(record => `
    <article class="record-row">
      <div class="record-row__main">
        <strong>${record.value.toFixed(1).replace('.', ',')} cm</strong>
        <span>${formatDateTime(record.measuredAt)}</span>
      </div>
      <div class="record-row__actions">
        <button
          class="mini-button"
          type="button"
          data-waist-action="edit"
          data-id="${record.id}"
          aria-label="Editar cintura"
        >
          Editar
        </button>
        <button
          class="mini-button mini-button--danger"
          type="button"
          data-waist-action="delete"
          data-id="${record.id}"
          aria-label="Eliminar cintura"
        >
          Eliminar
        </button>
      </div>
    </article>
  `).join('') ||
    '<p class="empty-state">Encara no hi ha mesures de cintura.</p>';
}

function activityLabel(type) {
  const labels = {
    running: 'Running',
    walking: 'Caminar',
    cycling: 'Ciclisme',
    core_training: 'Core',
    strength_training: 'Força',
    functional_strength_training: 'Força funcional',
    hiit: 'HIIT',
    swimming: 'Natació',
    hiking: 'Senderisme',
    yoga: 'Ioga',
    pilates: 'Pilates',
    rowing: 'Rem',
    elliptical: 'El·líptica',
    stair_climbing: 'Escales',
    dance: 'Dansa',
    soccer: 'Futbol',
    tennis: 'Tennis',
    paddle_sports: 'Pàdel / pala'
  };

  if (labels[type]) return labels[type];

  if (String(type || '').startsWith('workout_')) {
    return 'Entrenament';
  }

  return String(type || 'Entrenament')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}


function formatDuration(minutes) {
  if (minutes == null) return null;

  const rounded = Math.round(minutes);

  if (rounded < 60) return `${rounded} min`;

  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;

  return rest
    ? `${hours} h ${rest} min`
    : `${hours} h`;
}

function formatDistance(meters) {
  if (meters == null) return null;

  if (meters >= 1000) {
    return `${(meters / 1000)
      .toFixed(2)
      .replace('.', ',')} km`;
  }

  return `${Math.round(meters)} m`;
}

function renderActivities(state) {
  const container = $('activityHistory');
  if (!container) return;

  const activities = (state.activities || [])
    .filter(activity => !activity.deletedAt)
    .sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    )
    .slice(0, 12);

  container.innerHTML = activities.map(activity => {
    const details = [
      formatDuration(activity.durationMinutes),
      formatDistance(activity.distanceMeters),
      activity.activeCalories != null
        ? `${Math.round(activity.activeCalories)} kcal`
        : null
    ].filter(Boolean);

    const metadata = activity.metadata || {};

    const heartRate =
      metadata.heart_rate_avg_bpm != null
        ? `FC ${Math.round(metadata.heart_rate_avg_bpm)} mitj.${
            metadata.heart_rate_max_bpm != null
              ? ` · ${Math.round(metadata.heart_rate_max_bpm)} màx.`
              : ''
          }`
        : null;

    const power =
      metadata.power_avg_watts != null
        ? `Potència ${Math.round(metadata.power_avg_watts)} W mitj.${
            metadata.power_max_watts != null
              ? ` · ${Math.round(metadata.power_max_watts)} W màx.`
              : ''
          }`
        : null;

    const physiology = [heartRate, power].filter(Boolean);

    const source =
      activity.source === 'healthkit'
        ? 'Apple Health'
        : activity.source || 'manual';

    return `
      <article class="record-row">
        <div class="record-row__main">
          <strong>${activityLabel(activity.type)}</strong>
          <span>${formatDateTime(activity.startedAt)}</span>
          <span>${details.join(' · ') || 'Sense mètriques addicionals'}</span>
          ${
            physiology.length
              ? `<span>${physiology.join(' · ')}</span>`
              : ''
          }
        </div>
        <div class="record-row__actions">
          <span class="chip">${source}</span>
        </div>
      </article>
    `;
  }).join('') ||
    '<p class="empty-state">Encara no hi ha entrenaments importats.</p>';
}


function renderRecentDays(state) {
  $('recentEntries').innerHTML = [...state.days].reverse().slice(0, 7).map(entry => {
    const burn = totalBurn(state, entry);
    const intake = totalIntake(state, entry);
    return `
      <div class="entry">
        <span>${formatDateShort(entry.date)}</span>
        <span>${intake ?? '—'} / ${burn ?? '—'} kcal</span>
      </div>`;
  }).join('') || '<p class="empty-state">Encara no hi ha registres d’energia.</p>';
}

function renderDailyBrief(state, snapshot) {
  const insight = createDailyInsight(
    state,
    snapshot
  );

  $('dailyHeadline').textContent =
    insight.headline;

  $('dailySummary').textContent =
    insight.summary;

  $('dailyAction').textContent =
    insight.action;

  const trajectory = $('dailyTrajectory');

  if (insight.trajectory.status === 'on_track') {
    trajectory.hidden = false;
    trajectory.textContent = 'EN TRAJECTÒRIA';
  } else if (
    insight.trajectory.status === 'behind'
  ) {
    trajectory.hidden = false;
    trajectory.textContent = 'FORA DE RITME';
  } else {
    trajectory.hidden = true;
    trajectory.textContent = '';
  }

  $('dailyEvidence').innerHTML =
    insight.evidence.map(item => `
      <div class="daily-evidence__item">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `).join('');
}

function renderCheckinPrompt(state, today) {
  const prompt = $('checkinPrompt');
  if (!prompt) return;

  const answered = (state.checkins || []).some(
    checkin =>
      checkin.date === today &&
      !checkin.deletedAt
  );

  prompt.hidden =
    answered ||
    Boolean(state.checkinPromptDismissed);
}

export function renderApp(state, today) {
  const snapshot = createDailySnapshot(state, today);
  const day = getTodayRecord(state, today);
  const burn = totalBurn(state, day);
  const energyBalance = inferEnergyBalance(state);
  const todayWeight =
    snapshot.weight.measuredToday
      ? snapshot.weight.record
      : null;
  const displayWeight = snapshot.weight.record;
  const avg = snapshot.weight.average7d;
  const trend = snapshot.weight.trend7d;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const primaryGoal =
    goals.find(goal => goal.isPrimary) ||
    goals[0] ||
    null;
  const weightGoal =
    goals.find(goal => goal.goalType === 'weight') ||
    null;

  $('greetingName').textContent =
    state.profile?.displayName || '';
  $('missionGoal').textContent =
    primaryGoal?.goalType === 'weight'
      ? formatKg(primaryGoal.targetValue)
      : primaryGoal?.title || '—';
  $('missionDate').textContent =
    formatDateShort(primaryGoal?.targetDate);
  $('missionDays').textContent =
    `${daysUntil(primaryGoal?.targetDate) ?? '—'} dies`;
  $('weightToday').textContent = formatKg(displayWeight?.value);
  $('weightAvg').textContent = formatKg(avg);
  $('energyBalance').textContent =
    !energyBalance.available
      ? '—'
      : energyBalance.status === 'deficit'
        ? `−${energyBalance.absoluteBalanceKcal}`
        : energyBalance.status === 'surplus'
          ? `+${energyBalance.absoluteBalanceKcal}`
          : '≈0';

  $('energyBalanceDetail').textContent =
    !energyBalance.available
      ? 'esperant tendència'
      : `kcal/dia · ${energyBalance.confidence === 'medium' ? 'confiança mitjana' : 'confiança baixa'}`;

  $('burnToday').textContent =
    snapshot.movement.steps != null
      ? Math.round(snapshot.movement.steps).toLocaleString('ca-ES')
      : '—';

  $('burnSourceToday').textContent =
    snapshot.movement.steps != null
      ? snapshot.movement.stepsSource === 'healthkit'
        ? 'Apple Health'
        : snapshot.movement.stepsSource || 'registrats'
      : 'sense dades';
  $('weightDelta').textContent = displayWeight
    ? todayWeight ? `Avui · ${formatDateTime(todayWeight.measuredAt)}` : `Últim: ${formatDateTime(displayWeight.measuredAt)}`
    : 'Sense registres';
  $('weightTrend').textContent = trend == null ? 'Esperant dades' : trend < -0.1 ? 'Tendència positiva' : trend > 0.1 ? 'Tendència a l’alça' : 'Tendència estable';
  renderDailyBrief(state, snapshot);

  $('stepsInput').value = day.steps ?? '';
  $('activeInput').value = day.active ?? '';
  $('totalInput').value = day.total ?? '';
  $('nameSetting').value = state.profile?.displayName ?? '';
  $('birthDateSetting').value = state.profile?.birthDate ?? '';
  $('heightSetting').value = state.profile?.heightCm ?? '';
  $('sexSetting').value = state.profile?.metabolicSex ?? '';
  $('goalSetting').value =
    weightGoal?.targetValue ?? '';
  $('dateSetting').value =
    weightGoal?.targetDate ?? '';

  renderCheckinPrompt(state, today);
  renderWeightHistory(state);
  renderWaistHistory(state);
  renderActivities(state);
  renderRecentDays(state);
}


function numericTrend(values) {
  const points = (values || [])
    .filter(value => value != null)
    .map(Number)
    .filter(Number.isFinite);

  if (points.length < 2) {
    return null;
  }

  const start = points[0];
  const end = points.at(-1);
  const delta = end - start;
  const percent =
    start === 0
      ? null
      : (delta / Math.abs(start)) * 100;

  return {
    delta,
    percent
  };
}

function renderTrendIndicator(
  elementId,
  values,
  {
    positiveDirection = 1,
    neutral = false,
    absoluteThreshold = 0
  } = {}
) {
  const element = $(elementId);
  const trend = numericTrend(values);

  element.title =
    'Final del període comparat amb l’inici · tendència suavitzada';

  element.className =
    'trend-indicator trend-indicator--neutral';

  if (!trend || trend.percent == null) {
    element.textContent = '—';
    element.setAttribute(
      'aria-label',
      'Tendència no disponible'
    );
    return;
  }

  const stable =
    Math.abs(trend.delta) <= absoluteThreshold ||
    Math.abs(trend.percent) < 1;

  if (stable) {
    element.textContent = '→ ESTABLE';
    element.setAttribute(
      'aria-label',
      'Tendència estable'
    );
    return;
  }

  const direction =
    trend.delta > 0 ? 1 : -1;

  const arrow =
    direction > 0 ? '↑' : '↓';

  element.textContent =
    `${arrow} ${Math.abs(trend.percent)
      .toFixed(0)}%`;

  if (neutral || !positiveDirection) {
    element.setAttribute(
      'aria-label',
      `Canvi observat del ${Math.abs(
        trend.percent
      ).toFixed(0)} per cent`
    );
    return;
  }

  const isPositive =
    direction === positiveDirection;

  element.className =
    `trend-indicator ${
      isPositive
        ? 'trend-indicator--positive'
        : 'trend-indicator--negative'
    }`;

  element.setAttribute(
    'aria-label',
    `Tendència ${
      isPositive ? 'positiva' : 'negativa'
    }: ${Math.abs(trend.percent).toFixed(0)} per cent`
  );
}

function setRecordProgress(
  elementId,
  current,
  record
) {
  const element = $(elementId);

  const percentage =
    current != null &&
    record != null &&
    Number(record) > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Number(current) /
              Number(record) *
              100
          )
        )
      : 0;

  element.style.width =
    `${percentage.toFixed(1)}%`;

  return percentage;
}

export function renderCharts(state) {
  const history = createHistorySummary(
    state,
    {
      historyPeriod:
        activeHistoryPeriod
    }
  );

  document
    .querySelectorAll(
      '[data-history-period]'
    )
    .forEach(button => {
      const isActive =
        button.dataset.historyPeriod ===
        activeHistoryPeriod;

      button.classList.toggle(
        'is-active',
        isActive
      );

      button.setAttribute(
        'aria-pressed',
        String(isActive)
      );

      button.onclick = () => {
        activeHistoryPeriod =
          button.dataset.historyPeriod;

        renderCharts(state);
      };
    });

  drawChart(
    $('weightChart'),
    history.weight.trendValues,
    history.weight.trajectoryValues,
    {
      labels: history.weight.labels,
      points: history.weight.values
    }
  );

  drawChart(
    $('stepsChart'),
    history.steps.values,
    history.steps.trendValues,
    {
      labels: history.steps.labels,
      zeroFloor: true
    }
  );

  drawChart(
    $('heartRateChart'),
    history.heartRate.values,
    history.heartRate.trendValues,
    {
      labels: history.heartRate.labels
    }
  );

  drawChart(
    $('trainingChart'),
    history.training.minutesByWeek,
    history.training.trendValues,
    {
      labels: history.training.labels,
      zeroFloor: true
    }
  );


  const weightTrajectory =
    history.weight.trajectoryValues
      .filter(value => value != null)
      .map(Number)
      .filter(Number.isFinite);

  let weightGoalDirection = 0;

  if (weightTrajectory.length >= 2) {
    const trajectoryDelta =
      weightTrajectory.at(-1) -
      weightTrajectory[0];

    weightGoalDirection =
      trajectoryDelta > 0
        ? 1
        : trajectoryDelta < 0
          ? -1
          : 0;
  } else if (
    history.weight.requiredWeeklyRate != null
  ) {
    weightGoalDirection =
      history.weight.requiredWeeklyRate > 0
        ? 1
        : history.weight.requiredWeeklyRate < 0
          ? -1
          : 0;
  }

  renderTrendIndicator(
    'historyWeightTrend',
    history.weight.trendValues,
    {
      positiveDirection:
        weightGoalDirection,
      neutral:
        weightGoalDirection === 0,
      absoluteThreshold: 0.1
    }
  );

  renderTrendIndicator(
    'historyStepsTrend',
    history.steps.trendValues
  );

  renderTrendIndicator(
    'historyHeartRateTrend',
    history.heartRate.trendValues,
    {
      neutral: true
    }
  );

  renderTrendIndicator(
    'historyTrainingTrend',
    history.training.trendValues
  );

  $('historyWeightPeriod').textContent =
    history.steps.period.title.toUpperCase();

  $('historyTrainingPeriod').textContent =
    history.training.period.title.toUpperCase();

  $('trainingPeriodChip').textContent =
    history.training.period.label;

  const weightChange =
    history.weight.start != null &&
    history.weight.end != null
      ? history.weight.end -
        history.weight.start
      : null;

  $('historyWeightChange').textContent =
    weightChange == null
      ? '—'
      : `${weightChange > 0 ? '+' : ''}${weightChange
          .toFixed(1)
          .replace('.', ',')} kg`;

  const deviation =
    history.weight.trajectoryDeviation;

  const observedRate =
    history.weight.observedWeeklyRate;

  const requiredRate =
    history.weight.requiredWeeklyRate;

  let trajectoryText;

  if (deviation == null) {
    trajectoryText =
      history.weight.records.length >= 2
        ? `${history.weight.records.length} registres analitzats`
        : 'Calen més registres';
  } else if (Math.abs(deviation) < 0.1) {
    trajectoryText =
      'pràcticament sobre la trajectòria objectiu';
  } else if (deviation > 0) {
    trajectoryText =
      `${deviation
        .toFixed(1)
        .replace('.', ',')} kg per sobre de la trajectòria`;
  } else {
    trajectoryText =
      `${Math.abs(deviation)
        .toFixed(1)
        .replace('.', ',')} kg per davant de la trajectòria`;
  }

  const formatWeeklyRate = value => {
    if (value == null) return null;

    const sign =
      value > 0 ? '+' : value < 0 ? '−' : '';

    return `${sign}${Math.abs(value)
      .toFixed(2)
      .replace('.', ',')} kg/setm.`;
  };

  const rateParts = [];

  if (observedRate != null) {
    rateParts.push(
      `observat ${formatWeeklyRate(observedRate)}`
    );
  }

  if (requiredRate != null) {
    rateParts.push(
      `necessari ${formatWeeklyRate(requiredRate)}`
    );
  }

  $('historyWeightDetail').textContent =
    trajectoryText;

  $('historyStepsPeriod').textContent =
    history.steps.period.title.toUpperCase();

  $('stepsPeriodChip').textContent =
    history.steps.period.label;

  $('historyHeartRatePeriod').textContent =
    history.heartRate.period.title.toUpperCase();

  $('heartRatePeriodChip').textContent =
    history.heartRate.period.label;

  $('historyStepsAverage').textContent =
    history.steps.average == null
      ? '—'
      : Math.round(
          history.steps.average
        ).toLocaleString('ca-ES');

  $('historyStepsCoverage').textContent =
    history.steps.coverage
      ? `${history.steps.coverage}/${history.steps.expectedDays} dies`
      : 'Sense dades';

  $('historyHeartRateAverage').textContent =
    history.heartRate.average == null
      ? '—'
      : `${Math.round(history.heartRate.average)} bpm`;

  const heartRateMinimum =
    history.heartRate.observedMin == null
      ? null
      : Math.round(
          history.heartRate.observedMin
        );

  const heartRateMaximum =
    history.heartRate.observedMax == null
      ? null
      : Math.round(
          history.heartRate.observedMax
        );

  $('historyHeartRateCoverage').textContent =
    history.heartRate.coverage &&
    heartRateMinimum != null &&
    heartRateMaximum != null
      ? `${heartRateMinimum}–${heartRateMaximum} bpm · ${history.heartRate.coverage}/${history.heartRate.expectedDays} dies`
      : 'Sense dades';

  $('historyTrainingTotal').textContent =
    history.training.totalSessions
      ? `${history.training.totalSessions} sessions`
      : '—';

  $('historyTrainingDetail').textContent =
    history.training.totalSessions
      ? `${Math.round(history.training.totalMinutes)} min`
      : 'Sense entrenaments';

  const formatRecordDate = date =>
    date
      ? new Intl.DateTimeFormat(
          'ca-ES',
          {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          }
        ).format(
          new Date(
            `${date}T12:00:00`
          )
        )
      : '—';

  const formatInteger = value =>
    Math.round(
      Number(value)
    ).toLocaleString('ca-ES');

  const formatWeightRecord = value =>
    Number(value)
      .toFixed(1)
      .replace('.', ',');

  const weightRecords =
    history.records.weight;

  $('recordWeightMin').textContent =
    weightRecords.min
      ? formatWeightRecord(
          weightRecords.min.value
        )
      : '—';

  $('recordWeightMinDate').textContent =
    weightRecords.min
      ? formatRecordDate(
          weightRecords.min.date
        )
      : '—';

  $('recordWeightMax').textContent =
    weightRecords.max
      ? formatWeightRecord(
          weightRecords.max.value
        )
      : '—';

  $('recordWeightMaxDate').textContent =
    weightRecords.max
      ? formatRecordDate(
          weightRecords.max.date
        )
      : '—';

  const stepRecords =
    history.records.steps;

  $('recordStepsMax').textContent =
    stepRecords.max
      ? formatInteger(
          stepRecords.max.value
        )
      : '—';

  $('recordStepsMaxDate').textContent =
    stepRecords.max
      ? formatRecordDate(
          stepRecords.max.date
        )
      : '—';

  $('recordStepsToday').textContent =
    stepRecords.today
      ? formatInteger(
          stepRecords.today.value
        )
      : '—';

  const stepsProgress =
    setRecordProgress(
      'recordStepsProgress',
      stepRecords.today?.value,
      stepRecords.max?.value
    );

  $('recordStepsProgressLabel').textContent =
    stepRecords.today &&
    stepRecords.max
      ? `${Math.round(stepsProgress)}%`
      : '—';

  const heartRecords =
    history.records.heartRate;

  $('recordHeartRateMin').textContent =
    heartRecords.min
      ? formatInteger(
          heartRecords.min.value
        )
      : '—';

  $('recordHeartRateMinDate').textContent =
    heartRecords.min
      ? formatRecordDate(
          heartRecords.min.date
        )
      : '—';

  $('recordHeartRateMax').textContent =
    heartRecords.max
      ? formatInteger(
          heartRecords.max.value
        )
      : '—';

  $('recordHeartRateMaxDate').textContent =
    heartRecords.max
      ? formatRecordDate(
          heartRecords.max.date
        )
      : '—';

  const trainingRecords =
    history.records.training;

  $('recordTrainingMax').textContent =
    trainingRecords.max
      ? `${formatInteger(
          trainingRecords.max.value
        )} min`
      : '—';

  $('recordTrainingMaxDate').textContent =
    trainingRecords.max
      ? formatRecordDate(
          trainingRecords.max.date
        )
      : '—';

}

export function openScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === screenId));
  document.querySelectorAll('.bottom-nav__item').forEach(button => button.classList.toggle('is-active', button.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

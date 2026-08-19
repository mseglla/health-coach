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
import { getCoachDecision } from './coach.js';
import { drawChart } from './charts.js';

export const $ = id => document.getElementById(id);

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

function updateOrbit(state, _day, decision) {
  const balance = inferEnergyBalance(state);

  if (!balance.available) {
    $('balanceToday').textContent = '—';
  } else if (balance.status === 'deficit') {
    $('balanceToday').textContent =
      `−${balance.absoluteBalanceKcal} kcal/dia`;
  } else if (balance.status === 'surplus') {
    $('balanceToday').textContent =
      `+${balance.absoluteBalanceKcal} kcal/dia`;
  } else {
    $('balanceToday').textContent = '≈ 0 kcal/dia';
  }

  $('orbitCaption').textContent = decision.caption;
  $('statusPill').textContent = decision.label;
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
  const day = getTodayRecord(state, today);
  const burn = totalBurn(state, day);
  const energyBalance = inferEnergyBalance(state);
  const todayWeight = weightForDate(state.weights, today);
  const latest = latestWeightRecord(state.weights);
  const displayWeight = todayWeight || latest;
  const avg = averageWeight(state.weights, 7);
  const trend = weightTrend(state.weights);
  const decision = getCoachDecision(state, day);
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

  $('burnToday').textContent = burn ?? '—';
  $('burnSourceToday').textContent = burn == null ? 'sense dades' : burnSource(day) || 'estimades';
  $('weightDelta').textContent = displayWeight
    ? todayWeight ? `Avui · ${formatDateTime(todayWeight.measuredAt)}` : `Últim: ${formatDateTime(displayWeight.measuredAt)}`
    : 'Sense registres';
  $('weightTrend').textContent = trend == null ? 'Esperant dades' : trend < -0.1 ? 'Tendència positiva' : trend > 0.1 ? 'Tendència a l’alça' : 'Tendència estable';
  $('recommendation').textContent = decision.title;
  updateOrbit(state, day, decision);

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

export function renderCharts(state) {
  const weightSeries = dailyWeightSeries(state.weights).slice(-30);
  const days = state.days.slice(-30);
  drawChart($('weightChart'), weightSeries.map(record => record.value));
  drawChart($('calorieChart'), days.map(day => totalIntake(state, day)), days.map(day => totalBurn(state, day)));
}

export function openScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === screenId));
  document.querySelectorAll('.bottom-nav__item').forEach(button => button.classList.toggle('is-active', button.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

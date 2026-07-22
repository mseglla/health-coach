import {
  adherenceScore,
  averageDeficit,
  averageWeight,
  burnSource,
  dailyWeightSeries,
  formatDateTime,
  formatKcal,
  formatKg,
  getDay,
  latestWeightRecord,
  mealLabel,
  recordDate,
  recordsForDate,
  totalBurn,
  totalIntake,
  weightTrend
} from './calculations.js';
import { getCoachDecision } from './coach.js';
import { drawChart } from './charts.js';

export const $ = id => document.getElementById(id);

const activityLabels = {
  walk: 'Caminar', run: 'Córrer', treadmill: 'Cinta', spinning: 'Spinning',
  padel: 'Pàdel', strength: 'Força', other: 'Altres'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2300);
}

function updateOrbit(state, day, decision) {
  const burn = totalBurn(state, day);
  const intake = totalIntake(state, day);
  const deficit = burn != null && intake != null ? burn - intake : null;
  const progress = deficit == null ? 0 : Math.max(0, Math.min(1, deficit / 500));
  const activityProgress = day.active == null ? 0 : Math.max(0, Math.min(1, day.active / 600));

  $('orbitProgress').style.strokeDashoffset = String(553 * (1 - progress));
  $('orbitActivity').style.strokeDashoffset = String(452 * (1 - activityProgress));
  $('orbitProgress').style.stroke = decision.tone === 'bad' ? '#ff5f7a' : decision.tone === 'warn' ? '#ffae4a' : '#b7ff3c';
  $('balanceToday').textContent = deficit == null ? '—' : `${deficit >= 0 ? '−' : '+'}${formatKcal(Math.abs(deficit))}`;
  $('orbitCaption').textContent = decision.caption;
  $('statusPill').textContent = decision.label;
  $('statusPill').className = `status-pill status-pill--${decision.tone}`;
}

function renderTimelineItem({ icon, title, meta, type, id }) {
  return `<article class="timeline-item">
    <div class="timeline-item__icon">${icon}</div>
    <div class="timeline-item__body"><strong>${title}</strong><span>${meta}</span></div>
    ${type && id ? `<div class="timeline-item__actions"><button class="mini-button" data-record-action="edit" data-record-type="${type}" data-id="${id}">Editar</button><button class="mini-button mini-button--danger" data-record-action="delete" data-record-type="${type}" data-id="${id}">Eliminar</button></div>` : ''}
  </article>`;
}

function renderMeals(records, editable = false) {
  return records.map(meal => renderTimelineItem({
    icon: '🍽️',
    title: `${mealLabel(meal.type)} · ${escapeHtml(meal.description)}`,
    meta: `${formatDateTime(meal.loggedAt)}${meal.calories != null ? ` · ${formatKcal(meal.calories)} kcal` : ' · calories pendents'}${meal.protein != null ? ` · ${Math.round(meal.protein)} g proteïna` : ''}`,
    type: editable ? 'meal' : null,
    id: meal.id
  })).join('');
}

function renderActivities(records, editable = false) {
  return records.map(activity => renderTimelineItem({
    icon: '🏃',
    title: `${activityLabels[activity.type] || 'Activitat'}${activity.note ? ` · ${escapeHtml(activity.note)}` : ''}`,
    meta: `${formatDateTime(activity.startedAt)} · ${Math.round(activity.minutes)} min${activity.calories != null ? ` · ${formatKcal(activity.calories)} kcal` : ''}`,
    type: editable ? 'activity' : null,
    id: activity.id
  })).join('');
}

function renderWeightRecords(records, editable = false) {
  return records.map(weight => renderTimelineItem({
    icon: '⚖️',
    title: formatKg(weight.value),
    meta: formatDateTime(weight.measuredAt),
    type: editable ? 'weight' : null,
    id: weight.id
  })).join('');
}

function renderTodayChecklist(state, date) {
  const day = getDay(state, date);
  const rows = [
    ['Pes', recordsForDate(state.weights, 'measuredAt', date).length > 0],
    ['Àpats', recordsForDate(state.meals, 'loggedAt', date).length > 0 || day.intake != null],
    ['Energia', day.total != null || day.active != null],
    ['Passos', day.steps != null]
  ];
  $('todayChecklist').innerHTML = rows.map(([label, done]) => `<span class="check-pill ${done ? 'is-done' : ''}">${done ? '✓' : '○'} ${label}</span>`).join('');
}

function renderHome(state, today) {
  const day = getDay(state, today);
  const latest = latestWeightRecord(state.weights);
  const intake = totalIntake(state, day);
  const burn = totalBurn(state, day);
  const score = adherenceScore(state, today);
  const decision = getCoachDecision(state, day);
  const meals = recordsForDate(state.meals, 'loggedAt', today).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const activities = recordsForDate(state.activities, 'startedAt', today).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  $('greetingName').textContent = state.settings.name || 'Marc';
  $('todayLabel').textContent = new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('weightToday').textContent = formatKg(latest?.value);
  $('missionGoal').textContent = formatKg(state.settings.goal);
  const start = Number(state.settings.startWeight);
  const goal = Number(state.settings.goal);
  const current = Number(latest?.value);
  const progress = Number.isFinite(start) && Number.isFinite(goal) && Number.isFinite(current) && start !== goal
    ? Math.max(0, Math.min(100, ((start - current) / (start - goal)) * 100)) : null;
  $('goalProgress').textContent = progress == null ? '—' : `${Math.round(progress)}%`;
  $('intakeToday').textContent = formatKcal(intake);
  $('burnToday').textContent = formatKcal(burn);
  $('burnSourceToday').textContent = burn == null ? 'pendent' : burnSource(day);
  $('activeToday').textContent = formatKcal(day.active);
  $('stepsToday').textContent = day.steps != null ? Math.round(day.steps).toLocaleString('ca-ES') : '—';
  $('adherenceScore').textContent = `${score}%`;
  $('adherenceBar').style.width = `${score}%`;
  $('recommendation').textContent = decision.title;
  updateOrbit(state, day, decision);
  renderTodayChecklist(state, today);
  $('homeMeals').innerHTML = renderMeals(meals) || '<p class="empty-state">Encara no has registrat cap àpat avui.</p>';
  $('homeActivities').innerHTML = renderActivities(activities) || '<p class="empty-state">Encara no has registrat cap activitat avui.</p>';
}

function renderDiary(state, date) {
  const day = getDay(state, date);
  const weights = recordsForDate(state.weights, 'measuredAt', date);
  const meals = recordsForDate(state.meals, 'loggedAt', date);
  const activities = recordsForDate(state.activities, 'startedAt', date);
  const burn = totalBurn(state, day);
  const intake = totalIntake(state, day);
  const balance = burn != null && intake != null ? burn - intake : null;

  $('diaryDate').value = date;
  $('diaryBalanceChip').textContent = balance == null ? 'pendent' : `${balance >= 0 ? '−' : '+'}${formatKcal(Math.abs(balance))} kcal`;
  $('diarySummary').innerHTML = [
    ['Pes', weights.length ? formatKg(weights.at(-1).value) : '—'],
    ['Ingerides', `${formatKcal(intake)} kcal`],
    ['Gastades', `${formatKcal(burn)} kcal`],
    ['Passos', day.steps != null ? Math.round(day.steps).toLocaleString('ca-ES') : '—']
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');

  const timeline = [
    ...weights.map(record => ({ date: record.measuredAt, html: renderWeightRecords([record], true) })),
    ...meals.map(record => ({ date: record.loggedAt, html: renderMeals([record], true) })),
    ...activities.map(record => ({ date: record.startedAt, html: renderActivities([record], true) }))
  ].sort((a, b) => a.date.localeCompare(b.date)).map(item => item.html).join('');
  $('diaryTimeline').innerHTML = timeline || '<p class="empty-state">Aquest dia encara no té registres.</p>';
}

function completeDaysCount(state) {
  const dates = new Set([
    ...state.days.map(day => day.date),
    ...state.weights.map(item => recordDate(item.measuredAt)),
    ...state.meals.map(item => recordDate(item.loggedAt)),
    ...state.activities.map(item => recordDate(item.startedAt))
  ]);
  return [...dates].sort().slice(-14).filter(date => adherenceScore(state, date) >= 75).length;
}

function renderProgress(state) {
  const avg = averageWeight(state.weights, 7);
  const trend = weightTrend(state.weights);
  const avgDeficit = averageDeficit(state, 7);
  const weeklyPace = trend == null ? null : trend;
  $('weightAvg').textContent = formatKg(avg);
  $('weightTrend').textContent = trend == null ? 'Esperant dades' : `${trend <= 0 ? '↓' : '↑'} ${Math.abs(trend).toFixed(1).replace('.', ',')} kg vs. setmana anterior`;
  $('avgDeficit').textContent = avgDeficit == null ? '—' : `${avgDeficit >= 0 ? '−' : '+'}${formatKcal(Math.abs(avgDeficit))}`;
  $('completeDays').textContent = String(completeDaysCount(state));
  $('weeklyPace').textContent = weeklyPace == null ? '—' : `${weeklyPace.toFixed(2).replace('.', ',')}`;

  let narrative = 'Encara necessitem més dades per llegir la tendència.';
  if (state.weights.length >= 7 && trend != null) {
    if (trend < -0.8) narrative = 'El pes baixa ràpid. Vigila que el dèficit no sigui massa agressiu i prioritza recuperació.';
    else if (trend < -0.1) narrative = 'La tendència és favorable. Mantén el pla sense introduir canvis grans.';
    else if (trend <= 0.1) narrative = 'La tendència és pràcticament plana. Espera dades suficients abans de tocar el pla.';
    else narrative = 'La tendència puja. Revisa primer la qualitat i completitud dels registres abans d’ajustar calories.';
  }
  $('progressNarrative').textContent = narrative;
}

function renderSettings(state) {
  $('nameSetting').value = state.settings.name ?? '';
  $('ageSetting').value = state.settings.age ?? '';
  $('heightSetting').value = state.settings.height ?? '';
  $('sexSetting').value = state.settings.sex ?? 'male';
  $('startWeightSetting').value = state.settings.startWeight ?? '';
  $('goalSetting').value = state.settings.goal ?? '';
  $('dateSetting').value = state.settings.targetDate ?? '';
  $('weeklyGoalSetting').value = String(state.settings.weeklyGoal ?? 0.5);
}

export function renderApp(state, { today, diaryDate }) {
  renderHome(state, today);
  renderDiary(state, diaryDate);
  renderProgress(state);
  renderSettings(state);
}

export function renderCharts(state) {
  const weights = dailyWeightSeries(state.weights).slice(-30);
  const days = [...state.days].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  drawChart($('weightChart'), weights.map(record => record.value));
  drawChart($('calorieChart'), days.map(day => totalIntake(state, day)), days.map(day => totalBurn(state, day)));
}

export function openScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === screenId));
  document.querySelectorAll('.bottom-nav__item').forEach(button => button.classList.toggle('is-active', button.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
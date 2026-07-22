import {
  averageWeight,
  burnSource,
  dailyWeightSeries,
  daysUntil,
  formatDateShort,
  formatDateTime,
  formatKg,
  latestWeightRecord,
  totalBurn,
  totalIntake,
  weightForDate,
  weightTrend
} from './calculations.js';
import { getCoachDecision } from './coach.js';
import { drawChart } from './charts.js';

export const $ = id => document.getElementById(id);

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
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

export function getTodayRecord(state, date) {
  return state.days.find(day => day.date === date) || { date };
}

function updateOrbit(state, day, decision) {
  const burn = totalBurn(state, day);
  const intake = totalIntake(state, day);
  const deficit = burn != null && intake != null ? burn - intake : null;
  const targetDeficit = 500;
  const progress = deficit == null ? 0 : Math.max(0, Math.min(1, deficit / targetDeficit));
  const activityProgress = day.active == null ? 0 : Math.max(0, Math.min(1, day.active / 600));
  $('orbitProgress').style.strokeDashoffset = String(553 * (1 - progress));
  $('orbitActivity').style.strokeDashoffset = String(452 * (1 - activityProgress));
  $('orbitProgress').style.stroke = decision.tone === 'bad' ? '#ff5f7a' : decision.tone === 'warn' ? '#ffae4a' : '#b7ff3c';
  $('balanceToday').textContent = deficit == null ? '—' : `${deficit >= 0 ? '−' : '+'}${Math.abs(Math.round(deficit))}`;
  $('orbitCaption').textContent = decision.caption;
  $('statusPill').textContent = decision.label;
  $('statusPill').className = `status-pill status-pill--${decision.tone}`;
}

function renderWeightHistory(state) {
  const records = [...state.weights].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)).slice(0, 12);
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

function renderMealHistory(state, today) {
  const meals = [...state.meals].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)).slice(0, 12);
  $('mealHistory').innerHTML = meals.map(meal => `
    <article class="record-row record-row--meal">
      <div class="record-row__main">
        <strong>${escapeHtml(meal.description)}</strong>
        <span>${formatDateTime(meal.loggedAt)}${meal.calories != null ? ` · ${Math.round(meal.calories)} kcal` : ''}</span>
      </div>
      <div class="record-row__actions">
        <button class="mini-button mini-button--danger" type="button" data-meal-action="delete" data-id="${meal.id}" aria-label="Eliminar àpat">Eliminar</button>
      </div>
    </article>`).join('') || '<p class="empty-state">Encara no hi ha àpats registrats.</p>';

  const todayCount = state.meals.filter(meal => meal.loggedAt.startsWith(today)).length;
  $('mealCountChip').textContent = `${todayCount} avui`;
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

export function renderApp(state, today) {
  const day = getTodayRecord(state, today);
  const burn = totalBurn(state, day);
  const intake = totalIntake(state, day);
  const todayWeight = weightForDate(state.weights, today);
  const latest = latestWeightRecord(state.weights);
  const displayWeight = todayWeight || latest;
  const avg = averageWeight(state.weights, 7);
  const trend = weightTrend(state.weights);
  const decision = getCoachDecision(state, day);

  $('greetingName').textContent = state.settings.name || 'Marc';
  $('missionGoal').textContent = formatKg(state.settings.goal);
  $('missionDate').textContent = formatDateShort(state.settings.targetDate);
  $('missionDays').textContent = `${daysUntil(state.settings.targetDate) ?? '—'} dies`;
  $('weightToday').textContent = formatKg(displayWeight?.value);
  $('weightAvg').textContent = formatKg(avg);
  $('intakeToday').textContent = intake ?? 0;
  $('burnToday').textContent = burn ?? '—';
  $('burnSourceToday').textContent = burn == null ? 'sense dades' : burnSource(day) || 'estimades';
  $('weightDelta').textContent = displayWeight
    ? todayWeight ? `Avui · ${formatDateTime(todayWeight.measuredAt)}` : `Últim: ${formatDateTime(displayWeight.measuredAt)}`
    : 'Sense registres';
  $('weightTrend').textContent = trend == null ? 'Esperant dades' : trend < -0.1 ? 'Tendència positiva' : trend > 0.1 ? 'Tendència a l’alça' : 'Tendència estable';
  $('recommendation').textContent = decision.title;
  updateOrbit(state, day, decision);

  $('stepsInput').value = day.steps ?? '';
  $('intakeInput').value = day.intake ?? '';
  $('activeInput').value = day.active ?? '';
  $('totalInput').value = day.total ?? '';
  $('nameSetting').value = state.settings.name ?? '';
  $('ageSetting').value = state.settings.age ?? '';
  $('heightSetting').value = state.settings.height ?? '';
  $('sexSetting').value = state.settings.sex ?? 'male';
  $('goalSetting').value = state.settings.goal ?? '';
  $('dateSetting').value = state.settings.targetDate ?? '';

  renderWeightHistory(state);
  renderMealHistory(state, today);
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

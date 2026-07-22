import { averageWeight, daysUntil, formatDateShort, formatKg, totalBurn, weightTrend } from './calculations.js';
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

function updateOrbit(state, day, decision) {
  const burn = totalBurn(state, day);
  const deficit = burn != null && day.intake != null ? burn - day.intake : null;
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

export function renderApp(state, today) {
  const day = getTodayRecord(state, today);
  const burn = totalBurn(state, day);
  const avg = averageWeight(state.days, 7);
  const trend = weightTrend(state.days);
  const decision = getCoachDecision(state, day);

  $('greetingName').textContent = state.settings.name || 'Marc';
  $('missionGoal').textContent = formatKg(state.settings.goal);
  $('missionDate').textContent = formatDateShort(state.settings.targetDate);
  $('missionDays').textContent = `${daysUntil(state.settings.targetDate) ?? '—'} dies`;
  $('weightToday').textContent = formatKg(day.weight);
  $('weightAvg').textContent = formatKg(avg);
  $('intakeToday').textContent = day.intake ?? 0;
  $('burnToday').textContent = burn ?? '—';
  $('weightDelta').textContent = trend == null ? 'Sense tendència' : `${trend <= 0 ? '↓' : '↑'} ${Math.abs(trend).toFixed(1).replace('.', ',')} kg vs. setmana anterior`;
  $('weightTrend').textContent = trend == null ? 'Esperant dades' : trend < -0.1 ? 'Tendència positiva' : trend > 0.1 ? 'Tendència a l’alça' : 'Tendència estable';
  $('recommendation').textContent = decision.title;
  updateOrbit(state, day, decision);

  $('weightInput').value = day.weight ?? '';
  $('stepsInput').value = day.steps ?? '';
  $('intakeInput').value = day.intake ?? '';
  $('activeInput').value = day.active ?? '';
  $('nameSetting').value = state.settings.name ?? '';
  $('ageSetting').value = state.settings.age ?? '';
  $('heightSetting').value = state.settings.height ?? '';
  $('sexSetting').value = state.settings.sex ?? 'male';
  $('goalSetting').value = state.settings.goal ?? '';
  $('dateSetting').value = state.settings.targetDate ?? '';

  $('recentEntries').innerHTML = [...state.days].reverse().slice(0, 7).map(entry => `
    <div class="entry">
      <span>${formatDateShort(entry.date)}</span>
      <span>${entry.weight ? `${entry.weight.toFixed(1).replace('.', ',')} kg` : '—'} · ${entry.intake ?? '—'} / ${totalBurn(state, entry) ?? '—'} kcal</span>
    </div>`).join('') || '<p class="empty-state">Encara no hi ha registres.</p>';
}

export function renderCharts(state) {
  const days = state.days.slice(-30);
  drawChart($('weightChart'), days.map(day => day.weight));
  drawChart($('calorieChart'), days.map(day => day.intake), days.map(day => totalBurn(state, day)));
}

export function openScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === screenId));
  document.querySelectorAll('.bottom-nav__item').forEach(button => button.classList.toggle('is-active', button.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

import { createId, getDay, nowLocalDateTime, parseNumber, suggestedMealType, todayISO } from './calculations.js';
import { exportState, loadState, persistState } from './storage.js';
import { $, openScreen, renderApp, renderCharts, showToast } from './ui.js';

let state = loadState();
let diaryDate = todayISO();

function saveAndRender(message) {
  persistState(state);
  renderApp(state, { today: todayISO(), diaryDate });
  if ($('stats').classList.contains('is-active')) renderCharts(state);
  if (message) showToast(message);
}

function upsertDay(data) {
  const index = state.days.findIndex(day => day.date === data.date);
  if (index >= 0) state.days[index] = { ...state.days[index], ...data };
  else state.days.push(data);
  state.days.sort((a, b) => a.date.localeCompare(b.date));
}

function setSheetOpen(open) {
  const sheet = $('quickSheet');
  sheet.classList.toggle('is-open', open);
  sheet.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('sheet-open', open);
}

function hideSheetForms() {
  $('quickMenu').hidden = true;
  ['weightForm', 'mealForm', 'activityForm', 'energyForm'].forEach(id => { $(id).hidden = true; });
}

function resetWeightForm(dateTime = nowLocalDateTime()) {
  $('weightRecordId').value = '';
  $('weightInput').value = '';
  $('weightMeasuredAt').value = dateTime;
}

function resetMealForm(dateTime = nowLocalDateTime()) {
  $('mealRecordId').value = '';
  $('mealType').value = suggestedMealType(new Date(dateTime));
  $('mealDescription').value = '';
  $('mealCalories').value = '';
  $('mealProtein').value = '';
  $('mealLoggedAt').value = dateTime;
}

function resetActivityForm(dateTime = nowLocalDateTime()) {
  $('activityRecordId').value = '';
  $('activityType').value = 'walk';
  $('activityMinutes').value = '';
  $('activityCalories').value = '';
  $('activityStartedAt').value = dateTime;
  $('activityNote').value = '';
}

function resetEnergyForm(date = todayISO()) {
  const day = getDay(state, date);
  $('energyDate').value = date;
  $('totalInput').value = day.total ?? '';
  $('activeInput').value = day.active ?? '';
  $('stepsInput').value = day.steps ?? '';
  $('intakeInput').value = day.intake ?? '';
}

function openQuick(type = null, options = {}) {
  setSheetOpen(true);
  $('quickMenu').hidden = Boolean(type);
  ['weightForm', 'mealForm', 'activityForm', 'energyForm'].forEach(id => { $(id).hidden = true; });
  $('sheetTitle').textContent = type ? ({ weight: 'Registrar pes', meal: 'Registrar àpat', activity: 'Registrar activitat', energy: 'Completar energia' }[type]) : 'Què vols afegir?';
  if (!type) return;

  const baseDateTime = options.date ? `${options.date}T${nowLocalDateTime().slice(11)}` : nowLocalDateTime();
  if (type === 'weight') {
    resetWeightForm(baseDateTime);
    if (options.record) {
      $('weightRecordId').value = options.record.id;
      $('weightInput').value = String(options.record.value).replace('.', ',');
      $('weightMeasuredAt').value = options.record.measuredAt.slice(0, 16);
    }
  }
  if (type === 'meal') {
    resetMealForm(baseDateTime);
    if (options.record) {
      $('mealRecordId').value = options.record.id;
      $('mealType').value = options.record.type || 'other';
      $('mealDescription').value = options.record.description || '';
      $('mealCalories').value = options.record.calories ?? '';
      $('mealProtein').value = options.record.protein ?? '';
      $('mealLoggedAt').value = options.record.loggedAt.slice(0, 16);
    }
  }
  if (type === 'activity') {
    resetActivityForm(baseDateTime);
    if (options.record) {
      $('activityRecordId').value = options.record.id;
      $('activityType').value = options.record.type || 'other';
      $('activityMinutes').value = options.record.minutes ?? '';
      $('activityCalories').value = options.record.calories ?? '';
      $('activityStartedAt').value = options.record.startedAt.slice(0, 16);
      $('activityNote').value = options.record.note || '';
    }
  }
  if (type === 'energy') resetEnergyForm(options.date || diaryDate || todayISO());
  $(`${type}Form`).hidden = false;
}

function closeQuick() {
  setSheetOpen(false);
  hideSheetForms();
  $('quickMenu').hidden = false;
  $('sheetTitle').textContent = 'Què vols afegir?';
}

$('fab').addEventListener('click', () => openQuick());
document.querySelectorAll('[data-close-sheet]').forEach(element => element.addEventListener('click', closeQuick));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeQuick(); });

document.addEventListener('click', event => {
  const quick = event.target.closest('[data-quick]');
  if (quick) openQuick(quick.dataset.quick, { date: diaryDate });

  const action = event.target.closest('[data-record-action]');
  if (!action) return;
  const { recordAction, recordType, id } = action.dataset;
  const collection = recordType === 'weight' ? state.weights : recordType === 'meal' ? state.meals : state.activities;
  const record = collection.find(item => item.id === id);
  if (!record) return;

  if (recordAction === 'edit') openQuick(recordType, { record });
  if (recordAction === 'delete' && window.confirm('Vols eliminar aquest registre?')) {
    if (recordType === 'weight') state.weights = state.weights.filter(item => item.id !== id);
    if (recordType === 'meal') state.meals = state.meals.filter(item => item.id !== id);
    if (recordType === 'activity') state.activities = state.activities.filter(item => item.id !== id);
    saveAndRender('Registre eliminat');
  }
});

$('weightForm').addEventListener('submit', event => {
  event.preventDefault();
  const value = parseNumber($('weightInput').value);
  const measuredAt = $('weightMeasuredAt').value;
  const id = $('weightRecordId').value;
  if (!value || value < 30 || value > 300) return showToast('Introdueix un pes vàlid');
  if (!measuredAt) return showToast('Indica la data i l’hora');

  const existing = state.weights.find(item => item.id === id);
  const record = { id: id || createId('weight'), value, measuredAt, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.weights = id ? state.weights.map(item => item.id === id ? record : item) : [...state.weights, record];
  state.weights.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  closeQuick();
  saveAndRender(id ? 'Pes actualitzat' : 'Pes guardat');
});

$('mealForm').addEventListener('submit', event => {
  event.preventDefault();
  const id = $('mealRecordId').value;
  const description = $('mealDescription').value.trim();
  const loggedAt = $('mealLoggedAt').value;
  if (!description) return showToast('Explica què has menjat');
  if (!loggedAt) return showToast('Indica la data i l’hora');

  const existing = state.meals.find(item => item.id === id);
  const record = {
    id: id || createId('meal'),
    type: $('mealType').value,
    description,
    calories: parseNumber($('mealCalories').value),
    protein: parseNumber($('mealProtein').value),
    loggedAt,
    source: parseNumber($('mealCalories').value) == null ? 'text_pending_estimate' : 'manual_estimate',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.meals = id ? state.meals.map(item => item.id === id ? record : item) : [...state.meals, record];
  state.meals.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  closeQuick();
  saveAndRender(id ? 'Àpat actualitzat' : 'Àpat guardat');
});

$('activityForm').addEventListener('submit', event => {
  event.preventDefault();
  const id = $('activityRecordId').value;
  const startedAt = $('activityStartedAt').value;
  const minutes = parseNumber($('activityMinutes').value);
  if (!startedAt) return showToast('Indica la data i l’hora');
  if (!minutes || minutes <= 0 || minutes > 600) return showToast('Indica una durada vàlida');

  const existing = state.activities.find(item => item.id === id);
  const record = {
    id: id || createId('activity'),
    type: $('activityType').value,
    minutes,
    calories: parseNumber($('activityCalories').value),
    startedAt,
    note: $('activityNote').value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.activities = id ? state.activities.map(item => item.id === id ? record : item) : [...state.activities, record];
  state.activities.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  closeQuick();
  saveAndRender(id ? 'Activitat actualitzada' : 'Activitat guardada');
});

$('energyForm').addEventListener('submit', event => {
  event.preventDefault();
  const date = $('energyDate').value || todayISO();
  upsertDay({
    date,
    total: parseNumber($('totalInput').value),
    active: parseNumber($('activeInput').value),
    steps: parseNumber($('stepsInput').value),
    intake: parseNumber($('intakeInput').value)
  });
  diaryDate = date;
  closeQuick();
  saveAndRender('Energia guardada');
});

$('diaryDate').addEventListener('change', event => {
  diaryDate = event.target.value || todayISO();
  renderApp(state, { today: todayISO(), diaryDate });
});

$('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  state.settings = {
    ...state.settings,
    name: $('nameSetting').value.trim() || 'Marc',
    age: parseNumber($('ageSetting').value),
    height: parseNumber($('heightSetting').value),
    sex: $('sexSetting').value,
    startWeight: parseNumber($('startWeightSetting').value),
    goal: parseNumber($('goalSetting').value),
    targetDate: $('dateSetting').value,
    weeklyGoal: parseNumber($('weeklyGoalSetting').value)
  };
  saveAndRender('Perfil actualitzat');
});

$('exportData').addEventListener('click', () => exportState(state));

document.querySelectorAll('[data-screen]').forEach(button => {
  button.addEventListener('click', () => {
    openScreen(button.dataset.screen);
    if (button.dataset.screen === 'stats') requestAnimationFrame(() => renderCharts(state));
  });
});

document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => openScreen(button.dataset.go)));
window.addEventListener('resize', () => { if ($('stats').classList.contains('is-active')) renderCharts(state); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});

resetWeightForm();
resetMealForm();
resetActivityForm();
resetEnergyForm();
renderApp(state, { today: todayISO(), diaryDate });
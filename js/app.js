import { createId, nowLocalDateTime, parseNumber, todayISO } from './calculations.js';
import { exportState, storageService } from './storage.js';
import { $, openScreen, renderApp, renderCharts, showToast } from './ui.js';
import { WeightRepository } from './weight-repository.js';
import { SupabaseWeightRepository } from './supabase-weight-repository.js';
import { authService } from './auth-service.js';
import {
  createAuthUi,
  hasAuthCallback
} from './auth-ui.js';

let state = await storageService.loadState();

const localWeightRepository = new WeightRepository({
  storageService
});
const remoteWeightRepository = new SupabaseWeightRepository({
  clientFactory: () => authService.getClient()
});

await localWeightRepository.initialize(state);

let localWeights = state.weights;
let weightRepository = localWeightRepository;
let activeWeightUserId = null;

async function handleSessionChange(session) {
  const userId = session?.user?.id || null;
  if (userId === activeWeightUserId) return;

  if (!userId) {
    activeWeightUserId = null;
    weightRepository = localWeightRepository;
    state.weights = localWeights;
    resetWeightForm();
    renderState();
    return;
  }

  await remoteWeightRepository.initialize(state, { userId });
  activeWeightUserId = userId;
  weightRepository = remoteWeightRepository;
  resetWeightForm();
  renderState();
}

const authUi = createAuthUi({
  notify: showToast,
  onSessionChange: handleSessionChange
});

function renderState(message) {
  renderApp(state, todayISO());
  if ($('stats').classList.contains('is-active')) renderCharts(state);
  if (message) showToast(message);
}

async function saveAndRender(message) {
  const stateToPersist = activeWeightUserId
    ? { ...state, weights: localWeights }
    : state;

  await storageService.persistState(stateToPersist);
  renderState(message);
}

function upsertDay(data) {
  const index = state.days.findIndex(day => day.date === data.date);
  if (index >= 0) state.days[index] = { ...state.days[index], ...data };
  else state.days.push(data);
  state.days.sort((a, b) => a.date.localeCompare(b.date));
}

function resetWeightForm() {
  $('weightRecordId').value = '';
  $('weightInput').value = '';
  $('weightMeasuredAt').value = nowLocalDateTime();
  $('weightSubmitLabel').textContent = 'Guardar pes';
  $('cancelWeightEdit').hidden = true;
}

function resetMealForm() {
  $('mealDescription').value = '';
  $('mealCalories').value = '';
  $('mealLoggedAt').value = nowLocalDateTime();
}

$('dayForm').addEventListener('submit', async event => {
  event.preventDefault();
  upsertDay({
    date: todayISO(),
    steps: parseNumber($('stepsInput').value),
    intake: parseNumber($('intakeInput').value),
    active: parseNumber($('activeInput').value),
    total: parseNumber($('totalInput').value)
  });
  await saveAndRender('Energia i activitat guardades');
  openScreen('home');
});

$('weightForm').addEventListener('submit', async event => {
  event.preventDefault();
  const value = parseNumber($('weightInput').value);
  const measuredAt = $('weightMeasuredAt').value;
  const recordId = $('weightRecordId').value;

  if (!value || value < 30 || value > 300) {
    showToast('Introdueix un pes vàlid');
    return;
  }
  if (!measuredAt) {
    showToast('Indica la data i l’hora');
    return;
  }

  try {
    await weightRepository.save(state, {
      id: recordId || null,
      value,
      measuredAt
    });

    if (!activeWeightUserId) localWeights = state.weights;
    resetWeightForm();
    renderState(recordId ? 'Pes actualitzat' : 'Pes guardat');
  } catch (error) {
    console.error('Weight save failed', error);
    showToast(error.message || 'No s’ha pogut guardar el pes');
  }
});

$('cancelWeightEdit').addEventListener('click', resetWeightForm);

$('weightHistory').addEventListener('click', async event => {
  const button = event.target.closest('[data-weight-action]');
  if (!button) return;
  const record = weightRepository.findById(
    state,
    button.dataset.id
  );
  if (!record) return;

  if (button.dataset.weightAction === 'edit') {
    $('weightRecordId').value = record.id;
    $('weightInput').value = String(record.value).replace('.', ',');
    $('weightMeasuredAt').value = record.measuredAt.slice(0, 16);
    $('weightSubmitLabel').textContent = 'Actualitzar pes';
    $('cancelWeightEdit').hidden = false;
    $('weightForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (button.dataset.weightAction === 'delete' && window.confirm('Vols eliminar aquest registre de pes?')) {
    try {
      await weightRepository.softDelete(state, record.id);
      if (!activeWeightUserId) localWeights = state.weights;
      if ($('weightRecordId').value === record.id) resetWeightForm();
      renderState('Pes eliminat');
    } catch (error) {
      console.error('Weight delete failed', error);
      showToast(error.message || 'No s’ha pogut eliminar el pes');
    }
  }
});

$('mealForm').addEventListener('submit', async event => {
  event.preventDefault();
  const description = $('mealDescription').value.trim();
  const loggedAt = $('mealLoggedAt').value;
  const calories = parseNumber($('mealCalories').value);

  if (!description) {
    showToast('Explica què has menjat');
    return;
  }
  if (!loggedAt) {
    showToast('Indica la data i l’hora');
    return;
  }

  state.meals.push({
    id: createId('meal'),
    description,
    calories,
    loggedAt,
    createdAt: new Date().toISOString(),
    source: calories == null ? 'text_pending_estimate' : 'manual_estimate'
  });
  state.meals.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  resetMealForm();
  await saveAndRender('Àpat guardat');
});

$('mealHistory').addEventListener('click', async event => {
  const button = event.target.closest('[data-meal-action="delete"]');
  if (!button) return;
  if (window.confirm('Vols eliminar aquest àpat?')) {
    state.meals = state.meals.filter(meal => meal.id !== button.dataset.id);
    await saveAndRender('Àpat eliminat');
  }
});

$('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  state.settings = {
    name: $('nameSetting').value.trim() || 'Marc',
    age: parseNumber($('ageSetting').value),
    height: parseNumber($('heightSetting').value),
    sex: $('sexSetting').value,
    goal: parseNumber($('goalSetting').value),
    targetDate: $('dateSetting').value
  };
  await saveAndRender('Configuració actualitzada');
});

$('exportData').addEventListener('click', () => exportState(state));

$('importData').addEventListener('click', () => {
  $('importDataFile').click();
});

$('importDataFile').addEventListener('change', async event => {
  const [file] = event.target.files;
  if (!file) return;

  const confirmed = window.confirm(
    'Aquesta acció substituirà les dades actuals per les de la còpia seleccionada. Vols continuar?'
  );

  if (!confirmed) {
    event.target.value = '';
    return;
  }

  try {
    const importedState = await storageService.importState(
      await file.text()
    );

    state = importedState;
    renderApp(state, todayISO());

    if ($('stats').classList.contains('is-active')) {
      renderCharts(state);
    }

    showToast('Còpia restaurada correctament');
  } catch (error) {
    console.error('Data import failed', error);
    showToast(error.message || 'No s’ha pogut importar la còpia');
  } finally {
    event.target.value = '';
  }
});

document.querySelectorAll('[data-screen]').forEach(button => {
  button.addEventListener('click', () => {
    openScreen(button.dataset.screen);

    if (button.dataset.screen === 'settings') {
      authUi.initialize().catch(() => {});
    }

    if (button.dataset.screen === 'stats') {
      window.requestAnimationFrame(() => renderCharts(state));
    }
  });
});

document.querySelectorAll('[data-go]').forEach(button => {
  button.addEventListener('click', () => openScreen(button.dataset.go));
});

window.addEventListener('resize', () => {
  if ($('stats').classList.contains('is-active')) renderCharts(state);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

resetWeightForm();
resetMealForm();
renderApp(state, todayISO());

authUi.initialize().catch(() => {});

if (hasAuthCallback()) {
  openScreen('settings');
  authUi.initialize().catch(() => {});
}

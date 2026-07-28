import { createId, nowLocalDateTime, parseNumber, todayISO } from './calculations.js';
import { exportState, storageService } from './storage.js';
import { $, openScreen, renderApp, renderCharts, showToast } from './ui.js';
import { WeightRepository } from './weight-repository.js';
import {
  createAuthUi,
  hasAuthCallback
} from './auth-ui.js';

let state = await storageService.loadState();

const weightRepository = new WeightRepository({
  storageService
});

await weightRepository.initialize(state);

const authUi = createAuthUi({
  notify: showToast
});

function renderState(message) {
  renderApp(state, todayISO());
  if ($('stats').classList.contains('is-active')) renderCharts(state);
  if (message) showToast(message);
}

async function saveAndRender(message) {
  await storageService.persistState(state);
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

  await weightRepository.save(state, {
    id: recordId || null,
    value,
    measuredAt
  });

  resetWeightForm();
  renderState(recordId ? 'Pes actualitzat' : 'Pes guardat');
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
    await weightRepository.softDelete(state, record.id);
    if ($('weightRecordId').value === record.id) resetWeightForm();
    renderState('Pes eliminat');
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

if (hasAuthCallback()) {
  openScreen('settings');
  authUi.initialize().catch(() => {});
}

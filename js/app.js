import { nowLocalDateTime, parseNumber, todayISO } from './calculations.js';
import { exportState, storageService } from './storage.js';
import { $, openScreen, renderApp, renderCharts, showToast } from './ui.js';
import { WeightRepository } from './weight-repository.js';
import { SupabaseWeightRepository } from './supabase-weight-repository.js';
import { SupabaseDailySummaryRepository } from './supabase-daily-summary-repository.js';
import { SupabaseHealthMetricsRepository } from './supabase-health-metrics-repository.js';
import { SupabaseProfileRepository } from './supabase-profile-repository.js';
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
const remoteDailySummaryRepository = new SupabaseDailySummaryRepository({
  clientFactory: () => authService.getClient()
});
const remoteHealthMetricsRepository = new SupabaseHealthMetricsRepository({
  clientFactory: () => authService.getClient()
});
const remoteProfileRepository = new SupabaseProfileRepository({
  clientFactory: () => authService.getClient()
});

await localWeightRepository.initialize(state);

let localWeights = state.weights;
let localDays = state.days;
let weightRepository = remoteWeightRepository;
let activeUserId = null;

function setAccountFormsEnabled(enabled) {
  [$('weightForm'), $('dayForm'), $('settingsForm')].forEach(form => {
    form.querySelectorAll('input, button').forEach(control => {
      control.disabled = !enabled;
    });
  });
}

async function handleSessionChange(session) {
  const userId = session?.user?.id || null;
  if (userId === activeUserId) return;

  setAccountFormsEnabled(false);

  if (!userId) {
    activeUserId = null;
    state.profile = null;
    state.weights = [];
    state.days = [];
    state.healthMetrics = [];
    resetWeightForm();
    renderState();
    return;
  }

  activeUserId = userId;
  weightRepository = remoteWeightRepository;

  try {
    const remoteState = {
      ...state,
      profile: null,
      weights: [],
      days: [],
      healthMetrics: []
    };

    await Promise.all([
      remoteProfileRepository.initialize(remoteState, { userId }),
      remoteWeightRepository.initialize(remoteState, { userId }),
      remoteDailySummaryRepository.initialize(remoteState, { userId }),
      remoteHealthMetricsRepository.initialize(remoteState, { userId })
    ]);

    state.profile = remoteState.profile;

    if (!state.profile) {
      state.profile = await remoteProfileRepository.save(remoteState, {
        displayName: state.settings.name || null,
        birthDate: null,
        heightCm: state.settings.height ?? null,
        metabolicSex: state.settings.sex || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
      });
    }

    state.weights = remoteState.weights;
    state.days = remoteState.days;
    state.healthMetrics = remoteState.healthMetrics;
    setAccountFormsEnabled(true);
  } catch (error) {
    state.profile = null;
    state.weights = [];
    state.days = [];
    resetWeightForm();
    renderState();
    throw error;
  }

  resetWeightForm();
  renderState();
}

setAccountFormsEnabled(false);

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
  const stateToPersist = activeUserId
    ? { ...state, weights: localWeights, days: localDays }
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

$('dayForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!activeUserId) {
    showToast('Inicia sessió per guardar les dades');
    return;
  }

  const data = {
    date: todayISO(),
    steps: parseNumber($('stepsInput').value),
    intake: parseNumber($('intakeInput').value),
    active: parseNumber($('activeInput').value),
    total: parseNumber($('totalInput').value)
  };

  try {
    await remoteDailySummaryRepository.save(state, data);
    renderState('Energia i activitat guardades');
    openScreen('home');
  } catch (error) {
    console.error('Daily summary save failed', error);
    showToast(error.message || 'No s’ha pogut guardar el resum diari');
  }
});

$('weightForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!activeUserId) {
    showToast('Inicia sessió per guardar les dades');
    return;
  }

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
  if (!button || !activeUserId) return;
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
      if ($('weightRecordId').value === record.id) resetWeightForm();
      renderState('Pes eliminat');
    } catch (error) {
      console.error('Weight delete failed', error);
      showToast(error.message || 'No s’ha pogut eliminar el pes');
    }
  }
});

$('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!activeUserId) {
    showToast('Inicia sessió per guardar el perfil');
    return;
  }

  const displayName = $('nameSetting').value.trim();
  const birthDate = $('birthDateSetting').value || null;
  const heightCm = parseNumber($('heightSetting').value);
  const metabolicSex = $('sexSetting').value || null;

  if (heightCm != null && (heightCm < 100 || heightCm > 250)) {
    showToast('Introdueix una altura vàlida');
    return;
  }

  if (birthDate && birthDate > todayISO()) {
    showToast('La data de naixement no pot ser futura');
    return;
  }

  try {
    await remoteProfileRepository.save(state, {
      displayName: displayName || null,
      birthDate,
      heightCm,
      metabolicSex,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        state.profile?.timezone ||
        'Europe/Madrid'
    });

    // Temporalment els objectius antics continuen aquí fins al bloc Goals.
    state.settings = {
      ...state.settings,
      goal: parseNumber($('goalSetting').value),
      targetDate: $('dateSetting').value
    };

    await saveAndRender('Perfil actualitzat');
  } catch (error) {
    console.error('Profile save failed', error);
    showToast(error.message || 'No s’ha pogut guardar el perfil');
  }
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
renderApp(state, todayISO());

authUi.initialize().catch(() => {});

if (hasAuthCallback()) {
  openScreen('settings');
  authUi.initialize().catch(() => {});
}

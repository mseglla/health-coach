import { parseNumber, todayISO } from './calculations.js';
import { exportState, loadState, persistState } from './storage.js';
import { $, openScreen, renderApp, renderCharts, showToast } from './ui.js';

let state = loadState();

function saveAndRender(message) {
  persistState(state);
  renderApp(state, todayISO());
  if (message) showToast(message);
}

function upsertDay(data) {
  const index = state.days.findIndex(day => day.date === data.date);
  if (index >= 0) state.days[index] = { ...state.days[index], ...data };
  else state.days.push(data);
  state.days.sort((a, b) => a.date.localeCompare(b.date));
}

$('dayForm').addEventListener('submit', event => {
  event.preventDefault();
  upsertDay({
    date: todayISO(),
    weight: parseNumber($('weightInput').value),
    steps: parseNumber($('stepsInput').value),
    intake: parseNumber($('intakeInput').value),
    active: parseNumber($('activeInput').value)
  });
  saveAndRender('Dia guardat correctament');
  openScreen('home');
});

$('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  state.settings = {
    name: $('nameSetting').value.trim() || 'Marc',
    age: parseNumber($('ageSetting').value),
    height: parseNumber($('heightSetting').value),
    sex: $('sexSetting').value,
    goal: parseNumber($('goalSetting').value),
    targetDate: $('dateSetting').value
  };
  saveAndRender('Configuració actualitzada');
});

$('exportData').addEventListener('click', () => exportState(state));

document.querySelectorAll('[data-screen]').forEach(button => {
  button.addEventListener('click', () => {
    openScreen(button.dataset.screen);
    if (button.dataset.screen === 'stats') window.requestAnimationFrame(() => renderCharts(state));
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

renderApp(state, todayISO());

import { STORAGE_KEY, LEGACY_KEY, createDefaultState } from './state.js';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) return current;

  const legacy = safeParse(localStorage.getItem(LEGACY_KEY));
  if (legacy) {
    const migrated = { version: 2, settings: legacy.settings, days: legacy.days || [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  return createDefaultState();
}

export function persistState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `health-coach-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

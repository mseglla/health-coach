import { STORAGE_KEY, LEGACY_KEYS, createDefaultState } from './state.js';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function migratedWeightId(date, index) {
  return `weight-migrated-${date}-${index}`;
}

function normalizeState(raw) {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== 'object') return fallback;

  const days = Array.isArray(raw.days) ? raw.days.map(day => ({ ...day })) : [];
  const existingWeights = Array.isArray(raw.weights) ? raw.weights : [];
  const migratedWeights = existingWeights.length
    ? existingWeights
    : days
        .filter(day => Number.isFinite(Number(day.weight)))
        .map((day, index) => ({
          id: migratedWeightId(day.date, index),
          value: Number(day.weight),
          measuredAt: `${day.date}T08:00`,
          createdAt: new Date().toISOString()
        }));

  return {
    version: 3,
    settings: { ...fallback.settings, ...(raw.settings || {}) },
    days: days.map(({ weight, ...day }) => day),
    weights: migratedWeights
      .filter(item => item && Number.isFinite(Number(item.value)) && item.measuredAt)
      .map(item => ({
        id: item.id || crypto.randomUUID(),
        value: Number(item.value),
        measuredAt: item.measuredAt,
        createdAt: item.createdAt || new Date().toISOString()
      }))
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    meals: Array.isArray(raw.meals) ? raw.meals : []
  };
}

export function loadState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) return normalizeState(current);

  for (const key of LEGACY_KEYS) {
    const legacy = safeParse(localStorage.getItem(key));
    if (legacy) {
      const migrated = normalizeState(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
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

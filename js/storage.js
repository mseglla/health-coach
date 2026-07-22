import { STORAGE_KEY, LEGACY_KEYS, createDefaultState } from './state.js';

const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const asArray = value => Array.isArray(value) ? value : [];

function normalize(raw) {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== 'object') return fallback;
  const days = asArray(raw.days).map(({ weight, ...day }) => ({ ...day }));
  const migratedWeights = asArray(raw.weights).length ? raw.weights : asArray(raw.days)
    .filter(day => Number.isFinite(Number(day.weight)))
    .map((day, index) => ({ id: `weight-migrated-${day.date}-${index}`, value: Number(day.weight), measuredAt: `${day.date}T08:00`, createdAt: new Date().toISOString() }));
  return {
    version: 4,
    settings: { ...fallback.settings, ...(raw.settings || {}) },
    days,
    weights: migratedWeights.filter(x => x?.measuredAt && Number.isFinite(Number(x.value))).map(x => ({ ...x, value: Number(x.value) })),
    meals: asArray(raw.meals).map(x => ({ type: 'other', protein: null, ...x })),
    activities: asArray(raw.activities),
    checkins: asArray(raw.checkins)
  };
}

export function loadState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) return normalize(current);
  for (const key of LEGACY_KEYS) {
    const legacy = safeParse(localStorage.getItem(key));
    if (legacy) {
      const migrated = normalize(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return createDefaultState();
}
export const persistState = state => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `atles-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
export function resetState() { localStorage.removeItem(STORAGE_KEY); }

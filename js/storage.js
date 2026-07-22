import { STORAGE_KEY, LEGACY_KEYS, createDefaultState } from './state.js';

const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const asArray = value => Array.isArray(value) ? value : [];

export function normalizeState(raw) {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== 'object') throw new Error('El fitxer no conté dades vàlides.');
  const days = asArray(raw.days).map(({ weight, ...day }) => ({ ...day }));
  const migratedWeights = asArray(raw.weights).length ? raw.weights : asArray(raw.days)
    .filter(day => Number.isFinite(Number(day.weight)))
    .map((day, index) => ({ id: `weight-migrated-${day.date}-${index}`, value: Number(day.weight), measuredAt: `${day.date}T08:00`, createdAt: new Date().toISOString() }));
  const normalized = {
    version: 4,
    settings: { ...fallback.settings, ...(raw.settings || {}) },
    days,
    weights: migratedWeights.filter(x => x?.measuredAt && Number.isFinite(Number(x.value))).map(x => ({ ...x, value: Number(x.value) })),
    meals: asArray(raw.meals).map(x => ({ type: 'other', protein: null, ...x })),
    activities: asArray(raw.activities),
    checkins: asArray(raw.checkins)
  };
  if (!normalized.settings || !Array.isArray(normalized.days) || !Array.isArray(normalized.weights) || !Array.isArray(normalized.meals) || !Array.isArray(normalized.activities)) {
    throw new Error('La còpia no té l’estructura esperada.');
  }
  return normalized;
}

export function loadState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) {
    try { return normalizeState(current); } catch { return createDefaultState(); }
  }
  for (const key of LEGACY_KEYS) {
    const legacy = safeParse(localStorage.getItem(key));
    if (legacy) {
      try {
        const migrated = normalizeState(legacy);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch { /* continua amb la següent còpia */ }
    }
  }
  return createDefaultState();
}

export const persistState = state => localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
export function exportState(state) {
  const payload = { ...normalizeState(state), exportedAt: new Date().toISOString(), app: 'ATLES' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `atles-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
export async function importStateFile(file) {
  if (!file || file.size > 5_000_000) throw new Error('El fitxer és buit o massa gran.');
  const parsed = safeParse(await file.text());
  if (!parsed) throw new Error('No és un fitxer JSON vàlid.');
  const normalized = normalizeState(parsed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
export function resetState() { localStorage.removeItem(STORAGE_KEY); }

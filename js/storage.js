import { IndexedDBAdapter } from './indexeddb-adapter.js';
import { MigratingStorageAdapter } from './migrating-storage-adapter.js';
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
    profile: null,
    goals: [],
    bodyMeasurements: [],
    healthMetrics: [],
    activities: [],
    checkins: [],
    checkinPromptDismissed: false,
    days: days.map(({ weight, ...day }) => day),
    weights: migratedWeights
      .filter(item => item && Number.isFinite(Number(item.value)) && item.measuredAt)
      .map(item => {
        const createdAt =
          item.createdAt || new Date().toISOString();

        return {
          id: item.id || crypto.randomUUID(),
          value: Number(item.value),
          measuredAt: item.measuredAt,
          source: item.source || 'manual',
          createdAt,
          updatedAt: item.updatedAt || createdAt,
          deletedAt: item.deletedAt || null
        };
      })
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseImportedState(serializedState) {
  let raw;

  try {
    raw = JSON.parse(serializedState);
  } catch {
    throw new Error('El fitxer no conté un JSON vàlid');
  }

  if (!isObject(raw)) {
    throw new Error('La còpia no conté un estat ATLES vàlid');
  }

  if (raw.version !== 3) {
    throw new Error('La còpia no és compatible amb la versió actual d’ATLES');
  }

  if (!isObject(raw.settings)) {
    throw new Error('La còpia no conté una configuració vàlida');
  }

  for (const key of ['days', 'weights']) {
    if (!Array.isArray(raw[key])) {
      throw new Error(`La còpia no conté una llista vàlida de ${key}`);
    }
  }

  const invalidDay = raw.days.some(day => (
    !isObject(day) ||
    typeof day.date !== 'string' ||
    !day.date
  ));

  if (invalidDay) {
    throw new Error('La còpia conté registres diaris invàlids');
  }

  const invalidWeight = raw.weights.some(weight => (
    !isObject(weight) ||
    typeof weight.id !== 'string' ||
    !weight.id ||
    !Number.isFinite(Number(weight.value)) ||
    Number(weight.value) <= 0 ||
    typeof weight.measuredAt !== 'string' ||
    !weight.measuredAt
  ));

  if (invalidWeight) {
    throw new Error('La còpia conté registres de pes invàlids');
  }

  return normalizeState(raw);
}

export class LocalStorageAdapter {
  async getItem(key) {
    return localStorage.getItem(key);
  }

  async setItem(key, value) {
    localStorage.setItem(key, value);
  }
}

export class StorageService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async loadState() {
    const current = safeParse(await this.adapter.getItem(STORAGE_KEY));
    if (current) return normalizeState(current);

    for (const key of LEGACY_KEYS) {
      const legacy = safeParse(await this.adapter.getItem(key));
      if (legacy) {
        const migrated = normalizeState(legacy);
        await this.adapter.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }

    return createDefaultState();
  }

  async persistState(state) {
    await this.adapter.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async importState(serializedState) {
    const importedState = parseImportedState(serializedState);
    await this.persistState(importedState);
    return importedState;
  }
}

export function createDefaultStorageAdapter() {
  const fallback = new LocalStorageAdapter();

  try {
    return new MigratingStorageAdapter({
      primary: new IndexedDBAdapter(),
      fallback
    });
  } catch (error) {
    if (typeof window !== 'undefined') {
      console.error(
        'IndexedDB unavailable; ATLES will continue with localStorage',
        error
      );
    }
    return fallback;
  }
}

export const storageAdapter = createDefaultStorageAdapter();

export const storageService = new StorageService(
  storageAdapter
);

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `health-coach-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

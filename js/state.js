export const STORAGE_KEY = 'healthCoachV3';
export const LEGACY_KEYS = ['healthCoachV2', 'healthCoachMvpV1'];

const defaultState = {
  version: 3,
  settings: {
    name: 'Marc',
    age: 35,
    height: 176.5,
    sex: 'male',
    goal: 85,
    targetDate: '2026-11-30'
  },
  days: [],
  weights: []
};

export function createDefaultState() {
  return structuredClone(defaultState);
}

export const STORAGE_KEY = 'healthCoachV2';
export const LEGACY_KEY = 'healthCoachMvpV1';

const defaultState = {
  version: 2,
  settings: {
    name: 'Marc',
    age: 35,
    height: 176.5,
    sex: 'male',
    goal: 85,
    targetDate: '2026-11-30'
  },
  days: []
};

export function createDefaultState() {
  return structuredClone(defaultState);
}

export const STORAGE_KEY = 'healthCoachV3';
export const LEGACY_KEYS = ['healthCoachV2', 'healthCoachMvpV1'];

const defaultState = {
  version: 3,
  settings: {
    name: '',
    age: null,
    height: null,
    sex: null,
    goal: null,
    targetDate: ''
  },
  profile: null,
  days: [],
  weights: [],
  healthMetrics: [],
  activities: []
};

export function createDefaultState() {
  return structuredClone(defaultState);
}

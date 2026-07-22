export const STORAGE_KEY = 'healthCoachV4';
export const LEGACY_KEYS = ['healthCoachV3', 'healthCoachV2', 'healthCoachMvpV1'];

const defaultState = {
  version: 4,
  settings: {
    name: 'Marc', age: 35, height: 176.5, sex: 'male', goal: 85,
    targetDate: '2026-11-30', startWeight: 89, weeklyGoal: 0.5,
    activityLevel: 'moderate', reminders: false
  },
  days: [], weights: [], meals: [], activities: [], checkins: []
};

export function createDefaultState() { return structuredClone(defaultState); }

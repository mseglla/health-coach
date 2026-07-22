import assert from 'node:assert/strict';
import {
  adherenceScore,
  averageDeficit,
  averageWeight,
  getDay,
  mealCaloriesForDate,
  suggestedMealType,
  totalBurn,
  totalIntake,
  weightTrend
} from '../js/calculations.js';
import { getCoachDecision } from '../js/coach.js';

const state = {
  settings: { age: 35, height: 176.5, sex: 'male', startWeight: 89, goal: 85 },
  days: [
    { date: '2026-07-21', total: 2600, intake: 2100, active: 700, steps: 9000 },
    { date: '2026-07-22', total: 2953, active: 983, steps: 11000 }
  ],
  weights: [
    { id: 'w1', value: 89.2, measuredAt: '2026-07-21T08:00' },
    { id: 'w2', value: 88.9, measuredAt: '2026-07-22T08:00' }
  ],
  meals: [
    { id: 'm1', type: 'lunch', description: 'Dinar', calories: 800, loggedAt: '2026-07-22T14:00' },
    { id: 'm2', type: 'dinner', description: 'Sopar', calories: 900, loggedAt: '2026-07-22T21:00' }
  ],
  activities: [
    { id: 'a1', type: 'padel', minutes: 60, calories: 500, startedAt: '2026-07-22T19:00' }
  ]
};

assert.equal(getDay(state, '2026-07-22').total, 2953);
assert.equal(totalBurn(state, getDay(state, '2026-07-22')), 2953, 'Apple Watch total must take priority');
assert.equal(mealCaloriesForDate(state, '2026-07-22'), 1700);
assert.equal(totalIntake(state, getDay(state, '2026-07-22')), 1700, 'Meal sum must be used without manual intake');
assert.equal(adherenceScore(state, '2026-07-22'), 100);
assert.equal(averageDeficit(state, 7), 852);
assert.equal(Number(averageWeight(state.weights, 2).toFixed(2)), 89.05);
assert.equal(Number(weightTrend(state.weights)), 0, 'With fewer than two full windows trend is neutral');
assert.equal(suggestedMealType(new Date('2026-07-22T08:00:00')), 'breakfast');
assert.equal(suggestedMealType(new Date('2026-07-22T14:00:00')), 'lunch');
assert.equal(suggestedMealType(new Date('2026-07-22T21:00:00')), 'dinner');

const decision = getCoachDecision(state, getDay(state, '2026-07-22'));
assert.equal(decision.label, 'DÈFICIT ALT');

console.log('Logic tests passed.');

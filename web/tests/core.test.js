import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, workouts, meals, toggleMeal, macroTotals, shoppingList, distance, resample, routeLength, SegmentMatcher, sampleRoute, escapeHTML, todayKey } from '../src/core.js';
const profile = { name: 'Alex', age: 25, weight: 75, target: 75, budget: 700, currency: 'SEK', level: 'Beginner', equipment: [], gym: false, restrictions: [], protein: 120, carbs: 250, fat: 70, targetDate: '2099-12-31' };

test('profile rejects missing names, invalid goals and nonfinite values', () => {
  assert.equal(validateProfile(profile).name, 'Alex');
  for (const changed of [{ name: ' ' }, { age: 15 }, { weight: NaN }, { target: 500 }, { budget: -1 }, { currency: 'BAD' }, { targetDate: '2000-01-01' }]) assert.throws(() => validateProfile({ ...profile, ...changed }));
});
test('bodyweight plan does not ask for equipment', () => {
  const names = workouts(profile).map(item => item.name);
  assert.ok(names.includes('Bodyweight squat'));
  assert.ok(names.includes('Glute bridge'));
  assert.ok(!names.some(name => /Dumbbell|Kettlebell|Cable|press|deadlift/.test(name)));
});
test('kettlebell plan does not prescribe a dumbbell squat', () => {
  assert.ok(workouts({ ...profile, equipment: ['kettlebell'] }).some(item => item.name === 'Kettlebell squat'));
});
test('experience and completed sessions change sets and progression', () => {
  assert.equal(workouts(profile)[1].sets, 2);
  assert.equal(workouts({ ...profile, level: 'Advanced' }, 5)[1].sets, 4);
  assert.match(workouts(profile, 4)[1].note, /Add 1–2 reps/);
});
test('vegan meals exclude dairy and chicken', () => {
  const names = meals({ ...profile, restrictions: ['Vegan'] }).flatMap(meal => meal.ingredients.map(i => i.name));
  assert.ok(names.includes('Firm tofu')); assert.ok(names.includes('Soy yogurt'));
  assert.ok(!names.includes('Chicken breast')); assert.ok(!names.includes('Skyr'));
});
test('meal undo uses the originally logged nutrition after diet changes', () => {
  const log = { meals: {} };
  const regular = meals(profile)[0], vegan = meals({ ...profile, restrictions: ['Vegan'] })[0];
  toggleMeal(log, regular); assert.equal(macroTotals(log).protein, regular.protein);
  toggleMeal(log, vegan); assert.deepEqual(macroTotals(log), { protein: 0, carbs: 0, fat: 0 });
});
test('weekly shopping aggregates identical ingredients', () => {
  const list = shoppingList([{ ingredients: [{ name: 'Rice', aisle: 'Pantry', quantity: 100, unit: 'g' }, { name: 'Rice', aisle: 'Pantry', quantity: 50, unit: 'g' }] }]);
  assert.equal(list.length, 1); assert.equal(list[0].quantity, 1050);
});
test('geodesic distance and resampled lengths agree', () => {
  const points = [{ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 }];
  assert.ok(Math.abs(distance(...points) - 111.195) < 0.1);
  assert.ok(Math.abs(routeLength(resample(points)) - routeLength(points)) < 0.1);
});
test('jumping to the finish cannot complete a segment', () => {
  const points = [{ lat: 0, lon: 0 }, { lat: 0.002, lon: 0 }];
  const matcher = new SegmentMatcher(points);
  assert.equal(matcher.update({ ...points[0], accuracy: 5, time: 1000 }).type, 'start');
  assert.equal(matcher.update({ ...points[1], accuracy: 5, time: 2000 }), null);
  assert.equal(matcher.finished, false);
  resample(points).forEach((p, i) => matcher.update({ ...p, accuracy: 5, time: 3000 + i * 1000 }));
  assert.equal(matcher.finished, true);
});
test('standing at a loop start and poor GPS cannot produce an attempt', () => {
  const route = sampleRoute(); const matcher = new SegmentMatcher(route.points);
  assert.equal(matcher.update({ ...route.points[0], accuracy: 100, time: 1000 }), null);
  for (let i = 1; i < 100; i++) matcher.update({ ...route.points[0], accuracy: 5, time: i * 1000 });
  assert.equal(matcher.finished, false); assert.ok(matcher.progress < 0.2);
});
test('user-supplied display text is escaped', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('day keys use the local calendar', () => {
  assert.equal(todayKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
});

import { defaultGoal, createRunningPlan, vdot, paceZones, validateRecovery, readiness } from '../src/running-coach.js';
import { loadState } from '../src/storage.js';
import { emptyState } from '../src/core.js';
test('running coach uses benchmark VDOT, not target time, and includes recovery/taper', () => {
  assert.ok(Math.abs(vdot(5000, 1200) - 49.8) < .2);
  const a = createRunningPlan(defaultGoal());
  const b = createRunningPlan({ ...defaultGoal(), targetMinutes: 20 });
  assert.equal(a.vdot, b.vdot); assert.deepEqual(a.weeks, b.weeks);
  assert.equal(a.weeks[3].phase, 'Recovery'); assert.equal(a.weeks.at(-1).phase, 'Taper');
  assert.ok(paceZones(a.vdot)[0].fast > paceZones(a.vdot)[3].fast);
});
test('running coach rejects invalid dates and insufficient marathon base', () => {
  for (const change of [{ weeks: 2 }, { targetMinutes: NaN }, { benchmarkDate: '2099-01-01' }, { raceDistance: 42195, targetMinutes: 240 }]) assert.throws(() => createRunningPlan({ ...defaultGoal(), ...change }));
  assert.equal(createRunningPlan({ ...defaultGoal(), raceDistance: 42195, targetMinutes: 240, days: 4, weeks: 20, weeklyKm: 30 }).weeks.length, 20);
});
test('readiness needs seven distinct prior days of same-source data', () => {
  const now = new Date(2026, 10, 3, 12);
  const entry = { day: '2026-11-03', hrv: 30, sleep: 5, source: 'Watch', metric: 'SDNN' };
  assert.equal(readiness([entry], now), null);
  const baseline = Array.from({length: 7}, (_,i) => ({ ...entry, day: todayKey(new Date(2026, 10, 2-i)), hrv: 50 }));
  assert.ok(readiness([entry, ...baseline], now).multiplier < 1);
  assert.equal(readiness([entry, ...baseline.map(e => ({...e, source: 'Other'}))], now), null);
  assert.equal(readiness([entry, ...Array(7).fill(baseline[0])], now), null);
});
test('manual recovery validates missing, impossible and future measurements', () => {
  const now = new Date(2026,10,3);
  const input = { day: '2026-11-03', hrv: 50, sleep: 8, source: 'Watch' };
  assert.equal(validateRecovery(input, now).manual, true);
  for (const change of [{ sleep: 0 }, { hrv: '' }, { source: '' }, { day: '2026-11-04' }]) assert.throws(() => validateRecovery({...input,...change},now));
});
test('storage upgrade preserves old profiles, meal logs and history', () => {
  const old = emptyState(); delete old.runningPlans; delete old.healthMetrics;
  old.profile = { name: 'Existing user' }; old.logs['2026-11-02'] = {workout: true}; old.sessions = [{id:'prior'}];
  const previous = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => JSON.stringify(old) };
    const upgraded = loadState();
    assert.deepEqual(upgraded.runningPlans, []); assert.deepEqual(upgraded.healthMetrics, []);
    assert.deepEqual(upgraded.profile, old.profile); assert.deepEqual(upgraded.logs, old.logs); assert.deepEqual(upgraded.sessions, old.sessions);
  } finally { globalThis.localStorage = previous; }
});

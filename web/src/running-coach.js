import { todayKey, uid } from './core.js';
export const raceOptions = [[5000, '5K'], [10000, '10K'], [21097.5, 'Half marathon'], [42195, 'Marathon']];
export const defaultGoal = () => ({ raceDistance: 5000, targetMinutes: 30, days: 3, weeks: 12, weeklyKm: 15, benchmarkDistance: 5000, benchmarkMinutes: 30, benchmarkDate: todayKey() });
export function vdot(distance, seconds) {
  if (![distance, seconds].every(Number.isFinite) || distance <= 0 || seconds <= 0) return null;
  const minutes = seconds / 60, velocity = distance / minutes;
  const result = (-4.6 + 0.182258 * velocity + 0.000104 * velocity ** 2) / (0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes));
  return Number.isFinite(result) && result > 0 ? result : null;
}
export function paceZones(value) {
  if (!Number.isFinite(value) || value <= 0) return [];
  const pace = fraction => 60000 / ((-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.6 + value * fraction))) / (2 * 0.000104));
  return [['Easy / recovery', .59, .74], ['Marathon effort', .75, .84], ['Threshold / tempo', .83, .88], ['VO₂ intervals', .95, 1]].map(([name, low, high]) => ({ name, fast: pace(high), slow: pace(low) }));
}
export function createRunningPlan(input, now = new Date()) {
  const goal = { ...input };
  for (const key of ['raceDistance', 'targetMinutes', 'days', 'weeks', 'weeklyKm', 'benchmarkDistance', 'benchmarkMinutes']) goal[key] = Number(goal[key]);
  const minDate = new Date(now); minDate.setDate(minDate.getDate() - 90);
  const benchmark = new Date(`${goal.benchmarkDate}T12:00:00`);
  if (!raceOptions.some(([d]) => d === goal.raceDistance) || ![5000, 10000].includes(goal.benchmarkDistance) ||
      !Number.isInteger(goal.days) || goal.days < 2 || goal.days > 6 || !Number.isInteger(goal.weeks) || goal.weeks < 8 || goal.weeks > 24 ||
      !Number.isFinite(goal.weeklyKm) || goal.weeklyKm < 5 || goal.weeklyKm > 120 ||
      ![goal.targetMinutes / (goal.raceDistance / 1000), goal.benchmarkMinutes / (goal.benchmarkDistance / 1000)].every(p => Number.isFinite(p) && p >= 2.5 && p <= 15) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(goal.benchmarkDate) || !Number.isFinite(benchmark.getTime()) || todayKey(benchmark) !== goal.benchmarkDate || goal.benchmarkDate < todayKey(minDate) || goal.benchmarkDate > todayKey(now)) {
    throw new Error('Use a result from the last 90 days, 2–6 days/week, 8–24 weeks, 5–120 current km/week, and finish times between 2:30 and 15:00 per km.');
  }
  if (goal.raceDistance === 42195 && (goal.weeks < 16 || goal.days < 4 || goal.weeklyKm < 25)) throw new Error('A marathon template needs at least 16 weeks, 4 days/week and a current 25 km/week base. Build your base first.');
  if (goal.raceDistance >= 21097.5 && (goal.weeks < 12 || goal.days < 3 || goal.weeklyKm < 15)) throw new Error('This distance needs at least 12 weeks, 3 days/week and a current 15 km/week base.');
  const estimate = vdot(goal.benchmarkDistance, goal.benchmarkMinutes * 60);
  const weeks = Array.from({ length: goal.weeks }, (_, index) => {
    const week = index + 1, taper = week > goal.weeks - 2, recovery = week % 4 === 0 && !taper;
    return { number: week, phase: taper ? 'Taper' : recovery ? 'Recovery' : week <= goal.weeks / 3 ? 'Base' : 'Build', km: Math.round(goal.weeklyKm * Math.min(1.5, 1.04 ** Math.min(index, goal.weeks - 3)) * (taper ? week === goal.weeks ? .55 : .75 : recovery ? .8 : 1) * 10) / 10, days: goal.days };
  });
  return { id: uid(), active: true, created: now.toISOString(), startsOn: todayKey(now), goal, vdot: estimate, zones: paceZones(estimate), weeks, algorithmVersion: 1 };
}
export function validateRecovery(input, now = new Date()) {
  const entry = { day: String(input.day), hrv: Number(input.hrv), sleep: Number(input.sleep), source: String(input.source ?? '').trim(), metric: 'SDNN', manual: true };
  const earliest = new Date(now); earliest.setDate(earliest.getDate() - 28);
  const parsed = new Date(`${entry.day}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.day) || !Number.isFinite(parsed.getTime()) || todayKey(parsed) !== entry.day || entry.day > todayKey(now) || entry.day < todayKey(earliest) ||
      !Number.isFinite(entry.hrv) || entry.hrv <= 0 || entry.hrv > 500 || !Number.isFinite(entry.sleep) || entry.sleep <= 0 || entry.sleep > 24 || !entry.source || entry.source.length > 60) {
    throw new Error('Use a date within 28 days, SDNN between 0 and 500 ms, sleep above 0 and at most 24 hours, and a consistent device/source name.');
  }
  return entry;
}
export function readiness(entries, now = new Date()) {
  const today = entries.find(e => e.day === todayKey(now));
  if (!today) return null;
  try { validateRecovery(today, now); } catch { return null; }
  const earliest = new Date(now); earliest.setDate(earliest.getDate() - 28);
  const prior = new Map(entries.filter(e => e.day < today.day && e.day >= todayKey(earliest) && e.source === today.source && e.metric === 'SDNN' && Number.isFinite(e.hrv) && e.hrv > 0).map(e => [e.day, e.hrv]));
  if (prior.size < 7) return null;
  const sorted = [...prior.values()].sort((a, b) => a - b);
  const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
  const score = Math.round(100 * (.5 * Math.min(1, today.hrv / median) + .5 * Math.min(1, today.sleep / 8)));
  return { score, multiplier: score < 65 ? .7 : score < 85 ? .85 : 1, message: score < 65 ? 'Consider recovery or easy movement today.' : score < 85 ? 'Keep today’s effort easier than planned.' : 'Follow your usual plan if you feel well.' };
}

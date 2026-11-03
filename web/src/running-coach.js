import { todayKey, uid } from './core.js';
export const raceOptions = [[5000, '5K'], [10000, '10K'], [21097.5, 'Half marathon'], [42195, 'Marathon']];
export const defaultGoal = () => ({ sport: 'running', raceDistance: 5000, targetMinutes: 30, days: 3, weeks: 12, weeklyKm: 15, benchmarkDistance: 5000, benchmarkMinutes: 30, benchmarkDate: todayKey() });
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
function validatedGoal(input, now) {
  const goal = { sport: 'running', ...input };
  for (const key of ['raceDistance', 'targetMinutes', 'days', 'weeks', 'weeklyKm', 'benchmarkDistance', 'benchmarkMinutes']) goal[key] = Number(goal[key]);
  const minDate = new Date(now); minDate.setDate(minDate.getDate() - 90);
  const benchmark = new Date(`${goal.benchmarkDate}T12:00:00`);
  const range = goal.sport === 'cycling' ? [1, 10] : [2.5, 20];
  if (!['running', 'cycling'].includes(goal.sport) || !Number.isFinite(goal.raceDistance) || goal.raceDistance < 5000 || goal.raceDistance > 200000 ||
      !Number.isFinite(goal.benchmarkDistance) || goal.benchmarkDistance < 1000 || goal.benchmarkDistance > 200000 ||
      !Number.isInteger(goal.days) || goal.days < 2 || goal.days > 6 || !Number.isInteger(goal.weeks) || goal.weeks < 6 || goal.weeks > 24 ||
      !Number.isFinite(goal.weeklyKm) || goal.weeklyKm < 5 || goal.weeklyKm > 600 ||
      ![goal.targetMinutes / (goal.raceDistance / 1000), goal.benchmarkMinutes / (goal.benchmarkDistance / 1000)].every(p => Number.isFinite(p) && p >= range[0] && p <= range[1]) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(goal.benchmarkDate) || !Number.isFinite(benchmark.getTime()) || todayKey(benchmark) !== goal.benchmarkDate || goal.benchmarkDate < todayKey(minDate) || goal.benchmarkDate > todayKey(now)) {
    throw new Error('Use a recent result, a 5–200 km goal, 2–6 training days, 6–24 weeks and 5–600 current km/week. Supported pace: running 2:30–20:00/km; cycling 1:00–10:00/km.');
  }
  if (goal.sport === 'running' && goal.raceDistance >= 42195 && (goal.days < 4 || goal.weeklyKm < 25)) throw new Error('A marathon template needs at least 4 days/week and a current 25 km/week base. Build your base first.');
  if (goal.sport === 'running' && goal.raceDistance >= 21097.5 && (goal.days < 3 || goal.weeklyKm < 15)) throw new Error('This distance needs at least 3 days/week and a current 15 km/week base.');
  return goal;
}
export function assessGoal(input, now = new Date()) {
  const g = validatedGoal(input, now);
  const predictedMinutes = g.sport === 'running' ? g.benchmarkMinutes * (g.raceDistance / g.benchmarkDistance) ** 1.06 : g.raceDistance === g.benchmarkDistance ? g.benchmarkMinutes : null;
  const improvement = predictedMinutes ? Math.max(0, 1 - g.targetMinutes / predictedMinutes) : 0;
  const minimumWeeks = g.sport === 'running' ? g.raceDistance >= 42195 ? 16 : g.raceDistance >= 21097.5 ? 12 : 8 : 8;
  const referenceVolume = Math.max(g.weeklyKm, g.raceDistance / 1000 * (g.sport === 'running' ? .9 : 1.2));
  const growth = (referenceVolume / g.weeklyKm) ** (1 / Math.max(1, g.weeks - 2)) - 1;
  const needed = Math.max(minimumWeeks, Math.ceil(Math.log(referenceVolume / g.weeklyKm) / Math.log(1.1)) + 2, improvement > .08 ? Math.max(16, g.weeks + 4) : 0);
  const recommendedWeeks = Math.min(24, Math.max(g.weeks, needed)), warnings = [];
  if (growth > .1) warnings.push('Goal alert: the reference training volume needs more than 10% growth per week. Build your base before increasing load.');
  if (g.weeks < minimumWeeks) warnings.push(`Goal alert: we recommend at least ${minimumWeeks} weeks to prepare for this distance.`);
  if (improvement > .08) warnings.push(`Goal alert: your target is substantially faster than your recent result predicts. Consider ${recommendedWeeks} weeks or a finish near ${Math.floor(predictedMinutes / 60)} h ${Math.round(predictedMinutes % 60)} min. More time cannot guarantee a result.`);
  if (needed > 24) warnings.push('This goal needs more preparation than this 24-week review supports. Choose a more conservative target or build your base first.');
  if (g.sport === 'cycling') warnings.push('Cycling uses distance and recovery guidance. Running pace formulas do not apply across cycling courses.');
  if (g.sport === 'running' && g.raceDistance > 42195) warnings.push('Ultra-distance goals need individual preparation. This template does not establish race readiness.');
  return { predictedMinutes, minimumWeeks: Math.max(minimumWeeks, improvement > .08 ? 16 : 0), recommendedWeeks, growth, warnings };
}
export function createRunningPlan(input, now = new Date()) {
  const goal = validatedGoal(input, now), assessment = assessGoal(goal, now);
  const requestedWeeks = goal.weeks;
  goal.weeks = assessment.recommendedWeeks;
  const estimate = goal.sport === 'running' ? vdot(goal.benchmarkDistance, goal.benchmarkMinutes * 60) : null;
  let previous = goal.weeklyKm;
  const weeks = Array.from({ length: goal.weeks }, (_, index) => {
    const week = index + 1, taper = week > goal.weeks - 2, recovery = week % 4 === 0 && !taper;
    const intended = goal.weeklyKm * Math.min(1.5, 1.04 ** Math.min(index, goal.weeks - 3)) * (taper ? week === goal.weeks ? .55 : .75 : recovery ? .8 : 1);
    const km = Math.floor(Math.min(intended, previous * 1.1) * 10) / 10; previous = km;
    return { number: week, phase: taper ? 'Taper' : recovery ? 'Recovery' : week <= goal.weeks / 3 ? 'Base' : 'Build', km, days: goal.days };
  });
  return { id: uid(), active: true, created: now.toISOString(), startsOn: todayKey(now), goal, requestedWeeks, assessment, vdot: estimate, zones: paceZones(estimate), weeks, adjustments: [], algorithmVersion: 2 };
}
export function completedPlanWeek(plan, now = new Date()) {
  const [year, month, day] = plan.startsOn.split('-').map(Number);
  const days = (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000;
  return Math.max(0, Math.floor(days / 7));
}
export function adjustPlan(plan, kilometers, recovery, now = new Date()) {
  const week = completedPlanWeek(plan, now), completedKm = Number(kilometers), scheduled = plan.weeks[week - 1];
  if (!plan.active || !scheduled || week < 1 || week >= plan.weeks.length - 2 || !Number.isFinite(completedKm) || completedKm < 0 || completedKm > 1000) throw new Error('Enter a valid distance for a completed build week. Check-ins open after seven days and close during the taper.');
  if ((plan.adjustments ?? []).some(a => a.week === week)) throw new Error('This week has already been reviewed.');
  if (recovery && (!Number.isInteger(recovery.score) || recovery.score < 0 || recovery.score > 100)) throw new Error('Recovery data is invalid.');
  const ratio = scheduled.km > 0 ? completedKm / scheduled.km : 0;
  const low = recovery && recovery.score < 65, extend = ratio < .8 || low;
  const minimum = plan.assessment?.minimumWeeks ?? (plan.goal.raceDistance >= 42195 ? 16 : plan.goal.raceDistance >= 21097.5 ? 12 : 8);
  const shorten = !extend && ratio >= .95 && (recovery?.score ?? 0) >= 85 && plan.weeks.length > minimum;
  const count = extend ? Math.min(24, plan.weeks.length + 2) : shorten ? plan.weeks.length - 1 : plan.weeks.length;
  const multiplier = low ? .7 : recovery && recovery.score < 85 ? .85 : 1;
  const weeks = plan.weeks.slice(0, week); let previous = Math.min(scheduled.km, completedKm);
  for (let n = week + 1; n <= count; n++) {
    const taper = n > count - 2, rest = n % 4 === 0 || (n === week + 1 && extend);
    const km = Math.floor(previous * (taper ? .75 : rest ? .85 : 1.04) * (n === week + 1 ? multiplier : 1) * 10) / 10;
    weeks.push({ number: n, phase: taper ? 'Taper' : rest ? 'Recovery' : 'Build', km, days: scheduled.days }); previous = km;
  }
  const reason = completedKm === 0 ? 'No training was logged. Upcoming distance is paused; set a new baseline before resuming.' : extend ? `Upcoming volume is reduced${count > plan.weeks.length ? ' and the plan is extended by two weeks.' : '; the 24-week limit is reached.'}` : shorten ? 'Your completed training and recovery support a one-week shorter plan.' : 'Timeline retained. Upcoming volume follows completed training.';
  return { ...plan, goal: { ...plan.goal, weeks: count }, weeks, adjustments: [...(plan.adjustments ?? []), { week, completedKm, readiness: recovery?.score ?? null, created: now.toISOString(), previousWeeks: plan.weeks, reason, multiplier, algorithmVersion: 1 }] };
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

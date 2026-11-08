import { uid, todayKey } from './core.js';
import { vdot } from './running-coach.js';

export const runnerDefaults = () => ({ name: '', raceKm: 5, targetMinutes: 30, benchmarkKm: 5, benchmarkMinutes: 30, benchmarkDate: todayKey(), weeklyKm: 20, peakKm: 30, days: 3, weeks: 12 });
export function equivalentSeconds(km, score) {
  if (![km, score].every(Number.isFinite) || km < 1.5 || km > 42.195 || score < 10 || score > 100) return null;
  let low = 60, high = 86400;
  for (let n = 0; n < 80; n++) {
    const mid = (low + high) / 2, value = vdot(km * 1000, mid);
    if (value !== null && value > score) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
export function runnerPaces(score) {
  if (!Number.isFinite(score) || score < 10 || score > 100) throw new Error('A valid recent race result is needed for pace estimates.');
  const pace = oxygen => 60000 / ((-.182258 + Math.sqrt(.182258 ** 2 + 4 * .000104 * (4.6 + oxygen))) / (2 * .000104));
  const threshold = pace(score * (.8 + .1894393 * Math.exp(-.012778 * 60) + .2989558 * Math.exp(-.1932605 * 60)));
  const marathon = equivalentSeconds(42.195, score) / 42.195, repetition = equivalentSeconds(1.5, score) / 1.5;
  return [
    { id: 'E', name: 'Easy', fast: pace(score * .74), slow: pace(score * .59), note: 'Conversational effort. Slow down for hills, heat and fatigue.' },
    { id: 'M', name: 'Marathon', fast: marathon, slow: marathon, note: 'Equivalent road-marathon pace assumes adequate endurance preparation.' },
    { id: 'T', name: 'Threshold', fast: threshold, slow: threshold, note: 'Approximate one-hour race effort; not a measured lactate threshold.' },
    { id: 'I', name: 'Interval', fast: pace(score), slow: pace(score * .95), note: 'Estimated VO₂-demand pace; interval duration and recovery matter.' },
    { id: 'R', name: 'Repetition', fast: repetition, slow: repetition, note: 'Equivalent 1500 m performance for short repetitions with full recovery.' }
  ];
}
export function createRunnerPlan(input, now = new Date()) {
  const g = { ...input, name: String(input.name ?? '').trim() };
  for (const k of ['raceKm','targetMinutes','benchmarkKm','benchmarkMinutes','weeklyKm','peakKm','days','weeks']) g[k] = Number(g[k]);
  const earliest = new Date(now); earliest.setDate(earliest.getDate() - 90);
  const benchmarkDate = new Date(`${g.benchmarkDate}T12:00:00`);
  if (!g.name || g.name.length > 40 || !Object.values(g).filter(v => typeof v === 'number').every(Number.isFinite) ||
      g.raceKm < 3 || g.raceKm > 250 || g.targetMinutes <= 0 || g.targetMinutes > 6000 || g.targetMinutes / g.raceKm < 2 || g.targetMinutes / g.raceKm > (g.raceKm > 42.195 ? 60 : 20) || ![5,10].includes(g.benchmarkKm) ||
      g.benchmarkMinutes / g.benchmarkKm < 2.5 || g.benchmarkMinutes / g.benchmarkKm > 15 ||
      g.weeklyKm < 5 || g.weeklyKm > 300 || g.peakKm < g.weeklyKm || g.peakKm > 350 ||
      !Number.isInteger(g.days) || g.days < 2 || g.days > 6 || !Number.isInteger(g.weeks) || g.weeks < 6 || g.weeks > 52 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(g.benchmarkDate) || !Number.isFinite(benchmarkDate.getTime()) || todayKey(benchmarkDate) !== g.benchmarkDate ||
      g.benchmarkDate < todayKey(earliest) || g.benchmarkDate > todayKey(now)) throw new Error('Check your name, recent 5K/10K result, distances, 2–6 training days and 6–52 weeks. Peak weekly distance must be at least your current volume.');
  const score = vdot(g.benchmarkKm * 1000, g.benchmarkMinutes * 60), zones = runnerPaces(score);
  const ultra = g.raceKm > 42.195, minimum = ultra ? 24 : g.raceKm >= 42.195 ? 16 : g.raceKm >= 21.0975 ? 12 : 8;
  const prediction = ultra ? null : equivalentSeconds(g.raceKm, score);
  const improvement = prediction ? 1 - g.targetMinutes * 60 / prediction : 0;
  const growth = (g.peakKm / g.weeklyKm) ** (1 / Math.max(1, g.weeks - 2)) - 1;
  const needed = Math.max(minimum, Math.ceil(Math.log(g.peakKm / g.weeklyKm) / Math.log(1.1)) + 2, improvement > .08 ? Math.max(16, g.weeks + 4) : 0);
  const weeksCount = Math.min(52, Math.max(g.weeks, needed)), warnings = [];
  if (g.weeks < minimum) warnings.push(`Goal review: this template recommends at least ${minimum} weeks for the distance.`);
  if (growth > .1) warnings.push('Your proposed peak needs more than 10% weekly growth. Extend your build or lower the peak. This cap is a guardrail, not a guarantee against injury.');
  if (improvement > .08) warnings.push('Your target is substantially faster than your recent result predicts. A longer timeline cannot guarantee it; consider a more conservative finish time.');
  if (ultra) warnings.push('Ultra finish times are not predicted from VDOT. Terrain, elevation, fueling and durability need individual planning. The weekly plan below is a base-building template.');
  if (g.raceKm >= 21.0975 && g.weeklyKm < 25) warnings.push('Build a consistent running base before race-specific long-distance training.');
  if (needed > 52) warnings.push('The requested progression exceeds this one-year planner and needs individual review.');
  let prior = g.weeklyKm;
  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const n = i + 1, taper = n > weeksCount - 2, recovery = n % 4 === 0 && !taper;
    const km = Math.floor((i === 0 ? prior : taper ? prior * .75 : recovery ? prior * .85 : Math.min(g.peakKm, prior * 1.08)) * 10) / 10;
    prior = km; return { number: n, km, phase: taper ? 'Taper' : recovery ? 'Recovery' : 'Build', days: g.days };
  });
  const actualPeak = Math.max(...weeks.map(w => w.km));
  if (actualPeak < g.peakKm * .95) warnings.push(`With recovery weeks, this conservative schedule peaks at ${actualPeak} km, below your proposed ${g.peakKm} km. Reassess your baseline and preparation before increasing the load.`);
  return { id: uid(), created: now.toISOString(), startsOn: todayKey(now), goal: g, score, zones, prediction, growth, recommendedWeeks: weeksCount, warnings, weeks, algorithmVersion: 1 };
}
export const runPrograms = [
  { id: 'easy', name: 'Easy run', subtitle: '30 min · conversational effort', detail: 'A steady, easy run. Keep enough breath to speak in full sentences.' },
  { id: '4x4', name: 'Norwegian 4 × 4', subtitle: '4 × 4 min · 3 min easy between', detail: '10 min warm-up, 4 × 4 min controlled hard effort, 3 min active recovery between repeats, 10 min cool-down. The 90–95% HRmax target needs an individually established HRmax and a heart-rate device; Safari does not measure it.' },
  { id: '30-30', name: 'Billat 30–30', subtitle: '10 × 30 sec on / 30 sec easy', detail: '10 min warm-up, ten 30-second work / 30-second easy cycles, 10 min cool-down. A short starter block, not a maximal sprint session.' },
  { id: '1000', name: '5 × 1000 m', subtitle: 'GPS distance · equal-time recovery', detail: '10 min warm-up, five 1000 m repetitions at estimated interval effort. Recovery time matches the actual preceding work interval. Finish with 10 min easy.' },
  { id: '800', name: '6 × 800 m', subtitle: 'GPS distance · equal-time recovery', detail: '10 min warm-up, six 800 m repetitions at estimated interval effort. Recovery time matches the actual preceding work interval. Finish with 10 min easy.' },
  { id: 'practice', name: '30-second practice', subtitle: 'Try the timer · no GPS needed', detail: 'Three ten-second phases to try the controls and sound. Practice is labeled separately and never counts toward running distance.' }
];
export function programSteps(id) {
  if (id === 'practice') return [{ name:'Get ready', seconds:10, zone:'E' }, { name:'Practice work', seconds:10, zone:'I' }, { name:'Practice recovery', seconds:10, zone:'E' }];
  if (id === 'easy') return [{ name:'Easy run', seconds:1800, zone:'E' }];
  if (!['4x4','30-30','1000','800'].includes(id)) throw new Error('Unknown running session.');
  const count = id === '4x4' ? 4 : id === '30-30' ? 10 : id === '1000' ? 5 : 6;
  const steps = [{ name:'Warm up', seconds:600, zone:'E' }];
  for (let i=0; i<count; i++) {
    steps.push({ name:`Work ${i+1} of ${count}`, zone:'I', ...(id === '1000' || id === '800' ? { meters:Number(id) } : { seconds:id === '4x4' ? 240 : 30 }) });
    if (i < count - 1 || id === '30-30') steps.push({ name:'Easy recovery', zone:'E', seconds:id === '4x4' ? 180 : id === '30-30' ? 30 : 'match-work' });
  }
  steps.push({ name:'Cool down', seconds:600, zone:'E' }); return steps;
}
export class RunClock {
  constructor(steps, now = 0, distance = 0) {
    this.steps = structuredClone(steps); this.index = 0; this.started = now; this.phaseStarted = now; this.phaseDistance = distance;
    this.pausedAt = null; this.pausedMilliseconds = 0; this.skipped = 0; this.lastWorkSeconds = 0;
  }
  get done() { return this.index >= this.steps.length; }
  get step() { return this.steps[this.index]; }
  elapsed(now) { return Math.max(0, ((this.pausedAt ?? now) - this.started - this.pausedMilliseconds) / 1000); }
  phaseElapsed(now) { return Math.max(0, ((this.pausedAt ?? now) - this.phaseStarted) / 1000); }
  advance(now, distance, skipped = false) {
    if (this.done || this.pausedAt !== null) return;
    if (this.step.zone === 'I') this.lastWorkSeconds = this.phaseElapsed(now);
    if (skipped) this.skipped++;
    this.index++; this.phaseStarted = now; this.phaseDistance = distance;
    if (this.step?.seconds === 'match-work') this.step.seconds = Math.max(1, this.lastWorkSeconds);
  }
  tick(now, distance) {
    if (this.pausedAt !== null) return;
    while (!this.done) {
      if (this.step.meters) { if (distance - this.phaseDistance >= this.step.meters) this.advance(now, distance); break; }
      if (this.phaseElapsed(now) < this.step.seconds) break;
      this.advance(this.phaseStarted + this.step.seconds * 1000, distance);
    }
  }
  pause(now) { if (this.pausedAt === null) this.pausedAt = now; }
  resume(now) { if (this.pausedAt !== null) { const gap=now-this.pausedAt; this.phaseStarted+=gap; this.pausedMilliseconds+=gap; this.pausedAt=null; } }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerDefaults,createRunnerPlan,runnerPaces,equivalentSeconds,programSteps,RunClock} from '../src/runner-core.js';
test('Runner performance estimates round-trip and E M T I R stay ordered',()=>{
 const p=createRunnerPlan({...runnerDefaults(),name:'Runner',benchmarkMinutes:20});
 assert.ok(Math.abs(p.score-49.8)<.2);assert.ok(Math.abs(equivalentSeconds(5,p.score)-1200)<.01);
 assert.deepEqual(p.zones.map(z=>z.id),['E','M','T','I','R']);
 p.zones.forEach(z=>assert.ok(z.fast<=z.slow));p.zones.slice(1).forEach((z,i)=>assert.ok(z.fast<p.zones[i].fast));
 assert.throws(()=>runnerPaces(NaN));assert.equal(equivalentSeconds(100,p.score),null);
});
test('Runner goals preserve baseline, extend short goals and do not predict ultra pace',()=>{
 const g={...runnerDefaults(),name:'Alex',raceKm:42.195,targetMinutes:180,weeks:6,weeklyKm:25,peakKm:70};
 const p=createRunnerPlan(g);assert.ok(p.recommendedWeeks>=16);assert.ok(p.warnings.length>=2);assert.equal(p.goal.weeks,6);assert.equal(p.goal.benchmarkMinutes,30);
 const ultra=createRunnerPlan({...g,raceKm:100,targetMinutes:720,weeks:24});assert.equal(ultra.prediction,null);assert.ok(ultra.warnings.some(w=>w.includes('Ultra')));
 for(const changed of [{days:0},{weeks:NaN},{benchmarkDate:'2099-12-31'},{peakKm:1},{raceKm:251}])assert.throws(()=>createRunnerPlan({...g,...changed}));
 p.weeks.slice(1).forEach((w,i)=>assert.ok(w.km<=p.weeks[i].km*1.1+.001));
});
test('Interval protocols have correct work, recovery and warmup structure',()=>{
 const four=programSteps('4x4');assert.equal(four.filter(s=>s.zone==='I').length,4);assert.equal(four.filter(s=>s.seconds===180).length,3);
 assert.equal(four.reduce((n,s)=>n+s.seconds,0),2700);
 const thirty=programSteps('30-30');assert.equal(thirty.filter(s=>s.zone==='I').length,10);
 assert.equal(programSteps('1000').filter(s=>s.meters===1000).length,5);assert.equal(programSteps('800').filter(s=>s.meters===800).length,6);
 assert.throws(()=>programSteps('unknown'));
});
test('Practice timer finishes after 30 active seconds and pause does not consume work',()=>{
 const c=new RunClock(programSteps('practice'),0);c.tick(10000,0);assert.equal(c.index,1);
 c.pause(15000);c.tick(60000,0);assert.equal(c.index,1);assert.equal(c.elapsed(60000),15);
 c.resume(60000);c.tick(65000,0);assert.equal(c.index,2);c.tick(75000,0);assert.equal(c.done,true);assert.equal(c.elapsed(75000),30);
});
test('Distance intervals use recorded distance and recovery matches actual work duration',()=>{
 const c=new RunClock([{name:'Work',zone:'I',meters:1000},{name:'Recovery',zone:'E',seconds:'match-work'}],0,500);
 c.tick(240000,1499);assert.equal(c.index,0);c.tick(250000,1500);assert.equal(c.index,1);assert.equal(c.step.seconds,250);
 c.tick(499000,1500);assert.equal(c.done,false);c.tick(500000,1500);assert.equal(c.done,true);
});
test('Manual skips are counted and paused timers cannot skip',()=>{
 const c=new RunClock(programSteps('practice'),0);c.advance(1000,0,true);assert.equal(c.skipped,1);
 c.pause(2000);c.advance(5000,0,true);assert.equal(c.index,1);assert.equal(c.skipped,1);
});

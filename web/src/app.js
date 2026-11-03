import './style.css';
import { createIcons, ArrowUpRight, ArrowLeft, ArrowRight, Plus, Check, X, ChevronRight, ChevronDown, Dumbbell, Flame, Leaf, Map as MapIcon, Crown, LayoutGrid, User, Settings, LocateFixed, Navigation, Play, Square, Timer, CheckCircle2, Circle, ShoppingBasket, Heart, Activity, Share, Download, WifiOff, Footprints, Bike, Flag, RefreshCw, Calendar, ShieldCheck, MoveUpRight, Focus, SlidersHorizontal, Utensils, Compass, Info } from 'lucide';
import { emptyState, todayKey, uid, dayLog, currency, costIn, duration, pace, escapeHTML as e, validateProfile, workouts, meals, macroTotals, toggleMeal, shoppingList, routeLength, sampleRoute } from './core.js';
import { loadState, saveState, putTrack, getTrack } from './storage.js';
import { showMap, disposeMap, locate, generateRoute, discover, updateRunner } from './maps.js';
import { Tracker } from './tracker.js';
import { defaultGoal, createRunningPlan, validateRecovery } from './running-coach.js';
import { coachCard, planPreview, wizard, wearableView } from './coach-ui.js';

const icons = { ArrowUpRight, ArrowLeft, ArrowRight, Plus, Check, X, ChevronRight, ChevronDown, Dumbbell, Flame, Leaf, Map: MapIcon, Crown, LayoutGrid, User, Settings, LocateFixed, Navigation, Play, Square, Timer, CheckCircle2, Circle, ShoppingBasket, Heart, Activity, Share, Download, WifiOff, Footprints, Bike, Flag, RefreshCw, Calendar, ShieldCheck, MoveUpRight, Focus, SlidersHorizontal, Utensils, Compass, Info };
const $ = selector => document.querySelector(selector);
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
let state;
try { state = loadState(); } catch (error) {
  $('#app').innerHTML = `<main class="fatal"><h1>Your data needs attention</h1><p>${e(error.message)}</p><p>Try reopening Safari. Existing data has not been erased.</p></main>`;
  throw error;
}
let tab = 'today', onboardingStep = 0, busy = false, currentLocation = null, places = [], routeId = state.routes[0]?.id, recordPeriod = 'all', restUntil = 0;
let activeRequest;
let toastTimer;
let deferredInstall;
const defaults = () => ({ name: '', age: 25, sex: 'Prefer not to say', weight: 75, target: 75, targetDate: todayKey(new Date(Date.now() + 90 * 86400000)), gym: false, equipment: [], level: 'Beginner', injuries: '', currency: 'SEK', budget: 700, restrictions: [], protein: 120, carbs: 250, fat: 70 });
let draft = defaults();
const tracker = new Tracker(updateWorkout, cue);
let pendingSession = null;
let coachStep = 0, coachDraft = defaultGoal();
const selectedRoute = () => state.routes.find(route => route.id === routeId);
const currentLog = () => state.logs[todayKey()] ?? { workout: false, exercises: [], meals: {} };
const totalWorkouts = () => Object.values(state.logs).filter(log => log.workout).length;

function hydrate() { createIcons({ icons, attrs: { 'stroke-width': 1.8 } }); }
function toast(message) {
  if ($('#modal').open && $('#dialog-status')) { $('#dialog-status').textContent = message; $('#dialog-status').hidden = false; }
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function transact(action) {
  const before = structuredClone(state);
  try { action(); saveState(state); }
  catch (error) { state = before; throw error; }
}
function cue(message) {
  navigator.vibrate?.([80, 40, 80]);
  if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
  toast(message);
}
function openModal(html, label = 'FitCraft') {
  const modal = $('#modal');
  modal.innerHTML = `<div class="modal-head"><span class="eyebrow">${e(label)}</span><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('x')}</button></div><p id="dialog-status" class="notice" role="status" hidden></p>${html}`;
  if (!modal.open) modal.showModal();
  hydrate();
}
const closeModal = () => $('#modal').close();
const section = (title, action = '', text = '') => `<div class="section-heading"><h2>${title}</h2>${action ? `<button class="text-button" data-action="${action}">${text}${icon('arrow-up-right')}</button>` : ''}</div>`;
const metric = (value, label) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
const chip = (text, type = '') => `<span class="chip ${type}">${text}</span>`;
const primary = (title, action, symbol = 'arrow-right', extra = '') => `<button class="primary" data-action="${action}" ${extra}>${title}${icon(symbol)}</button>`;

function render() {
  const scroll = window.scrollY;
  disposeMap();
  if (!state.profile) {
    $('#app').innerHTML = onboarding(); hydrate(); return;
  }
  const profile = state.profile;
  const navigation = [['today', 'layout-grid', 'Today'], ['train', 'dumbbell', 'Train'], ['fuel', 'leaf', 'Fuel'], ['explore', 'compass', 'Explore'], ['records', 'crown', 'Records']];
  $('#app').innerHTML = `<div class="app-shell">
    <header class="app-header"><a class="brand" href="#today" data-action="tab-today"><span class="brand-mark">f<span>c</span></span>fitcraft<span class="brand-dot">.</span></a><div class="header-actions">${!navigator.onLine ? `<span class="offline">${icon('wifi-off')}Offline</span>` : ''}${profile.demo ? '<span class="demo-badge">DEMO PROFILE</span>' : ''}<button class="avatar" data-action="settings" aria-label="Edit profile">${e(profile.name[0]?.toUpperCase() ?? 'F')}</button></div></header>
    <main id="main" class="page page-${tab}">${tracker.active || pendingSession ? outdoor() : ({ today: dashboard, train: training, fuel: nutrition, explore, records })[tab]()}</main>
    ${!tracker.active && !pendingSession ? `<nav class="tab-bar" aria-label="Main navigation">${navigation.map(([id, symbol, title]) => `<button data-action="tab-${id}" class="tab ${tab === id ? 'selected' : ''}" ${tab === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span></button>`).join('')}</nav>` : ''}
  </div>`;
  hydrate();
  if (tab === 'explore' && !tracker.active && !pendingSession) showMap($('#route-map'), selectedRoute(), currentLocation, places);
  if (tracker.active || pendingSession) { showMap($('#workout-map'), tracker.segment, tracker.last); updateWorkout(); }
  window.scrollTo({ top: scroll, behavior: 'auto' });
}

function onboarding() {
  return `<div class="onboarding"><header class="app-header"><span class="brand"><span class="brand-mark">f<span>c</span></span>fitcraft<span class="brand-dot">.</span></span><button class="text-button" data-action="demo">Try demo ${icon('arrow-up-right')}</button></header>
    <main id="main"><div class="onboard-hero"><span class="eyebrow lime">YOUR EVERYDAY STRONG</span><h1>A little stronger.<br>A lot more <em>you.</em></h1><p>Training that fits. Food that fuels.<br>And a reason to get outside.</p><div class="onboard-art" aria-hidden="true"><span class="orbit one"></span><span class="orbit two"></span><span class="orbit three"></span><span class="art-center">${icon('activity')}</span><span class="art-label">MADE FOR YOUR REAL LIFE</span></div></div>
    <div class="onboard-form"><div class="step-indicator">${[0, 1, 2].map(n => `<span class="${n <= onboardingStep ? 'filled' : ''}"></span>`).join('')}<small>0${onboardingStep + 1} / 03</small></div><h2>${['Let’s get to know you.', 'Find your kind of movement.', 'Make good food work for you.'][onboardingStep]}</h2>
    <form id="onboarding-form">${profileFields(draft, onboardingStep)}<div class="form-actions">${onboardingStep ? '<button type="button" class="secondary" data-action="onboard-back">Back</button>' : ''}<button class="primary" type="submit">${onboardingStep === 2 ? 'Build my day' : 'Continue'}${icon('arrow-right')}</button></div><p class="fine-print">For adults 18+. Your profile stays in this browser. No account needed.</p></form></div></main></div>`;
}
function field(label, name, value, type = 'text', extra = '') { return `<label class="field"><span>${label}</span><input name="${name}" value="${e(value)}" type="${type}" ${extra}></label>`; }
function profileFields(p, step) {
  if (step === 0) return `${field('What should we call you?', 'name', p.name, 'text', 'required maxlength="40" autocomplete="given-name" placeholder="Your first name"')}<div class="form-grid">${field('Age', 'age', p.age, 'number', 'required min="18" max="100" inputmode="numeric"')}<label class="field"><span>Sex · optional</span><select name="sex">${['Prefer not to say', 'Female', 'Male'].map(v => `<option ${v === p.sex ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${field('Current weight · kg', 'weight', p.weight, 'number', 'required min="30" max="350" step="0.1" inputmode="decimal"')}${field('Target weight · kg', 'target', p.target, 'number', 'required min="30" max="350" step="0.1" inputmode="decimal"')}</div>${field('Your target date', 'targetDate', p.targetDate, 'date', `required min="${todayKey()}"`)}<p class="hint">Set a personal goal at your own pace. This isn’t a prescribed weight-loss plan.</p>`;
  if (step === 1) return `<label class="toggle-row"><span>${icon('dumbbell')}I have a gym membership</span><input type="checkbox" name="gym" ${p.gym ? 'checked' : ''}></label><fieldset><legend>Your home equipment</legend><div class="equipment-grid">${Object.entries({ dumbbells: 'Dumbbells', bands: 'Bands', kettlebell: 'Kettlebell', bench: 'Bench', pullup: 'Pull-up bar' }).map(([id, title]) => `<label class="choice"><input type="checkbox" name="equipment" value="${id}" ${p.equipment.includes(id) ? 'checked' : ''}><span>${icon('plus')}${title}</span></label>`).join('')}</div></fieldset><label class="field"><span>Your experience</span><select name="level">${['Beginner', 'Intermediate', 'Advanced'].map(level => `<option ${level === p.level ? 'selected' : ''}>${level}</option>`).join('')}</select></label><label class="field"><span>Injury or movement notes · optional</span><textarea name="injuries" rows="3" maxlength="1000" placeholder="Anything you’d like to remember?">${e(p.injuries)}</textarea></label><p class="hint">Notes are for your reference. General workouts aren’t injury rehabilitation; get guidance on painful movements.</p>`;
  return `<div class="form-grid"><label class="field"><span>Currency</span><select name="currency">${['SEK', 'EUR', 'USD'].map(c => `<option ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>${field('Weekly food budget', 'budget', p.budget, 'number', 'required min="1" max="10000" inputmode="decimal"')}</div><fieldset><legend>Food preferences</legend><div class="equipment-grid">${['Vegetarian', 'Vegan', 'Dairy-free', 'Gluten-free'].map(item => `<label class="choice"><input type="checkbox" name="restrictions" value="${item}" ${p.restrictions.includes(item) ? 'checked' : ''}><span>${icon('plus')}${item}</span></label>`).join('')}</div></fieldset><fieldset><legend>Daily macro goals · grams</legend><div class="form-grid three">${field('Protein', 'protein', p.protein, 'number', 'required min="30" max="250"')}${field('Carbs', 'carbs', p.carbs, 'number', 'required min="50" max="500"')}${field('Fat', 'fat', p.fat, 'number', 'required min="20" max="150"')}</div></fieldset><p class="hint">Starting targets are examples, not medical advice. Meal macros and costs are estimates. Check labels for allergens.</p>`;
}
function mergeForm(form, previous, step) {
  const data = new FormData(form);
  const result = { ...previous, ...Object.fromEntries(data) };
  if (step === 1 || step === 'all') { result.gym = data.has('gym'); result.equipment = data.getAll('equipment'); }
  if (step === 2 || step === 'all') result.restrictions = data.getAll('restrictions');
  return result;
}

function dashboard() {
  const p = state.profile, log = currentLog(), totals = macroTotals(log);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const weekly = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 6 + i); return { date, key: todayKey(date), meters: state.sessions.filter(s => todayKey(new Date(s.started)) === todayKey(date)).reduce((sum, s) => sum + s.distance, 0) }; });
  const weeklyMeters = weekly.reduce((sum, day) => sum + day.meters, 0);
  const max = Math.max(1000, ...weekly.map(day => day.meters));
  return `<div class="greeting"><div><p class="eyebrow">${e(date)}</p><h1>Let’s go, ${e(p.name)}<span class="lime">.</span></h1><p>Your pace. Your progress. Your day.</p></div><span class="sunburst" aria-hidden="true">✳</span></div>
    <div class="dashboard-grid"><section class="hero-card"><div class="hero-top">${chip(`${icon('flame')} YOUR DAILY EDGE`, 'dark')}<span>01 / TODAY</span></div><h2>Small steps.<br><em>Stronger you.</em></h2><p>${log.workout ? 'You showed up today. Take a breath and make room for recovery.' : 'A full-body session, built around your life. You bring the effort. We’ll bring the plan.'}</p><div class="hero-bottom"><button class="dark-button" data-action="tab-train">${log.workout ? 'View your workout' : 'Let’s get moving'}${icon('arrow-up-right')}</button><span>~35 MIN<br><b>${p.gym ? 'GYM SESSION' : 'HOME SESSION'}</b></span></div><div class="hero-lines" aria-hidden="true"></div></section>
    <section class="fuel-section">${section('Fuel your day', 'tab-fuel', 'Meal plan')}<div class="card macro-card"><div class="macro-rings">${[['protein', 'Protein', 'lime'], ['carbs', 'Carbs', 'peach'], ['fat', 'Fat', 'lavender']].map(([key, title, color]) => `<div class="macro"><div class="ring ${color}" style="--progress:${Math.min(100, totals[key] / p[key] * 100)}" role="img" aria-label="${title}: ${Math.round(totals[key])} of ${p[key]} grams logged"><div><strong>${Math.max(0, Math.round(p[key] - totals[key]))}<small>g</small></strong><span>left</span></div></div><b>${title}</b><span>${Math.round(totals[key])} / ${p[key]} g</span></div>`).join('')}</div><div class="card-footer">${icon('utensils')}A little planning. A lot more energy.</div></div></section>
    <section class="outside-section">${section('Find your outside', 'tab-explore', 'Explore')}<button class="adventure-card" data-action="tab-explore"><div class="contours" aria-hidden="true">${routeSketch(selectedRoute() ?? sampleRoute())}</div><div class="adventure-content">${chip(`${icon('compass')} FRESH AIR, FRESH START`)}<h3>Your next adventure<br>is closer than you think.</h3><span>Find a route. Make it yours. ${icon('arrow-up-right')}</span></div></button></section>
    <section class="week-section">${section('The bigger picture')}<div class="card"><div class="stats-row">${metric(String(weekly.filter(day => state.logs[day.key]?.workout).length), 'workouts · 7 days')}${metric((weeklyMeters / 1000).toFixed(1), 'outdoor km · 7 days')}${metric(String(totalWorkouts()), 'workouts · all time')}</div><div class="bar-chart" role="img" aria-label="Daily outdoor distance over the last seven days">${weekly.map(day => `<div class="bar-column"><span class="bar-track"><span style="height:${day.meters ? Math.max(5, day.meters / max * 100) : 0}%"></span></span><small>${e(day.date.toLocaleDateString(undefined, { weekday: 'narrow' }))}</small></div>`).join('')}</div><p class="chart-caption">${weeklyMeters ? 'Every kilometer is a little more time for you.' : 'Your first outdoor workout starts your story.'}</p></div></section>
    <div class="tip-card">${icon('shopping-basket')}<div><span class="eyebrow">SMART FUEL, SMALLER SPEND</span><h3>Big nutrition. Little budget.</h3><p>Lentils, frozen greens and seasonal produce go a long way.</p></div></div></div>
    <button class="install-banner" data-action="install">${icon('download')}<span>Your daily companion.<b>Add FitCraft to your Home Screen</b></span>${icon('chevron-right')}</button>`;
}

function training() {
  const p = state.profile, plan = workouts(p, totalWorkouts()), log = currentLog();
  return `<div class="page-heading"><span class="eyebrow lime">SHOW UP FOR YOURSELF</span><h1>Built around you<span class="lime">.</span></h1><p>Full body. Fresh energy. One session at a time.</p></div>${coachCard(state)}<div class="session-banner"><div class="session-icon">${icon('dumbbell')}</div><div><span class="eyebrow">${p.gym ? 'YOUR GYM SESSION' : 'YOUR HOME SESSION'}</span><h2>Strong foundations</h2><p>~35 min <span>•</span> ${e(p.level)} <span>•</span> ${plan.length} movements</p></div></div><div class="progress-heading"><span>${log.workout ? 'Session complete. Well done.' : `${log.exercises.length} of ${plan.length} movements complete`}</span><b>${Math.round((log.workout ? 1 : log.exercises.length / plan.length) * 100)}%</b></div><progress value="${log.workout ? plan.length : log.exercises.length}" max="${plan.length}"></progress>
    ${p.injuries ? `<div class="notice">${icon('heart')}<div><b>Your movement notes</b><p>${e(p.injuries)}</p><p>This general plan hasn’t been adapted to an injury. Get guidance on substitutions.</p></div></div>` : ''}
    <div class="exercise-list">${plan.map((exercise, index) => `<article class="card exercise ${log.exercises.includes(exercise.id) || log.workout ? 'complete' : ''}"><div class="exercise-top"><span class="exercise-number">0${index + 1}</span><div class="exercise-title"><span class="eyebrow">${exercise.type}</span><h3>${exercise.name}</h3><p>${exercise.sets} sets <span>×</span> ${exercise.reps}</p></div><button class="check-button" data-action="exercise" data-id="${exercise.id}" aria-label="${log.exercises.includes(exercise.id) ? 'Uncheck' : 'Complete'} ${exercise.name}" aria-pressed="${log.exercises.includes(exercise.id) || log.workout}" ${log.workout ? 'disabled' : ''}>${icon(log.exercises.includes(exercise.id) || log.workout ? 'check-circle-2' : 'circle')}</button></div><details><summary>Movement notes ${icon('chevron-down')}</summary><p>${exercise.note}</p></details></article>`).join('')}</div>
    <div class="rest-card"><div>${icon('timer')}<span id="rest-label">${restUntil > Date.now() ? `Rest · ${duration((restUntil - Date.now()) / 1000)}` : 'Breathe between sets.'}</span></div><button class="text-button" data-action="rest">60-sec rest ${icon('plus')}</button></div>
    ${primary(log.workout ? 'Today’s workout completed' : 'Finish your workout', 'finish-training', 'check', log.workout || log.exercises.length !== plan.length ? 'disabled' : '')}<p class="fine-print">Aim for 2–3 sessions a week with recovery between. Check each movement after completing all sets.</p>`;
}

function nutrition() {
  const p = state.profile, plan = meals(p), log = currentLog(), estimate = costIn(plan.reduce((sum, meal) => sum + meal.cost, 0) * 7, p.currency);
  return `<div class="page-heading"><span class="eyebrow lime">EAT WELL. FEEL GOOD.</span><h1>Fuel for real life<span class="lime">.</span></h1><p>Simple ingredients. More energy. Less overthinking.</p></div><div class="nutrition-summary card"><div class="stats-row">${metric(e(currency(estimate, p.currency)), 'weekly estimate')}${metric(`${plan.reduce((sum, meal) => sum + meal.protein, 0)}<small>g</small>`, 'daily protein')}</div><span class="budget-message ${estimate > p.budget ? 'warning' : ''}">${icon(estimate > p.budget ? 'info' : 'check-circle-2')}${estimate > p.budget ? `${e(currency(estimate - p.budget, p.currency))} above your budget. Compare prices or try vegetarian meals.` : `Within your ${e(currency(p.budget, p.currency))} weekly budget.`}</span></div><div class="section-heading"><h2>On your menu today</h2><span class="subtle">3 simple staples</span></div><div class="meal-list">${plan.map(meal => `<article class="card meal-card"><div class="meal-art ${meal.color}" aria-hidden="true"><span>${meal.emoji}</span><div class="meal-art-label">${meal.minutes} MIN</div></div><div class="meal-content"><span class="eyebrow">${meal.type}</span><h3>${meal.name}</h3><div class="meal-macros"><b>${meal.protein}g protein</b><span>~${meal.protein * 4 + meal.carbs * 4 + meal.fat * 9} kcal</span></div><div class="meal-actions"><button class="text-button" data-action="recipe" data-id="${meal.id}">Recipe ${icon('arrow-up-right')}</button><button class="pill-button ${log.meals[meal.id] ? 'logged' : ''}" data-action="meal" data-id="${meal.id}" aria-pressed="${Boolean(log.meals[meal.id])}">${icon(log.meals[meal.id] ? 'check' : 'plus')}${log.meals[meal.id] ? 'Logged' : 'Log meal'}</button></div></div></article>`).join('')}</div>${primary('Your weekly shopping list', 'shopping', 'shopping-basket')}<p class="fine-print">Estimates for 3 meals × 7 days; snacks, oil and seasonings are extra. Repeated staples keep planning simple. Prices aren’t live store quotes. Adjust portions to your goals and check allergen labels.</p>`;
}

function routeSketch(route) {
  const lats = route.points.map(p => p.lat), lons = route.points.map(p => p.lon);
  const minX = Math.min(...lons), minY = Math.min(...lats), width = Math.max(...lons) - minX || 0.001, height = Math.max(...lats) - minY || 0.001;
  const points = route.points.map(p => `${70 + (p.lon - minX) / width * 250},${230 - (p.lat - minY) / height * 170}`).join(' ');
  return `<svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice"><defs><pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="currentColor" stroke-width=".6"/></pattern></defs><rect width="400" height="280" fill="url(#grid)"/>${[0, 1, 2, 3, 4].map(i => `<ellipse cx="280" cy="140" rx="${60 + i * 35}" ry="${30 + i * 32}" fill="none" stroke="currentColor"/>`).join('')}<polyline points="${points}" fill="none" stroke="#c5f76b" stroke-width="4" stroke-linejoin="round"/><circle cx="70" cy="230" r="6" fill="#c5f76b"/></svg>`;
}

function explore() {
  const route = selectedRoute();
  return `<div class="page-heading"><span class="eyebrow lime">MORE SKY. LESS SCROLL.</span><h1>Take the long way<span class="lime">.</span></h1><p>A new route. A fresh perspective.</p></div><div class="map-card"><div id="route-map" aria-label="Route map"></div><button class="map-locate" data-action="locate" ${busy ? 'disabled' : ''}>${icon('locate-fixed')}${currentLocation ? 'Recenter' : 'Find me'}</button>${route?.sample ? '<span class="map-badge">ILLUSTRATIVE SAMPLE</span>' : ''}</div><p class="map-caption">${currentLocation ? 'Using your location · map tiles require internet' : 'Stockholm preview · tap Find me to use your location'}</p>
    <div class="card route-builder"><div class="section-heading"><h2>Your next loop</h2>${icon('navigation')}</div><form id="route-form"><div class="segmented"><label><input type="radio" name="activity" value="running" checked><span>${icon('footprints')}Run</span></label><label><input type="radio" name="activity" value="cycling"><span>${icon('bike')}Ride</span></label></div><label class="range-label" for="target-distance">Target distance <b><output id="distance-output">5</output> km</b></label><input id="target-distance" name="distance" type="range" min="2" max="15" step="1" value="5"><div class="range-ends"><span>2 km</span><span>15 km</span></div><button class="primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Finding your way…' : 'Find a discovery loop'}${icon('arrow-up-right')}</button></form><p class="fine-print">Routing uses public OpenStreetMap services. Actual distance varies and paths may overlap. Check access and conditions before heading out.</p></div>
    ${route ? `<section class="card saved-route"><div class="route-name"><span class="tile-icon">${icon('map')}</span><div><h3>${e(route.name)}</h3><span>${(route.distance / 1000).toFixed(2)} km · ${route.sample ? 'Practice preview' : 'Saved on this device'}</span></div></div>${route.sample ? '<p class="hint">Illustrative course for exploring the app. It is not a verified navigable route.</p>' : ''}${route.steps.length ? `<details><summary>Turn preview ${icon('chevron-down')}</summary><ol class="directions">${route.steps.map(step => `<li>${e(step.text)} <small>${Math.round(step.distance)} m</small></li>`).join('')}</ol></details>` : ''}<div class="button-row"><button class="secondary" data-action="segment-create">${icon('flag')}Make a segment</button><button class="secondary" data-action="route-remove" data-id="${e(route.id)}">Remove route</button></div></section>` : `<button class="sample-link" data-action="sample">${icon('map')}Explore a sample route first ${icon('arrow-up-right')}</button>`}
    ${section('A little closer to nature')}<div class="scroll-chips">${[['parks', 'Parks'], ['gyms', 'Outdoor gyms'], ['tracks', 'Tracks']].map(([id, name]) => `<button class="outline-chip" data-action="nearby" data-id="${id}" ${busy ? 'disabled' : ''}>${name}${icon('arrow-up-right')}</button>`).join('')}</div>${places.length ? `<div class="places-list">${places.map(place => `<a href="https://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(place.name)}" target="_blank" rel="noopener" class="place-row"><span>${e(place.name)}</span>${icon('arrow-up-right')}</a>`).join('')}</div>` : ''}
    ${state.routes.length ? `${section('Saved for another day')}<div class="saved-list">${state.routes.map(saved => `<button class="saved-row ${saved.id === routeId ? 'active' : ''}" data-action="route-select" data-id="${e(saved.id)}"><span class="tile-icon">${icon('map')}</span><span><b>${e(saved.name)}</b><small>${(saved.distance / 1000).toFixed(1)} km${saved.sample ? ' · sample' : ''}</small></span>${icon('chevron-right')}</button>`).join('')}</div>` : ''}${primary('Start an outdoor workout', 'start-options', 'play')}<p class="fine-print">Keep Safari open and your screen on during tracking. HealthKit and background GPS are unavailable in this web version.</p>`;
}

function records() {
  const month = todayKey().slice(0, 7);
  return `<div class="page-heading"><span class="eyebrow lime">YOUR ONLY COMPETITION IS YOU</span><h1>Make it your hill<span class="lime">.</span></h1><p>Every effort deserves a place in your story.</p></div><div class="crown-banner"><div class="crown-art">${icon('crown')}</div><div><h2>Chase your next best.</h2><p>Save a segment. Follow the course.<br>Find out what you can do.</p></div></div><div class="segmented period-tabs"><button data-action="period" data-id="all" class="${recordPeriod === 'all' ? 'active' : ''}">All time</button><button data-action="period" data-id="month" class="${recordPeriod === 'month' ? 'active' : ''}">This month</button></div>${section('Your segments')}<p class="hint">Personal times on this device. Global crowns need a connected, verified competition service.</p>
    ${state.segments.length ? state.segments.map(segment => { const attempts = state.attempts.filter(a => a.segmentId === segment.id && (recordPeriod === 'all' || todayKey(new Date(a.started)).startsWith(month))).sort((a, b) => a.seconds - b.seconds).slice(0, 10); return `<article class="card segment-card"><div class="route-name"><span class="tile-icon peach">${icon('flag')}</span><div><h3>${e(segment.name)}</h3><span>${(segment.distance / 1000).toFixed(2)} km${segment.sample ? ' · illustrative sample' : ''}</span></div></div>${attempts.length ? `<ol class="leaderboard">${attempts.map((a, index) => `<li><b class="rank">${index === 0 ? icon('crown') : String(index + 1).padStart(2, '0')}</b><span><strong>${e(state.profile.name)}</strong><small>${new Date(a.started).toLocaleDateString()} · ${pace(a.distance, a.seconds)} /km</small></span><b>${duration(a.seconds)}</b></li>`).join('')}</ol>` : '<div class="empty-inline">Your first time is waiting to be set.</div>'}<button class="secondary full" data-action="attempt" data-id="${e(segment.id)}">${icon('play')}Attempt this segment</button></article>`; }).join('') : `<div class="empty-state">${icon('flag')}<h3>A fresh starting line.</h3><p>Create a segment from a saved route and start collecting your personal bests.</p><button class="text-button" data-action="tab-explore">Find your first route ${icon('arrow-up-right')}</button></div>`}
    ${section('Your activity journal')}${state.sessions.length ? state.sessions.slice().reverse().map(session => `<button class="card journal-entry" data-action="session" data-id="${e(session.id)}"><span class="tile-icon">${icon(session.activity === 'cycling' ? 'bike' : 'footprints')}</span><span><strong>${session.activity === 'cycling' ? 'Outdoor ride' : session.activity === 'walking' ? 'Outdoor walk' : 'Outdoor run'}</strong><small>${new Date(session.started).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${duration((session.finished - session.started) / 1000)}</small></span><b>${(session.distance / 1000).toFixed(2)}<small>km</small></b></button>`).join('') : '<p class="empty-inline">Finish an outdoor workout to start your journal.</p>'}`;
}

function outdoor() {
  return `<div class="page-heading"><span class="eyebrow lime">${pendingSession ? 'YOU SHOWED UP' : 'YOUR OUTDOOR MOMENT'}</span><h1>${pendingSession ? 'Bring it home.' : 'Find your rhythm.'}</h1></div><div class="workout-map-wrap"><div id="workout-map" aria-label="Live workout route"></div><span class="live-pill">${pendingSession ? 'FINISHED' : '<span></span> RECORDING'}</span></div><div class="pace-display"><strong id="live-pace">—</strong><span>AVERAGE PACE · MIN / KM</span></div><div class="stats-row outdoor-stats">${metric('<span id="live-distance">0.00</span>', 'kilometers')}${metric('<span id="live-time">00:00</span>', 'elapsed time')}${metric('<span id="live-accuracy">—</span>', 'GPS accuracy')}</div>
    ${tracker.segment ? `<div class="card"><div class="section-heading"><h3>${e(tracker.segment.name)}</h3>${icon('flag')}</div><progress id="segment-progress" max="1" value="0"></progress><strong class="segment-time" id="segment-time">Waiting for start</strong></div>` : ''}<p class="tracking-status" id="tracking-status" role="status"></p><div class="notice">${icon('info')}<p>Keep Safari visible and the screen on. Locking your iPhone or switching apps can interrupt GPS. This app doesn’t measure heart rate.</p></div>
    ${pendingSession ? `<div class="saved-confirmation">${icon('check-circle-2')}Workout finished · save it to your journal</div>${primary('Save my workout', 'save-outdoor', 'check')}<button class="secondary full" data-action="discard-outdoor">Discard this workout</button>` : `<button class="stop-button" data-action="stop-outdoor">${icon('square')}Finish workout</button>`}`;
}
function updateWorkout() {
  if (!tracker.started) return;
  const elapsed = ((tracker.stopped ?? Date.now()) - tracker.started) / 1000;
  if ($('#live-pace')) $('#live-pace').textContent = pace(tracker.meters, elapsed);
  if ($('#live-distance')) $('#live-distance').textContent = (tracker.meters / 1000).toFixed(2);
  if ($('#live-time')) $('#live-time').textContent = duration(elapsed);
  if ($('#live-accuracy')) $('#live-accuracy').textContent = tracker.last ? `±${Math.round(tracker.last.accuracy)}m` : '—';
  if ($('#tracking-status')) $('#tracking-status').textContent = tracker.status;
  if ($('#segment-progress')) $('#segment-progress').value = tracker.matcher?.progress ?? 0;
  if ($('#segment-time')) $('#segment-time').textContent = tracker.attempt ? duration(tracker.attempt.seconds) : tracker.matcher?.started ? duration((Date.now() - tracker.matcher.started) / 1000) : 'Head to the segment start';
  if (tracker.last) updateRunner(tracker.last, tracker.points);
}

function shopping() {
  const list = shoppingList(meals(state.profile));
  openModal(`<h2>One shop. A whole week.</h2><p class="subtle">Seven days of your current meal plan.</p><div class="shopping-list">${['Produce', 'Chilled', 'Pantry', 'Frozen'].map(aisle => `<h3 class="eyebrow">${aisle}</h3>${list.filter(item => item.aisle === aisle).map(item => `<label class="shopping-item ${state.shopping.includes(item.name) ? 'checked' : ''}"><input type="checkbox" data-shopping="${e(item.name)}" ${state.shopping.includes(item.name) ? 'checked' : ''}><span>${e(item.name)}</span><b>${item.quantity} ${item.unit}</b></label>`).join('')}`).join('')}</div><button class="secondary full" data-action="shopping-reset">Reset checkmarks</button>`, 'YOUR SHOPPING LIST');
}
function settings() {
  const p = state.profile;
  openModal(`<h2>Your life. Your plan.</h2><form id="settings-form"><details open><summary>About you ${icon('chevron-down')}</summary>${profileFields(p, 0)}</details><details><summary>Training & equipment ${icon('chevron-down')}</summary>${profileFields(p, 1)}</details><details><summary>Food & targets ${icon('chevron-down')}</summary>${profileFields(p, 2)}</details><button class="primary" type="submit">Save my profile ${icon('check')}</button></form><div class="settings-links"><button data-action="coach-start">Running coach</button><button data-action="wearables">Wearables & readiness</button><button data-action="install">${icon('download')}Add to Home Screen${icon('chevron-right')}</button><button data-action="export">${icon('share')}Export my data${icon('chevron-right')}</button><button data-action="privacy">${icon('shield-check')}Your data & this app${icon('chevron-right')}</button></div>`, 'YOUR FITCRAFT');
}
function install() {
  openModal(`<div class="install-icon">${icon('download')}</div><h2>A little closer, every day.</h2><p>Give FitCraft a place on your iPhone’s Home Screen.</p><ol class="install-steps"><li><b>1</b><span>Open this page in <strong>Safari</strong>.</span></li><li><b>2</b><span>Tap the <strong>Share</strong> button ${icon('share')} in Safari’s toolbar.</span></li><li><b>3</b><span>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span></li></ol><p class="hint">After the first visit, your plans and saved activity are available offline. Map tiles and route searches need internet. Safari’s menus may vary with iOS version.</p>${deferredInstall ? primary('Install FitCraft', 'browser-install', 'download') : ''}`, 'MAKE IT YOURS');
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  event.preventDefault();
  const action = button.dataset.action, id = button.dataset.id;
  try {
    if (action.startsWith('tab-')) { if (tracker.active || pendingSession) return; tab = action.slice(4); render(); window.scrollTo(0, 0); return; }
    switch (action) {
      case 'demo': transact(() => { state.profile = { ...defaults(), name: 'Alex', demo: true }; state.routes = [sampleRoute()]; }); routeId = state.routes[0].id; render(); window.scrollTo(0, 0); break;
      case 'onboard-back': draft = mergeForm($('#onboarding-form'), draft, onboardingStep); onboardingStep--; render(); break;
      case 'close-modal': closeModal(); break;
      case 'settings': settings(); break;
      case 'coach-start': coachDraft = { ...defaultGoal(), ...(state.runningPlans?.find(p => p.active)?.goal ?? {}) }; coachStep = 0; coachWizard(); break;
      case 'coach-back': coachDraft = { ...coachDraft, ...Object.fromEntries(new FormData($('#coach-form'))) }; coachStep--; coachWizard(); break;
      case 'coach-view': { const plan = state.runningPlans?.find(p => p.active); if (plan) openModal(`<h2>Your running roadmap.</h2>${planPreview(plan)}${primary('Set a new goal', 'coach-start', 'flag')}`, 'RUNNING COACH'); break; }
      case 'wearables': wearables(); break;
      case 'install': install(); break;
      case 'browser-install': await deferredInstall?.prompt(); deferredInstall = null; closeModal(); break;
      case 'exercise': transact(() => { const log = dayLog(state); if (!log.workout) log.exercises = log.exercises.includes(id) ? log.exercises.filter(key => key !== id) : [...log.exercises, id]; }); render(); break;
      case 'finish-training': {
        if (currentLog().exercises.length !== workouts(state.profile).length || currentLog().workout) return;
        transact(() => { dayLog(state).workout = true; }); render(); cue('Workout complete. You showed up!'); break;
      }
      case 'rest': restUntil = Date.now() + 60000; render(); break;
      case 'meal': { const meal = meals(state.profile).find(m => m.id === id); transact(() => toggleMeal(dayLog(state), meal)); render(); break; }
      case 'recipe': {
        const meal = meals(state.profile).find(m => m.id === id);
        openModal(`<div class="recipe-emoji ${meal.color}">${meal.emoji}</div><h2>${meal.name}</h2><p class="subtle">${meal.minutes} min · ~${meal.protein} g protein per serving</p><h3>You’ll need</h3><ul class="ingredients">${meal.ingredients.map(item => `<li><span>${item.name}</span><b>${item.quantity} ${item.unit}</b></li>`).join('')}</ul><h3>Keep it simple</h3><p>${meal.recipe}</p><p class="hint">Check ingredient labels for allergens. Nutrition values are estimates.</p>`, meal.type); break;
      }
      case 'shopping': shopping(); break;
      case 'shopping-reset': transact(() => { state.shopping = []; }); shopping(); break;
      case 'locate': await getLocation(); break;
      case 'sample': transact(() => { if (!state.routes.some(r => r.id === 'stockholm-sample')) state.routes.unshift(sampleRoute()); }); routeId = 'stockholm-sample'; render(); break;
      case 'route-select': routeId = id; render(); window.scrollTo(0, 0); break;
      case 'route-remove': transact(() => { state.routes = state.routes.filter(r => r.id !== id); }); routeId = state.routes[0]?.id; render(); toast('Route removed. Segments and attempts are preserved.'); break;
      case 'nearby': await searchNearby(id); break;
      case 'segment-create': {
        const route = selectedRoute(); if (!route) return;
        openModal(`<h2>Your stretch of possibility.</h2><p>Create a challenge on ${e(route.name)}.</p><form id="segment-form">${field('Segment name', 'name', '', 'text', 'required maxlength="60" placeholder="My park loop"')}<div class="form-grid">${field('Start along route · %', 'start', 0, 'number', 'required min="0" max="90" step="5"')}${field('Finish along route · %', 'finish', 100, 'number', 'required min="10" max="100" step="5"')}</div><p class="hint">Start and finish use 20 m GPS gates. Follow the route in order. Minimum length is 100 m. Percentages follow route points.</p><button class="primary" type="submit">Save segment ${icon('flag')}</button></form>`, 'MAKE IT YOURS'); break;
      }
      case 'period': recordPeriod = id; render(); break;
      case 'start-options': openModal(`<h2>Step into your own time.</h2><p>Keep Safari open and your screen on. GPS tracking starts when you allow location.</p><div class="start-options">${[['running', 'footprints', 'Run'], ['walking', 'navigation', 'Walk'], ['cycling', 'bike', 'Ride']].map(([id, symbol, title]) => `<button class="secondary" data-action="start-workout" data-id="${id}">${icon(symbol)}${title}</button>`).join('')}</div>`, 'YOUR OUTDOOR WORKOUT'); break;
      case 'attempt': { const segment = state.segments.find(s => s.id === id); if (segment?.sample) { openModal(`<h2>This is a sample course.</h2><p>It’s for previewing FitCraft. Generate a real route from your location to create a navigable challenge.</p>${primary('Find my route', 'sample-to-explore', 'compass')}`, 'PRACTICE PREVIEW'); break; } await startOutdoor(segment?.activity ?? 'running', segment); break; }
      case 'sample-to-explore': closeModal(); tab = 'explore'; render(); window.scrollTo(0, 0); break;
      case 'start-workout': await startOutdoor(id); break;
      case 'stop-outdoor': openModal(`<h2>Ready to call it a day?</h2><p>Finish tracking, then save your workout to your journal.</p>${primary('Finish workout', 'confirm-stop', 'square')}<button class="secondary full" data-action="close-modal">Keep going</button>`, 'FINISH YOUR WORKOUT'); break;
      case 'confirm-stop': await tracker.stop(); pendingSession = tracker.summary(); closeModal(); render(); break;
      case 'save-outdoor': {
        button.disabled = true;
        await putTrack(pendingSession.id, tracker.points);
        transact(() => { if (!state.sessions.some(s => s.id === pendingSession.id)) state.sessions.push(pendingSession); if (tracker.attempt && !state.attempts.some(a => a.id === tracker.attempt.id)) state.attempts.push(tracker.attempt); });
        pendingSession = null; tab = 'records'; render(); toast('Workout saved. A little stronger, every day.'); break;
      }
      case 'discard-outdoor': openModal(`<h2>Discard this workout?</h2><p>This session and its segment time won’t be saved.</p><button class="stop-button" data-action="confirm-discard">Discard workout</button><button class="secondary full" data-action="close-modal">Keep it</button>`, 'YOUR WORKOUT'); break;
      case 'confirm-discard': pendingSession = null; closeModal(); tab = 'explore'; render(); break;
      case 'session': {
        const session = state.sessions.find(s => s.id === id);
        const points = await getTrack(id);
        const elevations = points.filter(p => Number.isFinite(p.elevation)).map(p => p.elevation);
        const ascent = elevations.slice(1).reduce((sum, value, index) => sum + Math.max(0, value - elevations[index]), 0);
        openModal(`<h2>Your time outside.</h2><p class="subtle">${new Date(session.started).toLocaleString()}</p><div class="stats-row">${metric((session.distance / 1000).toFixed(2), 'kilometers')}${metric(duration((session.finished - session.started) / 1000), 'elapsed')}${metric(pace(session.distance, (session.finished - session.started) / 1000), 'min/km')}</div>${points.length > 1 ? `<div class="session-sketch">${routeSketch({ points })}</div>` : '<p>No reliable GPS points were recorded.</p>'}${elevations.length > 1 ? `<p class="hint">Approximate GPS ascent: ${Math.round(ascent)} m. GPS altitude can be noisy.</p>` : ''}`, 'ACTIVITY JOURNAL'); break;
      }
      case 'export': {
        const data = { ...state, tracks: {} }; for (const s of state.sessions) data.tracks[s.id] = await getTrack(s.id);
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `FitCraft-${todayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); break;
      }
      case 'privacy': openModal(`<h2>Your progress belongs to you.</h2><p>Your profile, meals and activity history stay in this browser’s storage. Clearing Safari website data removes them. Export a backup before changing devices.</p><p>When you open a map, OpenStreetMap receives tile requests. Route generation and nearby searches send the selected coordinates to public OpenStreetMap routing and Overpass services. Only use these features if you’re comfortable sharing that location.</p><p>No account, advertising, analytics, HealthKit connection, shared leaderboard or live grocery feed is included. Personal times are not independently verified.</p><p>This test app provides general fitness suggestions, not medical or injury rehabilitation advice.</p>`, 'YOUR DATA'); break;
    }
  } catch (error) { button.disabled = false; toast(error.message || 'Something went wrong. Please try again.'); }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['onboarding-form', 'settings-form', 'route-form', 'segment-form', 'coach-form', 'recovery-form'].includes(form.id)) return;
  event.preventDefault();
  try {
    if (form.id === 'coach-form') {
      coachDraft = { ...coachDraft, ...Object.fromEntries(new FormData(form)) };
      if (coachStep < 2) {
        if (coachStep === 1) createRunningPlan(coachDraft);
        coachStep++; coachWizard();
      } else {
        const plan = createRunningPlan(coachDraft);
        transact(() => { state.runningPlans ??= []; state.runningPlans.forEach(p => { p.active = false; }); state.runningPlans.push(plan); });
        closeModal(); tab = 'train'; render(); toast('Your running plan is saved.');
      }
    } else if (form.id === 'recovery-form') {
      const entry = validateRecovery(Object.fromEntries(new FormData(form)));
      transact(() => { state.healthMetrics = (state.healthMetrics ?? []).filter(item => item.day !== entry.day); state.healthMetrics.push(entry); });
      render(); wearables(); toast('Manual recovery check-in saved.');
    } else if (form.id === 'onboarding-form') {
      draft = mergeForm(form, draft, onboardingStep);
      if (onboardingStep < 2) { onboardingStep++; render(); window.scrollTo(0, 0); }
      else { const profile = validateProfile(draft); transact(() => { state.profile = { ...profile, demo: false }; }); render(); window.scrollTo(0, 0); }
    } else if (form.id === 'settings-form') {
      const profile = validateProfile(mergeForm(form, state.profile, 'all'));
      transact(() => { state.profile = { ...profile, demo: false }; }); closeModal(); render(); toast('Your plan is updated.');
    } else if (form.id === 'route-form') {
      if (busy) return;
      const data = new FormData(form); busy = true; render();
      try {
        currentLocation = await locate();
        activeRequest = new AbortController();
        const timeout = setTimeout(() => activeRequest.abort(), 25000);
        let route;
        try { route = await generateRoute(currentLocation, Number(data.get('distance')), data.get('activity'), activeRequest.signal); } finally { clearTimeout(timeout); }
        transact(() => { state.routes.unshift(route); }); routeId = route.id; toast('Your loop is saved. Review it before heading out.');
      } catch (error) { toast(error.name === 'AbortError' ? 'Route search timed out. Try again when the connection improves.' : error.message); }
      finally { busy = false; render(); }
    } else if (form.id === 'segment-form') {
      const data = new FormData(form), route = selectedRoute();
      const start = Number(data.get('start')), finish = Number(data.get('finish'));
      if (!(start >= 0 && finish <= 100 && finish > start)) throw new Error('Finish must be after start.');
      const points = route.points.slice(Math.floor(start / 100 * (route.points.length - 1)), Math.floor(finish / 100 * (route.points.length - 1)) + 1);
      if (routeLength(points) < 100) throw new Error('Choose a segment at least 100 meters long.');
      const name = String(data.get('name')).trim(); if (!name) throw new Error('Give your segment a name.');
      transact(() => { state.segments.push({ id: uid(), name, points, distance: routeLength(points), activity: route.activity, sample: route.sample }); });
      closeModal(); toast('Your segment is ready in Records.');
    }
  } catch (error) { toast(error.message); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'target-distance') $('#distance-output').textContent = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.dataset.shopping) {
    const name = event.target.dataset.shopping;
    try { transact(() => { state.shopping = event.target.checked ? [...new Set([...state.shopping, name])] : state.shopping.filter(s => s !== name); }); event.target.closest('label').classList.toggle('checked', event.target.checked); }
    catch (error) { event.target.checked = !event.target.checked; toast(error.message); }
  }
});
async function getLocation() {
  if (busy) return;
  busy = true;
  try { toast('Finding your location…'); currentLocation = await locate(); toast('Location found. You’re ready to explore.'); }
  finally { busy = false; render(); }
}
async function searchNearby(kind) {
  if (busy) return;
  busy = true; render();
  try {
    currentLocation ??= await locate();
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
    try { places = await discover(currentLocation, kind, controller.signal); } finally { clearTimeout(timeout); }
    toast(places.length ? `${places.length} nearby places found.` : 'No mapped places nearby. Try another category.');
  } finally { busy = false; render(); }
}
async function startOutdoor(activity, segment) {
  if (tracker.active || pendingSession || busy) return;
  busy = true;
  try { await locate(); closeModal(); await tracker.start(activity, segment); render(); window.scrollTo(0, 0); }
  finally { busy = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') tracker.suspend();
  else { tracker.resume(); if (!tracker.active && !pendingSession && state.profile) render(); }
});
window.addEventListener('beforeunload', event => { if (tracker.active || pendingSession) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
window.addEventListener('online', () => { if (state.profile && !tracker.active) render(); toast('You’re back online.'); });
window.addEventListener('offline', () => { if (state.profile && !tracker.active) render(); toast('Offline. Your saved plans are still here.'); });
setInterval(() => {
  if ($('#rest-label') && restUntil) { const remaining = Math.max(0, (restUntil - Date.now()) / 1000); $('#rest-label').textContent = remaining ? `Rest · ${duration(remaining)}` : 'Rest complete. Ready when you are.'; if (!remaining) { restUntil = 0; cue('Rest complete'); } }
}, 1000);
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => toast('Offline setup was unavailable. Reopen FitCraft online to retry.')));
render();

function coachWizard() { openModal(wizard(coachStep, coachDraft), 'RUNNING COACH'); }
function wearables() { openModal(wearableView(state.healthMetrics ?? []), 'WEARABLES & RECOVERY'); }

export const equipmentNames = { dumbbells: 'Dumbbells', bands: 'Resistance bands', kettlebell: 'Kettlebell', bench: 'Bench', pullup: 'Pull-up bar' };
export const emptyState = () => ({ version: 1, profile: null, logs: {}, shopping: [], routes: [], segments: [], attempts: [], sessions: [] });
export const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const dayLog = (state, key = todayKey()) => state.logs[key] ??= { workout: false, exercises: [], meals: {} };
export const currency = (amount, code = 'SEK') => new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount);
export const costIn = (sek, code) => sek / (code === 'EUR' ? 11 : code === 'USD' ? 10 : 1);
export const duration = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};
export const pace = (meters, seconds) => meters >= 20 && seconds > 0 ? duration(seconds / (meters / 1000)) : '—';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function validateProfile(raw) {
  const profile = { ...raw, name: String(raw.name ?? '').trim(), age: Number(raw.age), weight: Number(raw.weight), target: Number(raw.target), budget: Number(raw.budget), protein: Number(raw.protein), carbs: Number(raw.carbs), fat: Number(raw.fat) };
  if (!profile.name || profile.name.length > 40) throw new Error('Enter a name with 1–40 characters.');
  for (const [key, min, max] of [['age', 18, 100], ['weight', 30, 350], ['target', 30, 350], ['budget', 1, 10000], ['protein', 30, 250], ['carbs', 50, 500], ['fat', 20, 150]]) {
    if (!Number.isFinite(profile[key]) || profile[key] < min || profile[key] > max) throw new Error(`${key.charAt(0).toUpperCase() + key.slice(1)} must be between ${min} and ${max}.`);
  }
  if (!['SEK', 'EUR', 'USD'].includes(profile.currency)) throw new Error('Select a supported currency.');
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(profile.level)) throw new Error('Select your experience level.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.targetDate) || profile.targetDate < todayKey()) throw new Error('Choose a target date today or later.');
  return profile;
}

export function workouts(profile, completed = 0) {
  const sets = profile.level === 'Advanced' ? 4 : profile.level === 'Intermediate' ? 3 : 2;
  const kit = profile.equipment ?? [];
  const weighted = profile.gym || kit.includes('dumbbells') || kit.includes('kettlebell');
  const squat = profile.gym ? 'Goblet squat' : kit.includes('dumbbells') ? 'Dumbbell squat' : kit.includes('kettlebell') ? 'Kettlebell squat' : 'Bodyweight squat';
  const progression = completed >= 3 ? 'Add 1–2 reps when every set feels controlled. Increase load only after the top rep range feels comfortable.' : 'Move slowly and leave 2–3 comfortable reps in reserve.';
  return [
    { id: 'warmup', name: 'Make room to move', type: 'WARM UP', sets: 1, reps: '5 min', note: 'Easy marching, shoulder circles and gentle hip movements.', icon: 'flame' },
    { id: 'squat', name: squat, type: 'LOWER BODY', sets, reps: '8–12', note: progression, icon: 'dumbbell' },
    { id: 'push', name: profile.gym ? 'Chest press' : 'Incline push-up', type: 'UPPER BODY', sets, reps: '8–12', note: 'Use a stable surface. Keep the movement in a pain-free range.', icon: 'activity' },
    { id: 'pull', name: profile.gym ? 'Cable row' : weighted ? 'Single-arm row' : kit.includes('bands') ? 'Band row' : 'Prone Y raises', type: 'UPPER BODY', sets, reps: '10–15', note: progression, icon: 'move-up-right' },
    { id: 'hinge', name: weighted ? 'Romanian deadlift' : 'Glute bridge', type: 'LOWER BODY', sets, reps: '10–12', note: 'Control the lowering phase. Keep a comfortable range of motion.', icon: 'dumbbell' },
    { id: 'core', name: 'Dead bug', type: 'CORE', sets: 2, reps: '8 each side', note: 'Exhale as you extend. Keep your back comfortable.', icon: 'focus' }
  ];
}

export function meals(profile) {
  const restrictions = profile.restrictions ?? [];
  const vegan = restrictions.includes('Vegan');
  const veggie = vegan || restrictions.includes('Vegetarian');
  const dairyFree = vegan || restrictions.includes('Dairy-free');
  const ingredient = (name, aisle, quantity, unit = 'g') => ({ name, aisle, quantity, unit });
  return [
    { id: 'breakfast', name: dairyFree ? 'Berry & soy oat bowl' : 'Skyr, berries & overnight oats', type: 'BREAKFAST', emoji: '🫐', color: 'berry', protein: dairyFree ? 26 : 38, carbs: 63, fat: 14, cost: 23, minutes: 5, ingredients: [ingredient(dairyFree ? 'Soy yogurt' : 'Skyr', 'Chilled', 250), ingredient('Certified gluten-free oats', 'Pantry', 70), ingredient('Frozen berries', 'Frozen', 100)], recipe: 'Stir the oats into the yogurt, add berries and refrigerate overnight. Add water to loosen if needed.' },
    { id: 'lunch', name: veggie ? 'Golden tofu power bowl' : 'Chicken & greens power bowl', type: 'LUNCH', emoji: '🥑', color: 'green', protein: veggie ? 38 : 47, carbs: 80, fat: 18, cost: veggie ? 28 : 32, minutes: 25, ingredients: [ingredient(veggie ? 'Firm tofu' : 'Chicken breast', 'Chilled', 200), ingredient('Rice (dry)', 'Pantry', 90), ingredient('Broccoli', 'Produce', 150)], recipe: 'Cook the rice. Cook the protein fully according to its package instructions, steam the broccoli and serve together. Season to taste.' },
    { id: 'dinner', name: 'Smoky lentil & bean chili', type: 'DINNER', emoji: '🍅', color: 'orange', protein: 32, carbs: 74, fat: 12, cost: 24, minutes: 20, ingredients: [ingredient('Cooked lentils', 'Pantry', 200), ingredient('Kidney beans', 'Pantry', 150), ingredient('Crushed tomatoes', 'Pantry', 200)], recipe: 'Combine the cooked lentils, drained beans and tomatoes. Simmer for 15 minutes, stirring occasionally. Add smoked paprika and seasoning to taste.' }
  ];
}

export function macroTotals(log) {
  return Object.values(log?.meals ?? {}).reduce((total, meal) => ({ protein: total.protein + meal.protein, carbs: total.carbs + meal.carbs, fat: total.fat + meal.fat }), { protein: 0, carbs: 0, fat: 0 });
}
export function toggleMeal(log, meal) {
  if (log.meals[meal.id]) delete log.meals[meal.id];
  else log.meals[meal.id] = { protein: meal.protein, carbs: meal.carbs, fat: meal.fat, name: meal.name };
}
export function shoppingList(plan) {
  const items = new Map();
  plan.flatMap(meal => meal.ingredients).forEach(item => {
    const key = `${item.name}|${item.unit}`;
    const previous = items.get(key);
    items.set(key, { ...item, quantity: (previous?.quantity ?? 0) + item.quantity * 7 });
  });
  return [...items.values()];
}

export function distance(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.max(0, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export const routeLength = points => points.slice(1).reduce((total, p, i) => total + distance(points[i], p), 0);
export function resample(points, spacing = 15) {
  if (!points.length) return [];
  if (!(spacing > 0)) throw new Error('Spacing must be positive');
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const count = Math.max(1, Math.ceil(distance(a, b) / spacing));
    for (let step = 1; step <= count; step++) result.push({ lat: a.lat + (b.lat - a.lat) * step / count, lon: a.lon + (b.lon - a.lon) * step / count });
  }
  return result;
}
export class SegmentMatcher {
  constructor(points, radius = 20) { this.course = resample(points); this.radius = radius; this.started = null; this.index = 0; this.leftStart = false; this.finished = false; }
  get progress() { return this.course.length ? Math.min(1, this.index / this.course.length) : 0; }
  update(point) {
    if (this.course.length < 2 || point.accuracy > 25 || point.accuracy < 0 || this.finished) return null;
    if (this.started === null) {
      if (distance(point, this.course[0]) > this.radius) return null;
      this.started = point.time; this.index = 1; return { type: 'start' };
    }
    if (distance(point, this.course[0]) > this.radius * 1.5) this.leftStart = true;
    while (this.index < this.course.length && distance(point, this.course[this.index]) <= Math.max(30, this.radius)) this.index++;
    if (this.leftStart && this.index === this.course.length && distance(point, this.course.at(-1)) <= this.radius && point.time > this.started) {
      this.finished = true; return { type: 'finish', seconds: (point.time - this.started) / 1000 };
    }
    return null;
  }
}
export function sampleRoute() {
  const points = [{ lat: 59.3385, lon: 18.026 }, { lat: 59.3402, lon: 18.0248 }, { lat: 59.3412, lon: 18.0274 }, { lat: 59.3401, lon: 18.0298 }, { lat: 59.3385, lon: 18.0284 }, { lat: 59.3385, lon: 18.026 }];
  return { id: 'stockholm-sample', name: 'Stockholm practice loop', points, distance: routeLength(points), sample: true, activity: 'running', created: Date.now(), steps: [] };
}

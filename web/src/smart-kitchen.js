export const pantryCatalog = [
  { id: 'tofu', name: 'Firm tofu', aisle: 'Chilled', protein: 14, carbs: 2, fat: 8 },
  { id: 'rice', name: 'Rice, dry', aisle: 'Pantry', protein: 7, carbs: 79, fat: 1 },
  { id: 'broccoli', name: 'Broccoli', aisle: 'Produce', protein: 2.8, carbs: 7, fat: .4 },
  { id: 'lentils', name: 'Lentils, cooked / drained', aisle: 'Pantry', protein: 9, carbs: 20, fat: .4 },
  { id: 'beans', name: 'Kidney beans, canned / drained', aisle: 'Pantry', protein: 8, carbs: 22, fat: .5 },
  { id: 'tomato', name: 'Crushed tomatoes', aisle: 'Pantry', protein: 1, carbs: 4, fat: .2 },
  { id: 'skyr', name: 'Plain skyr', aisle: 'Chilled', protein: 11, carbs: 4, fat: .2, dairy: true },
  { id: 'oats', name: 'Certified gluten-free oats', aisle: 'Pantry', protein: 13, carbs: 60, fat: 7 },
  { id: 'berries', name: 'Berries', aisle: 'Produce', protein: 1, carbs: 10, fat: .5 },
  { id: 'salt', name: 'Salt', aisle: 'Pantry', protein: 0, carbs: 0, fat: 0 },
  { id: 'pepper', name: 'Black pepper', aisle: 'Pantry', protein: 10, carbs: 64, fat: 3 },
  { id: 'paprika', name: 'Smoked paprika', aisle: 'Pantry', protein: 14, carbs: 54, fat: 13 }
];
export const pantryRecipes = [
  { id: 'tofu-bowl', name: 'Steamed tofu & broccoli rice bowl', minutes: 25, portions: { tofu: 200, rice: 75, broccoli: 150 }, spices: { salt: .5, pepper: .2 }, steps: ['Rinse the dry rice. Cook in water using the packet’s ratio and time, usually 12–15 minutes.', 'Drain tofu and cut into 2 cm cubes. Cut broccoli into small florets.', 'Steam broccoli for 5–7 minutes until tender. Add tofu and steam until piping hot, about 5 minutes, following its package instructions.', 'Serve over rice. If available, add 0.5 g salt and 0.2 g pepper. No oil is required.'] },
  { id: 'chili', name: 'Lentil & bean tomato pot', minutes: 20, portions: { lentils: 200, beans: 150, tomato: 200 }, spices: { paprika: 1, salt: .5 }, steps: ['Use cooked lentils and canned kidney beans. Drain and rinse. Do not use raw dried kidney beans in this recipe.', 'Combine lentils, beans and tomatoes in a saucepan. Add 50 ml water if thick.', 'Simmer for 15 minutes, stirring, until piping hot throughout.', 'If available, stir in 1 g smoked paprika and 0.5 g salt. Serve warm.'] },
  { id: 'oat-bowl', name: 'Berry skyr breakfast bowl', minutes: 5, portions: { skyr: 250, oats: 60, berries: 100 }, spices: {}, steps: ['Wash fresh berries. For frozen berries, follow any heating instructions on the packet and cool before using.', 'Stir oats into skyr. Add a splash of water for a looser texture.', 'Top with berries. Eat now or cover and refrigerate overnight.'] }
].map(recipe => ({ ...recipe, ...Object.fromEntries(['protein', 'carbs', 'fat'].map(macro => [macro, Object.entries(recipe.portions).reduce((sum, [id, grams]) => sum + pantryCatalog.find(i => i.id === id)[macro] * grams / 100, 0)])) }));
export function verifyPantry(stock) {
  const entries = Object.entries(stock);
  if (!entries.length || entries.some(([id, grams]) => !pantryCatalog.some(i => i.id === id) || !Number.isFinite(grams) || grams <= 0 || grams > 20000)) throw new Error('Select ingredients and enter a positive amount up to 20,000 g for each.');
  return { ...stock };
}
export function allowedRecipe(recipe, restrictions = []) {
  return !((restrictions.includes('Vegan') || restrictions.includes('Dairy-free')) && Object.keys(recipe.portions).some(id => pantryCatalog.find(i => i.id === id).dairy));
}
export function missingIngredients(recipe, stock) {
  return Object.entries(recipe.portions).flatMap(([id, needed]) => {
    const available = Number.isFinite(stock[id]) && stock[id] > 0 ? stock[id] : 0;
    return available < needed ? [{ ...pantryCatalog.find(i => i.id === id), quantity: needed - available, unit: 'g' }] : [];
  });
}
export function kitchenRecipes(stock, restrictions, remaining = {}) {
  const score = r => ['protein', 'carbs', 'fat'].reduce((sum, key) => sum + Math.abs(r[key] - Math.max(0, remaining[key] ?? 0)) / Math.max(10, remaining[key] ?? 0), 0);
  return pantryRecipes.filter(r => allowedRecipe(r, restrictions) && missingIngredients(r, stock).length === 0).sort((a, b) => score(a) - score(b));
}

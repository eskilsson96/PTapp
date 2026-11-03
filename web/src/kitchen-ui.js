import { escapeHTML as e, macroTotals, todayKey, toggleMeal, dayLog } from './core.js';
import { pantryCatalog, pantryRecipes, verifyPantry, kitchenRecipes, missingIngredients, allowedRecipe } from './smart-kitchen.js';

export function openKitchen({ getState, transact, openModal, toast, refresh }) {
  let stock = { ...getState().pantry }, photos = [], confirmed = false, loading = false, closed = false;
  const modal = document.querySelector('#modal');
  const controller = new AbortController();
  function capture() {
    const form = modal.querySelector('#pantry-form');
    if (!form) return;
    const data = new FormData(form);
    stock = Object.fromEntries(data.getAll('ingredient').map(id => [id, Number(data.get(`grams-${id}`))]));
  }
  function paint() {
    const state = getState(), totals = macroTotals(state.logs[todayKey()] ?? { meals: {} });
    const remaining = Object.fromEntries(['protein','carbs','fat'].map(key => [key, Math.max(0, state.profile[key] - totals[key])]));
    const recipes = confirmed ? kitchenRecipes(stock, state.profile.restrictions, remaining) : [];
    const alternatives = pantryRecipes.filter(r => allowedRecipe(r, state.profile.restrictions));
    openModal(`<h2>Your smart kitchen.</h2><p>Make something good from what you have.</p>
      <section class="kitchen-section"><h3>1 · Your fridge or cupboard</h3><p class="hint">Photos stay on this screen and are never uploaded. AI recognition isn’t connected yet; verify your ingredients below.</p>
      <div class="kitchen-photos">${photos.map((photo, index) => `<div><img src="${photo.url}" alt="Fridge photo ${index + 1}"><button class="text-button" type="button" data-kitchen="remove-photo" data-index="${index}">Remove photo ${index + 1}</button></div>`).join('')}</div>
      <div class="photo-actions"><label class="secondary photo-picker">Take a photo<input aria-label="Take a fridge photo" type="file" accept="image/*" capture="environment" data-kitchen-photo ${photos.length >= 3 || loading ? 'disabled' : ''}></label><label class="secondary photo-picker">Choose photos<input aria-label="Choose fridge photos" type="file" accept="image/*" multiple data-kitchen-photo ${photos.length >= 3 || loading ? 'disabled' : ''}></label></div><p class="hint" role="status">${loading ? 'Preparing photos…' : `${photos.length} of 3 photos · optional`}</p></section>
      <form id="pantry-form"><h3>2 · Verify ingredients & amounts</h3><p class="hint">Use the cooked or dry state shown. Check labels, freshness and allergies yourself. Recheck saved amounts each time.</p>
      ${pantryCatalog.map(item => `<div class="pantry-row"><label><input type="checkbox" name="ingredient" value="${item.id}" ${Object.hasOwn(stock, item.id) ? 'checked' : ''}>${e(item.name)}</label><label class="field pantry-amount" ${Object.hasOwn(stock, item.id) ? '' : 'hidden'}><span>Available grams · ${e(item.name)}</span><input name="grams-${item.id}" type="number" inputmode="decimal" min="0.1" max="20000" step="0.1" value="${e(stock[item.id] ?? '')}" ${Object.hasOwn(stock, item.id) ? 'required' : 'disabled'}></label></div>`).join('')}
      <button class="primary" type="submit">Confirm & find recipes</button></form>
      <section id="kitchen-results" ${confirmed ? '' : 'hidden'}><h3 class="plan-heading">3 · Make something good</h3><p class="hint">One serving each. Required ingredients are on hand; only water is assumed. Ranked against your remaining macros. Nutrition is approximate.</p>${recipes.length ? recipes.map(recipe => recipeHTML(recipe, state)).join('') : '<p>No complete recipe matches these amounts yet. Add what you have or shop for a recipe below.</p>'}
      <details><summary>Shop for another recipe</summary><p class="hint">Only missing quantities are added to your shopping list.</p>${alternatives.map(r => `<div class="kitchen-shopping"><span>${e(r.name)}</span><button class="secondary" type="button" data-kitchen="shop" data-id="${r.id}" ${missingIngredients(r, stock).length ? '' : 'disabled'}>Add missing ingredients</button></div>`).join('')}</details></section>`, 'COOK FROM YOUR FRIDGE');
  }
  function recipeHTML(recipe, state) {
    const logged = state.logs[todayKey()]?.meals?.[`kitchen-${recipe.id}`];
    return `<article class="card kitchen-recipe"><span class="eyebrow lime">${recipe.minutes} MIN · 1 SERVING</span><h3>${e(recipe.name)}</h3><p>${Math.round(recipe.protein)} g protein · ${Math.round(recipe.carbs)} g carbs · ${Math.round(recipe.fat)} g fat</p><details><summary>Ingredients & step-by-step recipe</summary><ul class="ingredients">${Object.entries(recipe.portions).map(([id, grams]) => `<li><span>${e(pantryCatalog.find(i => i.id === id).name)}</span><b>${grams} g</b></li>`).join('')}</ul><ol class="recipe-steps">${recipe.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol>${Object.keys(recipe.spices).length ? `<h4>Optional seasonings</h4><ul class="recipe-steps">${Object.entries(recipe.spices).map(([id, grams]) => `<li>${grams} g ${e(pantryCatalog.find(i => i.id === id).name)} · ${(stock[id] ?? 0) >= grams ? 'available' : 'missing; skip or buy separately'}</li>`).join('')}</ul>` : ''}</details><button class="secondary" data-kitchen="log" data-id="${recipe.id}">${logged ? 'Undo meal log' : 'Log this meal'}</button><p class="hint">Logging changes your macros. Pantry quantities stay unchanged; review them before cooking again.</p></article>`;
  }
  modal.addEventListener('change', async event => {
    if (event.target.name === 'ingredient') {
      const amount = event.target.closest('.pantry-row').querySelector('.pantry-amount');
      amount.hidden = !event.target.checked; amount.querySelector('input').disabled = !event.target.checked; amount.querySelector('input').required = event.target.checked;
    }
    if (!event.target.matches('[data-kitchen-photo]')) return;
    capture();
    const files = [...event.target.files];
    if (photos.length + files.length > 3) { event.target.value = ''; toast('Choose up to three photos in total.'); return; }
    loading = true; paint();
    try {
      for (const file of files) {
        if (file.size > 30000000 || !file.type.startsWith('image/')) throw new Error('Choose an image smaller than 30 MB.');
        const rawURL = URL.createObjectURL(file);
        try {
          const image = new Image(); image.src = rawURL; await image.decode();
          if (closed || !modal.open) break;
          const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .75));
          if (!blob) throw new Error('Could not read this photo. Try a JPEG or select ingredients manually.');
          if (closed || !modal.open) break;
          photos.push({ url: URL.createObjectURL(blob) });
        } finally { URL.revokeObjectURL(rawURL); }
      }
    } catch { if (!closed) toast('Could not read this photo. Try a smaller JPEG or select ingredients manually.'); }
    finally { loading = false; if (!closed && modal.open) paint(); }
  }, { signal: controller.signal });
  modal.addEventListener('input', event => {
    if (event.target.closest('#pantry-form')) { confirmed = false; modal.querySelector('#kitchen-results').hidden = true; }
  }, { signal: controller.signal });
  modal.addEventListener('submit', event => {
    if (event.target.id !== 'pantry-form') return;
    event.preventDefault();
    try { capture(); const verified = verifyPantry(stock); transact(() => { getState().pantry = verified; getState().pantryVerifiedAt = new Date().toISOString(); }); confirmed = true; paint(); modal.querySelector('#kitchen-results').scrollIntoView({ block: 'start' }); }
    catch (error) { toast(error.message); }
  }, { signal: controller.signal });
  modal.addEventListener('click', event => {
    const button = event.target.closest('[data-kitchen]'); if (!button) return;
    event.preventDefault();
    try {
      if (button.dataset.kitchen === 'remove-photo') { capture(); URL.revokeObjectURL(photos[Number(button.dataset.index)].url); photos.splice(Number(button.dataset.index), 1); paint(); }
      else {
        const recipe = pantryRecipes.find(r => r.id === button.dataset.id);
        if (button.dataset.kitchen === 'shop') {
          transact(() => {
            for (const item of missingIngredients(recipe, stock)) {
              const list = getState().extraShopping, prior = list.find(i => i.name === item.name);
              if (prior) prior.quantity = Math.max(prior.quantity, item.quantity); else list.push({ name: item.name, quantity: item.quantity, aisle: item.aisle, unit: 'g' });
              getState().shopping = getState().shopping.filter(name => name !== item.name);
            }
          }); toast('Missing ingredients added to your Fuel shopping list.');
        } else if (button.dataset.kitchen === 'log') {
          transact(() => toggleMeal(dayLog(getState()), { ...recipe, id: `kitchen-${recipe.id}` })); paint(); refresh();
        }
      }
    } catch (error) { toast(error.message); }
  }, { signal: controller.signal });
  modal.addEventListener('close', () => { closed = true; photos.forEach(photo => URL.revokeObjectURL(photo.url)); controller.abort(); }, { once: true, signal: controller.signal });
  paint();
}

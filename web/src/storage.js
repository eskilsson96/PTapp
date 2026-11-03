import { emptyState } from './core.js';
const KEY = 'fitcraft.web.v1';
export function loadState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyState();
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || !saved.logs || !Array.isArray(saved.sessions) || !Array.isArray(saved.routes) || !Array.isArray(saved.attempts) || !Array.isArray(saved.segments) || !Array.isArray(saved.shopping)) throw new Error('The saved data could not be read. Your existing storage has not been overwritten.');
  // Additive upgrade: preserve all existing profiles, routes, meals and sessions.
  saved.runningPlans ??= [];
  saved.healthMetrics ??= [];
  if (!Array.isArray(saved.runningPlans) || !Array.isArray(saved.healthMetrics)) throw new Error('Running data could not be read. Existing storage was preserved.');
  return saved;
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { throw new Error('Safari could not save your changes. Free some device storage and try again.'); }
}
let database;
function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open('fitcraft-tracks', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(new Error('Track storage is unavailable.')); };
  });
  return database;
}
export async function putTrack(id, track) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readwrite');
    transaction.objectStore('tracks').put(track, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('Could not save your GPS track.'));
    transaction.onabort = () => reject(new Error('Track saving was interrupted.'));
  });
}
export async function getTrack(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('tracks').objectStore('tracks').get(id);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(new Error('Could not read this track.'));
  });
}

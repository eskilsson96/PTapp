import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { uid, sampleRoute } from './core.js';

let map;
let path;
let runner;
export function disposeMap() { if (map) { map.remove(); map = null; } path = null; runner = null; }
export function showMap(element, route, location, places = []) {
  disposeMap();
  if (!element) return;
  const center = location ?? route?.points[0] ?? sampleRoute().points[0];
  map = L.map(element, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lon], 14);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
  if (route?.points?.length) {
    path = L.polyline(route.points.map(p => [p.lat, p.lon]), { color: '#c5f76b', weight: 5, opacity: 1 }).addTo(map);
    map.fitBounds(path.getBounds(), { padding: [35, 35], maxZoom: 16 });
    L.circleMarker([route.points[0].lat, route.points[0].lon], { radius: 7, color: '#101813', weight: 3, fillColor: '#c5f76b', fillOpacity: 1 }).addTo(map).bindTooltip('Start');
  }
  if (location) updateRunner(location);
  for (const place of places) {
    const marker = L.circleMarker([place.lat, place.lon], { radius: 7, color: '#fff', fillColor: '#f3ba79', fillOpacity: 1 });
    const text = document.createElement('span'); text.textContent = place.name;
    marker.addTo(map).bindPopup(text);
  }
  setTimeout(() => map?.invalidateSize(), 50);
}
export function updateRunner(point, points) {
  if (!map) return;
  if (runner) runner.setLatLng([point.lat, point.lon]);
  else runner = L.circleMarker([point.lat, point.lon], { radius: 7, color: 'white', fillColor: '#528cff', fillOpacity: 1, weight: 3 }).addTo(map);
  if (points?.length) {
    if (path) path.setLatLngs(points.map(p => [p.lat, p.lon]));
    else path = L.polyline(points.map(p => [p.lat, p.lon]), { color: '#c5f76b', weight: 5 }).addTo(map);
  }
}

export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is unavailable in this browser.'));
    navigator.geolocation.getCurrentPosition(position => resolve({ lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy }), error => reject(new Error(error.code === 1 ? 'Location access is off. Allow it in Safari’s website settings, then try again.' : 'Could not find your location. Move outdoors and try again.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  });
}

export async function generateRoute(origin, km, activity, signal) {
  const radius = km * 1000 / 4.2;
  const north = { lat: origin.lat + radius / 111000, lon: origin.lon };
  const east = { lat: origin.lat + radius * 0.4 / 111000, lon: origin.lon + radius * 0.8 / (111000 * Math.max(0.1, Math.cos(origin.lat * Math.PI / 180))) };
  const routePoints = [origin, north, east, origin];
  const mode = activity === 'cycling' ? 'bike' : 'foot';
  const coordinates = routePoints.map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const response = await fetch(`https://routing.openstreetmap.de/routed-${mode}/route/v1/${mode}/${coordinates}?overview=full&geometries=geojson&steps=true`, { signal });
  if (!response.ok) throw new Error('The routing service is temporarily unavailable. Your saved routes still work.');
  const result = await response.json();
  const route = result.routes?.[0];
  if (result.code !== 'Ok' || !route?.geometry?.coordinates?.length || !(route.distance > 100) || !Number.isFinite(route.distance)) throw new Error('No connected loop was found. Try a shorter distance or a different starting point.');
  const points = route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  if (points.length > 20000 || points.some(p => !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lon) || Math.abs(p.lon) > 180)) throw new Error('The routing service returned invalid geometry.');
  return { id: uid(), name: `${(route.distance / 1000).toFixed(1)} km discovery loop`, points, distance: route.distance, activity, sample: false, created: Date.now(), steps: (route.legs ?? []).flatMap(leg => leg.steps ?? []).filter(step => step.distance > 0).map(step => ({ text: `${step.maneuver?.type ?? 'Continue'} ${step.maneuver?.modifier ?? ''}${step.name ? ` onto ${step.name}` : ''}`.trim(), distance: step.distance })) };
}

export async function discover(origin, kind, signal) {
  const filters = { parks: 'way["leisure"="park"]', gyms: 'nwr["leisure"="fitness_station"]', tracks: 'way["leisure"="track"]' };
  const query = `[out:json][timeout:15];${filters[kind] ?? filters.parks}(around:3000,${origin.lat},${origin.lon});out center 20;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal });
  if (!response.ok) throw new Error('Nearby search is unavailable. Try again later.');
  const data = await response.json();
  return (data.elements ?? []).map(p => ({ name: p.tags?.name ?? (kind === 'gyms' ? 'Outdoor fitness station' : kind === 'tracks' ? 'Outdoor track' : 'Park'), lat: p.lat ?? p.center?.lat, lon: p.lon ?? p.center?.lon })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

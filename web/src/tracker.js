import { distance, SegmentMatcher, uid } from './core.js';

export class Tracker {
  constructor(onUpdate, onCue) { this.onUpdate = onUpdate; this.onCue = onCue; this.active = false; this.watch = null; this.timer = null; this.wakeLock = null; }
  async start(activity, segment) {
    if (!navigator.geolocation) throw new Error('GPS tracking is unavailable in this browser.');
    this.id = uid(); this.activity = activity; this.segment = segment;
    this.points = []; this.meters = 0; this.last = null; this.started = Date.now(); this.stopped = null;
    this.matcher = segment ? new SegmentMatcher(segment.points) : null;
    this.attempt = null; this.suspended = false; this.status = 'Finding a clear GPS signal…'; this.active = true;
    this.watch = navigator.geolocation.watchPosition(p => this.ingest({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, elevation: p.coords.altitude, time: p.timestamp }), error => {
      this.status = error.code === 1 ? 'Location permission denied. Finish this session and allow location in Safari settings.' : 'GPS unavailable. Move outdoors and keep Safari open.';
      this.onUpdate();
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    this.timer = setInterval(() => this.onUpdate(), 1000);
    await this.keepAwake();
    this.onUpdate();
  }
  async keepAwake() {
    if (this.active && navigator.wakeLock && document.visibilityState === 'visible') {
      try { this.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Keep-open guidance is always shown. */ }
    }
  }
  ingest(point) {
    if (!this.active || this.suspended || point.time < this.started || Date.now() - point.time > 15000 || point.time - Date.now() > 5000) return;
    if (point.accuracy < 0 || point.accuracy > 25) { this.status = 'Waiting for more accurate GPS…'; this.onUpdate(); return; }
    if (this.last) {
      const elapsed = (point.time - this.last.time) / 1000;
      if (elapsed <= 0) return;
      const increment = distance(this.last, point);
      if (increment / elapsed > (this.activity === 'cycling' ? 35 : 13)) { this.status = 'GPS jump ignored'; return; }
      if (elapsed > 20) { this.matcher = null; this.status = 'GPS gap · segment timing cancelled'; }
      else this.meters += increment;
    }
    this.last = point;
    this.points.push(point);
    if (this.points.length > 20000) { this.status = 'Long session: finish and save before continuing.'; }
    else if (!this.segment) this.status = 'Recording your adventure';
    const event = this.matcher?.update(point);
    if (event?.type === 'start') { this.status = 'Segment started. Find your rhythm.'; this.onCue('Segment started'); }
    if (event?.type === 'finish') {
      this.attempt = { id: uid(), segmentId: this.segment.id, seconds: event.seconds, started: this.matcher.started, finished: point.time, distance: this.segment.distance, verified: false };
      this.status = 'Segment complete!'; this.onCue('Segment complete');
    }
    this.onUpdate();
  }
  suspend() {
    if (!this.active) return;
    this.suspended = true;
    this.last = null;
    if (this.matcher && !this.matcher.finished) this.matcher = null;
    this.status = 'Safari was hidden · distance resumes with the next GPS fix. Segment timing cancelled.';
  }
  resume() { this.suspended = false; this.keepAwake(); }
  async stop() {
    if (!this.active) return;
    this.active = false; this.stopped = Date.now();
    navigator.geolocation.clearWatch(this.watch);
    clearInterval(this.timer);
    await this.wakeLock?.release().catch(() => {});
    this.onUpdate();
  }
  summary() { return { id: this.id, activity: this.activity, started: this.started, finished: this.stopped ?? Date.now(), distance: this.meters, points: this.points.length }; }
}

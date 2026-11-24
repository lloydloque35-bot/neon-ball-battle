'use strict';
/**
 * Battle verification pool. Each worker thread loads the shared game core and re-simulates
 * a battle from its ticket (seed + fighters + catalog snapshot) and the player's recorded inputs.
 * The server's simulation is the authority for the result and the rewards.
 */
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

if (!isMainThread) {
  const { loadCore } = require('./core');
  const core = loadCore();
  parentPort.on('message', ({ id, ticket, inputs, catalog, maxSteps }) => {
    try {
      core.setCatalog(catalog);
      const t0 = Date.now();
      const result = core.simulateTicket(ticket, inputs, maxSteps);
      parentPort.postMessage({ id, ok: true, result, ms: Date.now() - t0 });
    } catch (e) { parentPort.postMessage({ id, ok: false, error: String(e && e.message || e) }); }
  });
} else {
  class Verifier {
    constructor(size = 1, timeoutMs = 25000) { this.size = size; this.timeoutMs = timeoutMs; this.workers = []; this.queue = []; this.seq = 0; for (let i = 0; i < size; i++) this.spawn(); }
    spawn() {
      const w = new Worker(__filename, { execArgv: ['--disable-warning=ExperimentalWarning'] });
      const slot = { w, busy: null };
      w.on('message', m => { const job = slot.busy; if (!job || job.id !== m.id) return; clearTimeout(job.timer); slot.busy = null; m.ok ? job.resolve(m) : job.reject(new Error(m.error)); this.pump(); });
      w.on('error', e => { const job = slot.busy; slot.busy = null; if (job) { clearTimeout(job.timer); job.reject(e); } this.replace(slot); });
      w.unref();
      this.workers.push(slot);
      return slot;
    }
    replace(slot) { const i = this.workers.indexOf(slot); if (i >= 0) this.workers.splice(i, 1); slot.w.terminate().catch(() => {}); if (!this.closed) { this.spawn(); this.pump(); } }
    verify(ticket, inputs, catalog, maxSteps) {
      return new Promise((resolve, reject) => { this.queue.push({ id: ++this.seq, ticket, inputs, catalog, maxSteps, resolve, reject }); this.pump(); });
    }
    pump() {
      for (const slot of this.workers) {
        if (slot.busy || !this.queue.length) continue;
        const job = this.queue.shift(); slot.busy = job;
        job.timer = setTimeout(() => { if (slot.busy === job) { slot.busy = null; job.reject(new Error('Verification timed out')); this.replace(slot); } }, this.timeoutMs);
        slot.w.postMessage({ id: job.id, ticket: job.ticket, inputs: job.inputs, catalog: job.catalog, maxSteps: job.maxSteps });
      }
    }
    async close() { this.closed = true; await Promise.all(this.workers.map(s => s.w.terminate())); }
  }
  module.exports = { Verifier };
}

'use strict';
/**
 * Loads the browser game core (../script.js) headlessly inside a Node VM so the
 * server runs the exact same battle simulation as the client. Used to verify
 * battle results (anti-cheat) and to share ball data, rewards and rules.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'script.js');
const SUPREME = path.join(__dirname, '..', 'supreme.js');   // 2.1.0 Supreme Admin Balls (same simulation as the browser)
const GODS = path.join(__dirname, '..', 'gods.js');         // 2.2.0 free Supreme God Balls (needs supreme.js)

function loadCore() {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const noop = () => {};
  const ctx = {
    NBB_HEADLESS: true, console,
    performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    document: { readyState: 'complete', addEventListener: noop, createElement: () => ({ getContext: () => null, style: {} }), querySelector: () => null, querySelectorAll: () => [] },
    navigator: {}, addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'script.js' });
  if (fs.existsSync(SUPREME)) vm.runInContext(fs.readFileSync(SUPREME, 'utf8'), ctx, { filename: 'supreme.js' });
  if (fs.existsSync(SUPREME) && fs.existsSync(GODS)) vm.runInContext(fs.readFileSync(GODS, 'utf8'), ctx, { filename: 'gods.js' });
  if (!ctx.NBB_CORE) throw new Error('Game core failed to load');
  return ctx.NBB_CORE;
}

module.exports = { loadCore };

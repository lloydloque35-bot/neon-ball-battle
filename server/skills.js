'use strict';
/**
 * 2.6.0 SKILL SYSTEM — server side.
 *  - Skill mastery: XP per ability, earned ONLY from server-verified battles (single player and ranked online), capped per
 *    battle, never from practice/training. Mastery changes looks and titles only — never damage.
 *  - Skill evolution: requirements (ball level, mastery rank, coins) are checked here, inside one transaction.
 *  - Admin Skill Management (owner + recent 2FA, every change audit-logged): edit any ability, create abilities from the
 *    engine's ability types, assign them to balls, unlock levels, mastery requirements, evolution costs, on/off,
 *    and an automatic duplicate audit that compares real mechanics (not names).
 * Settings are part of the battle catalog, so every battle is replayed with exactly the settings it was played with.
 */
const { HttpError, bad } = require('./http');
const { json } = require('./db');

const now = () => Date.now();
const SKILL_UID = /^[a-z0-9_]{1,40}\.[a-z0-9_]{1,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

function register(app, S) {
  const { db, core } = S;

  /* ---------------- catalog part (stored with every battle) ---------------- */
  function catalogPart() {
    const out = { overrides: {}, custom: [] };
    for (const r of db.all('SELECT * FROM admin_skills ORDER BY updated_at')) {
      const d = json(r.data, {});
      if (r.kind === 'override') out.overrides[r.skill_uid] = d;
      else if (r.kind === 'custom') out.custom.push({ ...d, uid: r.skill_uid, ball: r.ball_id });
      else if (r.kind === 'config') { if (Array.isArray(d.evoReq)) out.evoReq = d.evoReq; if (Array.isArray(d.mastery)) out.mastery = d.mastery; }
    }
    return out;
  }
  const masteryOf = (uid, ballId) => Object.fromEntries(db.all('SELECT skill_uid, xp FROM skill_mastery WHERE user_id = ?' + (ballId ? ' AND ball_id = ?' : ''), ...(ballId ? [uid, ballId] : [uid])).map(r => [r.skill_uid, r.xp]));
  const evoRows = (uid, ballId) => Object.fromEntries(db.all('SELECT skill_uid, stage FROM skill_evolution WHERE user_id = ?' + (ballId ? ' AND ball_id = ?' : ''), ...(ballId ? [uid, ballId] : [uid])).map(r => [r.skill_uid, r.stage]));
  /** evolutions that count in battle: only real paths that the owner has not switched off; full power when maxed */
  function evoFor(uid, def, maxed) {
    const s = def && def.skills && def.skills[0]; if (!s || !s.evoPath) return {};
    if (maxed) return { [s.uid]: s.evoPath.length };
    const st = evoRows(uid, def.id)[s.uid] | 0; return st ? { [s.uid]: Math.min(st, s.evoPath.length) } : {};
  }
  /** extra fighter fields for a battle ticket (wins for unlock conditions, evolutions, mastery looks) */
  function specExtras(uid, def, pr) { return { wins: pr.wins | 0, maxed: !!pr.maxed, sevo: evoFor(uid, def, pr.maxed), mast: masteryOf(uid, def.id) }; }
  /** mastery from ONE verified battle: per use (capped) + a bonus for a win; grants mastery titles */
  function grant(uid, ballId, useMap, win) {
    if (!useMap || typeof useMap !== 'object') return null;
    const def = core.getBall(ballId); if (!def) return null;
    const valid = new Set([...(def.skills || []).map(s => s.uid), def.ult && def.ult.uid].filter(Boolean)), M = core.MASTERY_XP, gains = {};
    for (const [k, n] of Object.entries(useMap)) {
      if (!valid.has(k)) continue; const uses = Math.max(0, Math.min(500, n | 0)); if (!uses) continue;
      const g = Math.min(M.cap, uses * M.perUse) + (win ? M.win : 0); gains[k] = g;
      db.run('INSERT INTO skill_mastery (user_id, ball_id, skill_uid, xp, uses, battles, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(user_id, skill_uid) DO UPDATE SET xp = xp + excluded.xp, uses = uses + excluded.uses, battles = battles + 1, updated_at = excluded.updated_at',
        uid, def.id, k, g, uses, now());
    }
    const titles = core.masteryTitles(masteryOf(uid)), fresh = [];
    for (const t of titles) if (!db.get('SELECT 1 FROM cosmetics_owned WHERE user_id = ? AND cosmetic_id = ?', uid, t)) { db.run("INSERT INTO cosmetics_owned (user_id, cosmetic_id, acquired_at, source) VALUES (?, ?, ?, 'mastery')", uid, t, now()); fresh.push(t); }
    return { gains, titles: fresh };
  }
  S.skills26 = { catalogPart, masteryOf, evoRows, evoFor, specExtras, grant, savePart: uid => ({ mastery: masteryOf(uid), evolutions: evoRows(uid) }) };

  /* ---------------- player: evolve an ability ---------------- */
  app.post('/api/skills/evolve', ctx => {
    const u = S.requirePlayable(ctx); S.limit(ctx, 'skevo:' + u.id, 20, 60e3);
    const ballId = String((ctx.body && ctx.body.ball) || ''), skUid = String((ctx.body && ctx.body.uid) || '');
    if (!SKILL_UID.test(skUid)) throw bad('Unknown ability');
    return S.withCatalog(u, () => db.tx(() => {
      const def = core.getBall(ballId);
      if (!def || def.adminOnly || def.custom || def.fusion || def.summonOnly) throw bad('This ball has no ability that can evolve');
      const acc = S.access(u, def); if (!acc || acc === 'trial') throw new HttpError(403, 'You do not own this ball', 'NO_ACCESS');
      const s = def.skills[0]; if (!s || s.uid !== skUid || !s.evoPath) throw bad('This ability cannot evolve');
      const pr = S.progOf(u.id, def.id); if (pr.maxed) throw bad('This ball already fights at full power, every evolution included');
      const cur = evoRows(u.id, def.id)[s.uid] | 0, next = cur + 1;
      if (next > s.evoPath.length) throw bad('This ability is already fully evolved');
      const req = core.evoReq(def, next); if (!req) throw bad('This ability cannot evolve further');
      if ((pr.level | 0) < req.lv) throw bad(`Needs ball level ${req.lv}`);
      const xp = masteryOf(u.id, def.id)[s.uid] | 0;
      if (core.masteryRank(xp) < req.rank) throw bad(`Needs ${core.MASTERY[req.rank].name} mastery of ${s.name}`);
      const r = db.run('UPDATE profiles SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?', req.coins, now(), u.id, req.coins);
      if (Number(r.changes) !== 1) throw new HttpError(402, 'Not enough coins', 'NO_COINS');
      db.run('INSERT INTO skill_evolution (user_id, ball_id, skill_uid, stage, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, skill_uid) DO UPDATE SET stage = excluded.stage, updated_at = excluded.updated_at', u.id, def.id, s.uid, next, now());
      db.run('INSERT INTO skill_evolution_log (user_id, ball_id, skill_uid, stage, coins, created_at) VALUES (?, ?, ?, ?, ?, ?)', u.id, def.id, s.uid, next, req.coins, now());
      return { ok: true, stage: next, name: s.evoPath[next - 1], save: S.savePayload(u) };
    }));
  });

  /* ---------------- ADMIN SKILL MANAGEMENT (owner + 2FA, audit-logged) ---------------- */
  const A = (method, path, fn) => app[method](path, { bodyLimit: 64 * 1024 }, ctx => { const u = S.requireOwner(ctx); S.limit(ctx, 'admsk:' + u.id, 240, 60e3); return fn(ctx, u); });
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const num = (v, min, max) => { const n = Number(v); if (!Number.isFinite(n)) throw bad('A number is out of range'); return Math.min(max, Math.max(min, n)); };
  const allowedTypes = () => Object.keys(core.TYPE_META).filter(t => !['copy', 'adaptive', 'resurrect'].includes(t));
  const upsert = (uid, kind, ball, data, actor) => db.run('INSERT INTO admin_skills (skill_uid, kind, ball_id, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(skill_uid) DO UPDATE SET kind = excluded.kind, ball_id = excluded.ball_id, data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at',
    uid, kind, ball, JSON.stringify(data), actor, now());
  const regOf = u => S.withCatalog(u, () => core.skillRegistry());

  A('get', '/api/admin/skills', (ctx, u) => S.withCatalog(u, () => {
    const registry = core.skillRegistry(), audit = core.skAudit(registry);
    return { version: core.SKILLS_VERSION, registry, audit, config: catalogPart(), cats: core.SK_CATS, twists: core.twistList(), types: allowedTypes().map(t => ({ type: t, label: core.SKILL_TYPES[t].label, desc: core.SKILL_TYPES[t].desc })), effects: core.EFFECTS,
      mastery: core.MASTERY, masteryXp: core.MASTERY_XP, evoReq: core.EVO_REQ, evoReqHigh: core.EVO_REQ_HIGH, dup: core.DUP, slotCap: core.SLOT_CAP,
      combos: core.COMBOS.map(c => ({ id: c.id, name: c.name, kind: c.kind, desc: c.desc, balls: c.balls || [], skills: c.skills || [] })) };
  }));
  A('post', '/api/admin/skills/override', (ctx, u) => {
    const b = ctx.body || {}, uid = String(b.uid || '');
    if (!SKILL_UID.test(uid)) throw bad('Unknown ability');
    const rec = regOf(u).find(r => r.uid === uid); if (!rec) throw bad('Unknown ability');
    const o = {};
    if (b.cd != null && b.cd !== '') o.cd = num(b.cd, 0.5, 60);
    if (b.power != null && b.power !== '') o.power = num(b.power, 5, 250);
    if (b.unlockLv != null && b.unlockLv !== '' && rec.v26) o.unlockLv = Math.round(num(b.unlockLv, 1, 100));
    if (b.unlockWins != null && b.unlockWins !== '' && rec.v26) o.unlockWins = Math.round(num(b.unlockWins, 0, 500));
    if (str(b.name, 32)) o.name = str(b.name, 32);
    if (str(b.desc, 200)) o.desc = str(b.desc, 200);
    if (b.off) { if (rec.legacy || rec.isUlt) throw bad('Classic abilities and ultimates cannot be switched off (players own them); you can change their numbers'); o.off = true; }
    if (b.evoOff) o.evoOff = true;
    const before = db.get('SELECT data FROM admin_skills WHERE skill_uid = ?', uid);
    if (!Object.keys(o).length) db.run("DELETE FROM admin_skills WHERE skill_uid = ? AND kind = 'override'", uid); else upsert(uid, 'override', rec.ball, o, u.id);
    S.audit(u.id, 'admin.skill_override', uid, ctx.ip, { before: before ? json(before.data, {}) : null, after: o });
    return { ok: true, override: o };
  });
  function sanitizeCustom(b, reg) {
    const ball = String(b.ball || ''), def = core.getBall(ball);
    if (!def || def.summonOnly || def.unit || def.fusion) throw bad('Choose a ball to assign the ability to');
    const type = String(b.type || ''); if (!allowedTypes().includes(type)) throw bad('Choose an ability type');
    const name = str(b.name, 32); if (name.length < 3) throw bad('Give the ability a name (3+ letters)');
    if (reg.some(r => r.ball === ball && r.name.toLowerCase() === name.toLowerCase() && r.uid !== b.uid)) throw bad('This ball already has an ability with that name');
    const twist = b.twist ? String(b.twist) : null; if (twist && !core.twistList().some(t => t.id === twist)) throw bad('Unknown signature mechanic');
    return { ball, type, name, twist: twist || undefined, cd: num(b.cd ?? 8, 1, 60), power: num(b.power ?? 50, 5, 200), color: HEX.test(b.color || '') ? b.color : def.design.c3, effect: core.EFFECTS.includes(b.effect) ? b.effect : 'none',
      cat: core.SK_CATS[b.cat] ? b.cat : (core.TYPE_META[type].cat || 'offense'), desc: str(b.desc, 200), unlockLv: Math.round(num(b.unlockLv ?? 20, 1, 100)), count: b.count ? Math.round(num(b.count, 1, 9)) : undefined };
  }
  A('post', '/api/admin/skills/check', (ctx, u) => S.withCatalog(u, () => { const b = ctx.body || {}; return { matches: core.skCheckProposal({ type: String(b.type || ''), twist: b.twist ? String(b.twist) : null, effect: String(b.effect || 'none'), name: String(b.name || ''), uid: b.uid ? String(b.uid) : null }), dup: core.DUP }; }));
  A('post', '/api/admin/skills/custom', (ctx, u) => S.withCatalog(u, () => {
    const b = ctx.body || {}, reg = core.skillRegistry();
    if (b.uid != null && !(SKILL_UID.test(String(b.uid)) && db.get("SELECT 1 FROM admin_skills WHERE skill_uid = ? AND kind = 'custom'", String(b.uid)))) throw bad('Unknown custom ability');
    const c = sanitizeCustom(b, reg);
    const uid = b.uid ? String(b.uid) : `${c.ball}.c26_${(db.get("SELECT COUNT(*) AS n FROM admin_skills WHERE kind = 'custom'").n + 1).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
    const def = core.getBall(c.ball);
    if (!b.uid && !def.adminOnly && !def.custom && (def.slotsUsed || 0) + 1 > (def.slotCap || 4)) throw bad(`${def.name} has no free skill slot (${def.rarity}: ${def.slotCap} slots including the ultimate). Switch off one of its new abilities first.`);
    const matches = core.skCheckProposal({ ...c, uid }, reg), worst = matches[0];
    if (worst && worst.score >= core.DUP.BLOCK && !b.force) throw new HttpError(409, `Too similar to “${worst.name}” (${worst.ball}): ${Math.round(worst.score * 100)}% the same. Change its type, signature mechanic or effect — or save anyway.`, 'DUPLICATE_SKILL');
    upsert(uid, 'custom', c.ball, c, u.id);
    S.audit(u.id, b.uid ? 'admin.skill_edit' : 'admin.skill_create', uid, ctx.ip, { ...c, similar: matches.slice(0, 3).map(m => ({ uid: m.uid, score: m.score })), forced: !!(worst && worst.score >= core.DUP.BLOCK) });
    return { ok: true, uid, warnings: matches.slice(0, 5) };
  }));
  A('post', '/api/admin/skills/custom/delete', (ctx, u) => {
    const uid = String((ctx.body && ctx.body.uid) || ''); const row = db.get("SELECT * FROM admin_skills WHERE skill_uid = ? AND kind = 'custom'", uid);
    if (!row) throw bad('Unknown custom ability');
    db.run('DELETE FROM admin_skills WHERE skill_uid = ?', uid);
    S.audit(u.id, 'admin.skill_delete', uid, ctx.ip, json(row.data, {}));
    return { ok: true };
  });
  A('post', '/api/admin/skills/config', (ctx, u) => {
    const b = ctx.body || {}, out = {};
    if (Array.isArray(b.evoReq)) { if (b.evoReq.length !== 3) throw bad('Give the requirements of all three stages'); out.evoReq = b.evoReq.map((r, i) => ({ lv: Math.round(num(r.lv, 1, 100)), rank: Math.round(num(r.rank, 0, 4)), coins: Math.round(num(r.coins, 0, 1e6)) }));
      for (let i = 1; i < 3; i++) if (out.evoReq[i].lv < out.evoReq[i - 1].lv) throw bad('Each stage must need at least the level of the one before'); }
    if (Array.isArray(b.mastery)) { if (b.mastery.length !== 5) throw bad('Give the XP of all five mastery ranks'); out.mastery = b.mastery.map(v => Math.round(num(v, 0, 1e6))); out.mastery[0] = 0;
      for (let i = 1; i < 5; i++) if (out.mastery[i] <= out.mastery[i - 1]) throw bad('Each mastery rank must need more XP than the one before'); }
    const before = db.get("SELECT data FROM admin_skills WHERE skill_uid = '__config__'");
    const merged = { ...(before ? json(before.data, {}) : {}), ...out };
    upsert('__config__', 'config', null, merged, u.id);
    S.audit(u.id, 'admin.skill_config', '__config__', ctx.ip, { before: before ? json(before.data, {}) : null, after: merged });
    return { ok: true, config: merged };
  });
}

module.exports = { register };

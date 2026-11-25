'use strict';
/**
 * Minimal WebSocket server (RFC 6455) — text frames only, no extensions, no dependencies.
 * Used for real-time online PvP. Client frames must be masked; messages are capped in size;
 * slow or silent connections are dropped.
 */
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function reject(socket, status, text) {
  try { socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch { /* ignore */ }
  socket.destroy();
}

/** completes the handshake; returns a WsConn, or null after rejecting the request */
function accept(req, socket, head, { maxPayload = 32 * 1024 } = {}) {
  const key = req.headers['sec-websocket-key'];
  if (req.method !== 'GET' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key || !/^[A-Za-z0-9+/]{22}==$/.test(key) || req.headers['sec-websocket-version'] !== '13') {
    reject(socket, 400, 'Bad Request'); return null;
  }
  const acceptKey = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey}`, '', ''].join('\r\n'));
  const ws = new WsConn(socket, maxPayload);
  if (head && head.length) ws.onData(head);
  return ws;
}

class WsConn extends EventEmitter {
  constructor(socket, maxPayload) {
    super();
    this.socket = socket; this.maxPayload = maxPayload; this.buf = Buffer.alloc(0); this.frags = null; this.closed = false; this.lastSeen = Date.now();
    socket.setNoDelay(true);
    socket.on('data', d => this.onData(d));
    socket.on('end', () => this.end());          // HTTP server sockets are half-open: the peer hanging up only fires 'end'
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }
  onData(d) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > this.maxPayload * 2 + 16) return this.fail(1009);
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (b[0] & 0x70) return this.fail(1002);                   // no extensions negotiated
      if (!masked) return this.fail(1002);                       // clients must mask
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(this.maxPayload)) return this.fail(1009); len = Number(big); off = 10; }
      if (len > this.maxPayload) return this.fail(1009);
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4), data = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 0x8) { this.sendFrame(0x8, data.subarray(0, 2)); return this.end(); }
      if (op === 0x9) { this.sendFrame(0xA, data); continue; }
      if (op === 0xA) continue;
      if (op === 0x2) return this.fail(1003);                    // text only
      if (op === 0x1) { if (this.frags) return this.fail(1002); if (fin) this.deliver(data); else this.frags = [data]; continue; }
      if (op === 0x0) {
        if (!this.frags) return this.fail(1002);
        this.frags.push(data);
        if (this.frags.reduce((n, x) => n + x.length, 0) > this.maxPayload) return this.fail(1009);
        if (fin) { const all = Buffer.concat(this.frags); this.frags = null; this.deliver(all); }
        continue;
      }
      return this.fail(1002);
    }
  }
  deliver(data) {
    let msg; try { msg = JSON.parse(data.toString('utf8')); } catch { return this.fail(1007); }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return this.fail(1007);
    this.emit('message', msg);
  }
  sendFrame(op, payload) {
    if (this.closed) return;
    const n = payload.length; let head;
    if (n < 126) head = Buffer.from([0x80 | op, n]);
    else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    try { this.socket.write(Buffer.concat([head, payload])); } catch { this.finish(); }
    if (this.socket.writableLength > 2 * 1024 * 1024) this.end();   // client is not reading: drop it
  }
  send(obj) { this.sendFrame(0x1, Buffer.from(JSON.stringify(obj))); }
  fail(code) { const p = Buffer.alloc(2); p.writeUInt16BE(code); this.sendFrame(0x8, p); this.end(); }
  close(code = 1000) { this.fail(code); }
  end() { if (this.closed) return; try { this.socket.end(); } catch { /* ignore */ } setTimeout(() => this.socket.destroy(), 1000).unref(); this.finish(); }
  finish() { if (this.closed) return; this.closed = true; this.emit('close'); }
}

module.exports = { accept, reject };

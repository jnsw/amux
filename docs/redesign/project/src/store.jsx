/* Real-data store — talks to /api/sessions + /api/events SSE.
   Keeps the same shape the components expect (name/status/cwd/branch/preview/tokens/task/last_activity). */

const AUTH = (typeof window !== 'undefined' && window._AMUX_AUTH_TOKEN) || '';
const API_HEADERS = AUTH ? { 'Authorization': 'Bearer ' + AUTH } : {};

function _statusOf(raw) {
  // raw fields: running (bool), status ("idle" | "waiting" | "" | ...), archived
  if (!raw.running) return 'stopped';
  const st = (raw.status || '').toLowerCase();
  if (st === 'idle')    return 'idle';
  if (st === 'waiting') return 'waiting';
  // recent activity (<60s) and no explicit status → active
  const ageSec = raw.last_activity ? (Date.now()/1000 - raw.last_activity) : 9999;
  if (ageSec < 60) return 'active';
  return 'idle';
}

function _normalize(raw) {
  // SSE/API payload uses seconds for last_activity/session_created.
  const lastMs = (raw.last_activity || 0) * 1000;
  const createdMs = (raw.session_created || 0) * 1000;
  const totalTokens = typeof raw.tokens === 'number' ? raw.tokens : (raw.tokens?.total || 0);
  return {
    name: raw.name,
    status: _statusOf(raw),
    cwd: raw.dir || '',
    branch: raw.branch || '',
    provider: raw.provider || 'claude',
    model: raw.active_model || '',
    tokens: { input: 0, output: 0, cached: 0, total: totalTokens },
    last_activity: lastMs || Date.now(),
    session_created: createdMs || Date.now(),
    task: raw.task_name ? { id: raw.name, title: raw.task_name, elapsed: raw.task_time || '' } : null,
    preview: Array.isArray(raw.preview_lines) ? raw.preview_lines.slice(-6) : (raw.preview ? [raw.preview] : []),
    archived: !!raw.archived,
    pinned: !!raw.pinned,
    _raw: raw,
  };
}

// In-memory store
const store = {
  sessions: [],
  selected: null,
  connection: "offline",
  lastPing: Date.now(),
  listeners: new Set(),
  toasts: [],
  toastId: 1,
};

function notify() { store.listeners.forEach(l => l()); }
function subscribe(l) { store.listeners.add(l); return () => store.listeners.delete(l); }

async function refreshSessions() {
  try {
    const r = await fetch('/api/sessions', { headers: API_HEADERS });
    if (!r.ok) throw new Error('http ' + r.status);
    const raw = await r.json();
    const filtered = (raw || []).filter(s => !s.archived);
    store.sessions = filtered.map(_normalize);
    notify();
  } catch (e) {
    console.warn('refreshSessions failed', e);
  }
}

// Optimistic local patch (UI smoothness); next SSE/refresh overrides.
function patchSession(name, patch) {
  const i = store.sessions.findIndex(s => s.name === name);
  if (i === -1) return;
  store.sessions[i] = { ...store.sessions[i], ...patch };
  notify();
}

function pushToast(text, kind = "info") {
  const id = store.toastId++;
  store.toasts.push({ id, text, kind });
  notify();
  setTimeout(() => {
    store.toasts = store.toasts.filter(t => t.id !== id);
    notify();
  }, 3200);
}

// Real session actions
async function _post(path, body) {
  const opts = { method: 'POST', headers: { ...API_HEADERS } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.status === 204 ? null : r.json().catch(() => null);
}

async function sendToSession(name, text) {
  await _post(`/api/sessions/${encodeURIComponent(name)}/send`, { text });
}
async function stopSession(name) {
  await _post(`/api/sessions/${encodeURIComponent(name)}/stop`);
}
async function wakeSession(name) {
  // Real API uses /wake to bring a stopped session up
  try {
    await _post(`/api/sessions/${encodeURIComponent(name)}/wake`);
  } catch (e) {
    // fallback to /start
    await _post(`/api/sessions/${encodeURIComponent(name)}/start`);
  }
}
async function archiveSession(name) {
  await _post(`/api/sessions/${encodeURIComponent(name)}/archive`);
}
async function duplicateSession(name) {
  await _post(`/api/sessions/${encodeURIComponent(name)}/duplicate`);
}
async function createSession({ name, cwd, provider, branch }) {
  // amux creates a session by POSTing /api/sessions, then /start.
  const payload = { name, dir: cwd, provider };
  if (branch) payload.branch = branch;
  const r = await fetch('/api/sessions', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('create failed: ' + r.status);
  await _post(`/api/sessions/${encodeURIComponent(name)}/start`);
}

// Real SSE — listens for {type: "sessions" | "ping" | ...}
let _sse = null;
let _ssePollTimer = null;
let _sseStaleTimer = null;
let _sseLastData = Date.now();

function _setConnection(state) {
  if (store.connection !== state) {
    store.connection = state;
    if (state === 'live') store.lastPing = Date.now();
    notify();
  }
}

function _sseAuthUrl() {
  return '/api/events' + (AUTH ? ('?token=' + encodeURIComponent(AUTH)) : '');
}

function startRealSSE() {
  if (_sse) try { _sse.close(); } catch (e) {}
  if (typeof EventSource === 'undefined') {
    // fallback only
    _setConnection('reconnecting');
    _startPolling();
    return;
  }

  _sse = new EventSource(_sseAuthUrl());
  _setConnection('reconnecting');

  _sse.onopen = () => {
    _sseLastData = Date.now();
    _setConnection('live');
    refreshSessions();
    _ensureStaleWatcher();
    _ensurePolling();
  };

  _sse.onerror = () => {
    _setConnection('reconnecting');
    // EventSource will auto-reconnect; we just bump UI state.
  };

  _sse.onmessage = (ev) => {
    _sseLastData = Date.now();
    if (store.connection !== 'live') _setConnection('live');
    if (!ev.data) return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.type === 'sessions') {
      const arr = (msg.payload || []).filter(s => !s.archived);
      store.sessions = arr.map(_normalize);
      notify();
    } else if (msg.type === 'ping') {
      // heartbeat — already updated _sseLastData
      store.lastPing = Date.now();
    } else if (msg.type === 'invalidate') {
      // refetch on demand if certain stores were invalidated
    }
  };
}

function _ensureStaleWatcher() {
  if (_sseStaleTimer) return;
  _sseStaleTimer = setInterval(() => {
    const silentMs = Date.now() - _sseLastData;
    if (silentMs > 18000 && store.connection === 'live') {
      _setConnection('reconnecting');
      try { _sse?.close(); } catch (e) {}
      _sse = null;
      // EventSource normally auto-reconnects; we force a fresh handle.
      setTimeout(startRealSSE, 200);
    }
  }, 4000);
}

function _ensurePolling() {
  if (_ssePollTimer) return;
  // Periodic refresh as belt-and-suspenders fallback (every 15s).
  _ssePollTimer = setInterval(() => {
    refreshSessions();
  }, 15000);
}

function _startPolling() {
  _ensurePolling();
  refreshSessions();
}

// Wake-up triggers — match the existing dashboard contract.
function _onClientResume() {
  if (Date.now() - _sseLastData > 4000) refreshSessions();
  if (store.connection !== 'live') startRealSSE();
}
['visibilitychange', 'pageshow', 'focus', 'online'].forEach(ev =>
  window.addEventListener(ev, _onClientResume));

// Legacy helper kept for compatibility (no-ops with real backend).
function startMockSSE() { startRealSSE(); }
function simulateConnection(state) { _setConnection(state); }

// Aggregate tokens
function totalTokens() {
  return store.sessions.reduce((sum, s) => sum + (s.tokens?.total || 0), 0);
}

// Time helpers
function fmtRel(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}
function fmtNum(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n/1_000).toFixed(1) + "k";
  return String(n);
}

Object.assign(window, {
  store, subscribe, notify, patchSession, pushToast,
  startMockSSE, simulateConnection, startRealSSE, refreshSessions,
  sendToSession, stopSession, wakeSession, archiveSession, duplicateSession, createSession,
  totalTokens, fmtRel, fmtNum,
  API_HEADERS, AMUX_AUTH: AUTH,
});

// Kick off immediately
refreshSessions();
startRealSSE();

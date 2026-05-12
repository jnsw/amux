/* Peek panel — session detail */

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP, useMemo: useMemoP } = React;

/* ── Claude-Code transcript renderer (cc-stream) ────────────────
   Heuristic line-walker that turns raw tmux Claude Code output into
   structured HTML — user pills, tool calls (● Name(args) + ⎿ result),
   status footers, prose, blanks. Ported from the legacy dashboard so
   /redesign shares the same render. */
function _ccEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _ccLinkify(text) {
  const urlRe = /(https?:\/\/[^\s<>'"`,;]+)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    out.push(_ccEsc(text.slice(last, m.index)));
    const url = m[1];
    out.push(`<a href="${_ccEsc(url)}" target="_blank" rel="noreferrer">${_ccEsc(url)}</a>`);
    last = m.index + m[0].length;
  }
  out.push(_ccEsc(text.slice(last)));
  return out.join('');
}
function _ccStripAnsi(text) {
  return String(text)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[=>]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}
const _CC_RULE_RE      = /^[\s]*[─━═━–—_]{6,}[\s]*$/;
const _CC_RULE_WORD_RE = /^[\s]*[─━═━–—_]{2,}\s+(.+?)\s+[─━═━–—_]{2,}[\s]*$/;
const _CC_TOOL_HEAD_RE = /^\s*[●•▶○⏺]\s+([A-Za-z][\w.\-]*)\(([\s\S]*)\)\s*$/;
const _CC_TOOL_HEAD_RUN_RE = /^\s*[●•▶○⏺]\s+([A-Za-z][\w.\-]*)\s*\.\.\.\s*$/;
const _CC_TOOL_CONT_RE = /^\s*(?:⎿|└|⌐)\s?(.*)$/;
const _CC_INDENT_RE    = /^(?:    |\t|  ⎿|  └|  ⌐)/;
const _CC_USER_RE      = /^\s*[❯>]\s+(\S.*)$/;
const _CC_STATUS_RE    = /^\s*[✻✺·]\s+([^\n]+)$/;
const _CC_FOOTER_RE    = /^\s*[➜→]\s+\S/;
const _CC_MODE_RE      = /^\s*[⏵▶]{1,2}\s+\S/;
const _CC_CURLAT_RE    = /^\s*current:\s.*latest:/i;
function _ccIsTuiFrameLine(line) {
  if (!line.trim()) return true;
  if (_CC_RULE_RE.test(line) || _CC_RULE_WORD_RE.test(line)) return true;
  if (/^\s*[❯>]\s*$/.test(line)) return true;
  if (_CC_FOOTER_RE.test(line) || _CC_MODE_RE.test(line) || _CC_CURLAT_RE.test(line)) return true;
  if (/^\s*\d[\d,]*\s+tokens\b/i.test(line)) return true;
  return false;
}
/* Strip the bottom-of-buffer TUI frame (box-drawing rule, empty prompt,
   footer status with ➜/⏵⏵/current/latest/tokens). These lines describe
   the live UI chrome, not the transcript, and are noise once we already
   render structured content. */
function _ccTrimTuiFrame(lines) {
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1].replace(/\r$/, '');
    if (_ccIsTuiFrameLine(line)) { end--; continue; }
    break;
  }
  return lines.slice(0, end);
}
function renderCCStream(rawText) {
  const text = rawText == null ? '' : String(rawText);
  if (!text.trim()) return '<div class="cc-stream"></div>';
  let lines = text.split('\n');
  /* Cap to last ~4000 lines for perf — long sessions blow up the DOM. */
  if (lines.length > 4000) lines = lines.slice(-4000);
  lines = _ccTrimTuiFrame(lines);
  if (!lines.length) return '<div class="cc-stream"></div>';
  const out = ['<div class="cc-stream">'];
  let i = 0;
  let consecutiveBlanks = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, '');
    if (!line.trim()) {
      if (consecutiveBlanks === 0) out.push('<span class="cc-blank"></span>');
      consecutiveBlanks++;
      i++;
      continue;
    }
    consecutiveBlanks = 0;
    /* Box-drawing section divider: collapse consecutive rule lines into one. */
    if (_CC_RULE_RE.test(line) || _CC_RULE_WORD_RE.test(line)) {
      let j = i;
      let label = '';
      while (j < lines.length) {
        const l = lines[j].replace(/\r$/, '');
        if (!l.trim()) { j++; continue; }
        const m = _CC_RULE_WORD_RE.exec(l);
        if (m && !label) label = m[1];
        if (_CC_RULE_RE.test(l) || _CC_RULE_WORD_RE.test(l)) { j++; continue; }
        break;
      }
      if (label) {
        out.push('<div class="cc-rule cc-rule--label"><span>' + _ccEsc(label) + '</span></div>');
      } else {
        out.push('<div class="cc-rule" aria-hidden="true"></div>');
      }
      i = j;
      continue;
    }
    const userM = _CC_USER_RE.exec(line);
    if (userM) {
      out.push('<div class="cc-userpill"><span class="chev">›</span>'
        + _ccLinkify(userM[1]) + '</div>');
      i++;
      continue;
    }
    const stM = _CC_STATUS_RE.exec(line);
    if (stM) {
      out.push('<div class="cc-status"><span class="star">✻</span>'
        + _ccLinkify(stM[1]) + '</div>');
      i++;
      continue;
    }
    /* Tool head — Name(args) or Name… (running, no args) */
    let tm = _CC_TOOL_HEAD_RE.exec(line);
    let runningHead = false;
    if (!tm) {
      const rm = _CC_TOOL_HEAD_RUN_RE.exec(line);
      if (rm) { tm = [line, rm[1], '']; runningHead = true; }
    }
    if (tm) {
      const name = tm[1];
      const args = tm[2];
      const contLines = [];
      let j = i + 1;
      let sawError = false;
      while (j < lines.length) {
        const nxt = lines[j].replace(/\r$/, '');
        if (!nxt.trim()) break;
        const cm = _CC_TOOL_CONT_RE.exec(nxt);
        if (cm) {
          if (/error|failed|exit\s+code/i.test(cm[1])) sawError = true;
          contLines.push(cm[1]); j++; continue;
        }
        if (_CC_INDENT_RE.test(nxt)) { contLines.push(nxt.replace(/^\s+/, '')); j++; continue; }
        break;
      }
      const state = runningHead ? 'run' : (sawError ? 'err' : 'ok');
      let head = '<div class="cc-tool"><div class="cc-tool__head">'
        + '<span class="cc-dot" data-state="' + state + '" aria-hidden="true"></span>'
        + '<span class="cc-tool__title"><span class="cc-tool__name">' + _ccEsc(name) + '</span>';
      if (args) {
        head += '<span class="cc-tool__args">'
          + '<span class="arg-paren">(</span>' + _ccLinkify(args) + '<span class="arg-paren">)</span>'
          + '</span>';
      } else if (runningHead) {
        head += '<span class="cc-tool__args cc-tool__args--run">…</span>';
      }
      head += '</span></div>';
      if (contLines.length) {
        head += '<div class="cc-tool__result">'
          + '<span class="cc-tool__cont" aria-hidden="true">⎿</span>'
          + '<div class="cc-tool__body"><div class="cc-lines">'
          + contLines.map(l => '<span class="ln">' + _ccLinkify(l) + '</span>').join('')
          + '</div></div></div>';
      }
      head += '</div>';
      out.push(head);
      i = j;
      continue;
    }
    out.push('<div class="cc-prose">' + _ccLinkify(line) + '</div>');
    i++;
  }
  out.push('</div>');
  return out.join('');
}

function PeekPanel({ name, onClose, onSwitch }) {
  const s = store.sessions.find((x) => x.name === name);
  const [tab, setTab] = useStateP("output");
  const [composer, setComposer] = useStateP("");
  const [steerMode, setSteerMode] = useStateP(false);
  const [fullscreen, setFullscreen] = useStateP(true);
  const [siderCollapsed, setSiderCollapsed] = useStateP(false);
  const [siderQuery, setSiderQuery] = useStateP("");
  useEffectP(() => { setFullscreen(true); }, [name]);
  const [searchOpen, setSearchOpen] = useStateP(false);
  const [query, setQuery] = useStateP("");
  const [activeMatch, setActiveMatch] = useStateP(0);
  const [splitOpen, setSplitOpen] = useStateP(false);
  const [focusMode, setFocusMode] = useStateP(false);
  const [historyOpen, setHistoryOpen] = useStateP(false);
  const [historyItems, setHistoryItems] = useStateP([]);
  const [steerText, setSteerText] = useStateP("");
  const [notesText, setNotesText] = useStateP("");
  const fileInputRef = useRefP(null);

  /* QuickKey "send directly" arming.
     First click on a /cmd button inserts the text + arms that button with
     a transient "Send directly" overlay. Second click on the same armed
     button (or a native double-click, which fires two clicks) sends the
     command immediately, bypassing the composer. Any of these disarm:
       - typing in the composer
       - clicking outside the qkeys row
       - switching tab/session
       - sending or queueing via the Send/Queue buttons or ⌘↵ / ⌘⇧↵
       - pressing any non-cmd qkey                                       */
  const [armedQk, setArmedQk] = useStateP(null);
  const qkeysRef = useRefP(null);

  useEffectP(() => { setArmedQk(null); }, [s?.name, tab]);
  useEffectP(() => {
    if (armedQk == null) return;
    function onDown(e) {
      if (qkeysRef.current && !qkeysRef.current.contains(e.target)) setArmedQk(null);
    }
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [armedQk]);

  useEffectP(() => {
    function onKey(e) {
      if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) setFullscreen(v => !v);
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) setSearchOpen(v => !v);
      if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [queued, setQueued] = useStateP([]);
  const outRef = useRefP(null);
  const scrollRef = useRefP(null);

  /* Full Claude Code transcript — fetched from ?full=1, rendered via cc-stream. */
  const [fullOutput, setFullOutput] = useStateP('');
  const [outputLoading, setOutputLoading] = useStateP(false);

  useEffectP(() => {
    if (tab !== 'output' || !s?.name) return;
    let cancelled = false;
    setOutputLoading(true);
    fetch(`/api/sessions/${encodeURIComponent(s.name)}/peek?lines=600`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (!cancelled) setFullOutput(j?.output || ''); })
      .catch(() => { /* network blip — keep previous output */ })
      .finally(() => { if (!cancelled) setOutputLoading(false); });
    return () => { cancelled = true; };
  }, [s?.name, s?.previewBump, tab]);

  const ccHTML = useMemoP(
    () => renderCCStream(_ccStripAnsi(fullOutput)),
    [fullOutput]
  );

  /* Always snap to bottom after every transcript update so the latest
     Claude Code output is visible without manual scrolling. rAF gives
     dangerouslySetInnerHTML a tick to lay out before we measure. */
  useEffectP(() => {
    if (tab !== 'output') return;
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [ccHTML, tab, fullscreen]);

  const matches = useMemoP(() => {
    if (!query.trim() || !s?.preview) return [];
    const q = query.toLowerCase();
    return s.preview.reduce((acc, line, i) => {
      if (line.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [query, s?.preview]);

  function jumpMatch(dir) {
    if (!matches.length) return;
    const next = (activeMatch + dir + matches.length) % matches.length;
    setActiveMatch(next);
    const lineEl = outRef.current?.querySelector(`[data-idx="${matches[next]}"]`);
    if (lineEl) lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  if (!s) return null;

  const tabs = [
    { id: "output",   label: "Output" },
    { id: "steering", label: "Steering" },
    { id: "tasks",    label: "Tasks", count: s.task ? 1 : 0 },
    { id: "issues",   label: "Issues" },
    { id: "worktree", label: "Worktree" },
    { id: "commits",  label: "Commits" },
    { id: "schedules",label: "Schedules" },
    { id: "files",    label: "Files" },
    { id: "notes",    label: "Notes" },
    { id: "memory",   label: "Memory" },
  ];

  async function send() {
    const text = composer.trim();
    if (!text) return;
    setArmedQk(null);
    if (steerMode) {
      pushToast(`Steer set for ${s.name}`);
      setComposer("");
      return;
    }
    setComposer("");
    patchSession(s.name, {
      preview: [...s.preview.slice(-1), `> ${text}`, "thinking…"],
      previewBump: Date.now(),
      status: "active",
      last_activity: Date.now()
    });
    try {
      await sendToSession(s.name, text);
      pushToast(`Sent to ${s.name}`);
    } catch (err) {
      pushToast(`Send failed: ${err.message}`, 'error');
    }
  }

  function queue() {
    if (!composer.trim()) return;
    setQueued((q) => [...q, composer]);
    pushToast(`Queued for ${s.name}`);
    setComposer("");
    setArmedQk(null);
  }

  /* Send a /cmd directly (used when its qkey is double-clicked or
     armed-then-clicked-again). Bypasses the composer. */
  async function sendCmdDirect(cmdText) {
    setArmedQk(null);
    patchSession(s.name, {
      preview: [...s.preview.slice(-1), `> ${cmdText}`, "thinking…"],
      previewBump: Date.now(),
      status: "active",
      last_activity: Date.now()
    });
    try {
      await sendToSession(s.name, cmdText);
      pushToast(`Sent ${cmdText} to ${s.name}`);
    } catch (err) {
      pushToast(`Send failed: ${err.message}`, 'error');
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(s.name)}/history`, { headers: API_HEADERS });
      if (r.ok) setHistoryItems(await r.json());
    } catch (_) {}
  }

  async function attachFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await fetch(`/api/sessions/${encodeURIComponent(s.name)}/attach`, { method: 'POST', headers: API_HEADERS, body: fd });
      pushToast(`Attached ${file.name}`);
    } catch (err) {
      pushToast(`Attach failed: ${err.message}`, 'error');
    }
  }

  return (
    <aside className="peek" data-fullscreen={fullscreen ? '1' : '0'} role="dialog" aria-label={`Session ${s.name}`}>
      {fullscreen && (
        <aside className="peek__sider" data-collapsed={siderCollapsed ? '1' : '0'} aria-label="Sessions">
          <div className="peek__sider__head">
            <button className="btn btn--icon btn--ghost btn--sm"
              title={siderCollapsed ? "Expand session list" : "Collapse session list"}
              onClick={() => setSiderCollapsed(v => !v)}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d={siderCollapsed ? "M6 4l4 4-4 4" : "M10 4L6 8l4 4"}/>
              </svg>
            </button>
            {!siderCollapsed && (
              <>
                <span className="peek__sider__title">Sessions</span>
                <span className="faint" style={{fontSize:11}}>{store.sessions.length}</span>
              </>
            )}
          </div>
          {!siderCollapsed && (
            <>
              <div style={{padding:'6px 8px', borderBottom:'1px solid var(--border)'}}>
                <input
                  className="input"
                  style={{height:24, fontSize:12, width:'100%'}}
                  placeholder="Filter…"
                  value={siderQuery}
                  onChange={(e) => setSiderQuery(e.target.value)}
                />
              </div>
              <div className="peek__sider__list">
                {store.sessions
                  .filter(x => !siderQuery || x.name.toLowerCase().includes(siderQuery.toLowerCase()))
                  .map(x => (
                  <button
                    key={x.name}
                    className="peek__sider__item"
                    aria-current={x.name === name ? 'page' : undefined}
                    onClick={() => onSwitch && onSwitch(x.name)}
                    title={x.name}>
                    <StatusDot status={x.status} />
                    <span className="peek__sider__name">{x.name}</span>
                    {x.status === 'active' && <span className="dot dot--active" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
      <div className="peek__main">
      <div className="peek__head">
        <StatusDot status={s.status} />
        <span className="peek__name truncate">{s.name}</span>
        {!focusMode && <span className="pill">{s.provider}</span>}

        <button className="btn btn--icon btn--ghost btn--sm" title="Search (S)" aria-pressed={searchOpen}
          onClick={() => setSearchOpen(v => !v)}>
          {I.search}
        </button>
        <button className="btn btn--icon btn--ghost btn--sm" title="Split file browser" aria-pressed={splitOpen}
          onClick={() => setSplitOpen(v => !v)}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M9 2.5v11"/>
          </svg>
        </button>
        <button className="btn btn--icon btn--ghost btn--sm" title="Focus mode (hides chrome)" aria-pressed={focusMode}
          onClick={() => setFocusMode(v => !v)}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r="5.5"/>
          </svg>
        </button>
        <button className="btn btn--icon btn--ghost btn--sm" title="Copy all output"
          onClick={() => { navigator.clipboard.writeText((s.preview || []).join('\n')); pushToast('Output copied'); }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="9" height="9" rx="1"/><path d="M11 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"/>
          </svg>
        </button>

        <button className="btn btn--ghost btn--sm peek__fs" onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} aria-pressed={fullscreen}>
          {fullscreen ? I.minimize : I.maximize}
          <span>{fullscreen ? "Exit" : "Expand"}</span>
        </button>
        <button className="btn btn--icon btn--ghost" onClick={onClose} title="Close (Esc)">{I.close}</button>
      </div>

      <div className="peek__tabs" role="tablist" style={focusMode ? { display: 'none' } : {}}>
        {tabs.map((t) =>
        <div key={t.id} className="peek__tab"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}>
          {t.label}{t.count ? <span className="faint" style={{ marginLeft: 6, fontSize: 10 }}>{t.count}</span> : null}
        </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className="peek__body" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {tab === "output" && searchOpen && (
            <div className="peek__search" style={{ display: 'flex', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
              <input className="input" style={{ height: 26, fontSize: 12, flex: 1 }}
                placeholder="Search output…  Enter = next  ⇧Enter = prev"
                value={query} onChange={(e) => setQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); jumpMatch(+1); }
                  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); jumpMatch(-1); }
                  if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); }
                }} />
              <span className="faint" style={{ fontSize: 11, alignSelf: 'center' }}>
                {matches.length ? `${activeMatch + 1}/${matches.length}` : '0/0'}
              </span>
              <button className="btn btn--icon btn--ghost btn--sm" title="Previous (⇧↵)" onClick={() => jumpMatch(-1)}>↑</button>
              <button className="btn btn--icon btn--ghost btn--sm" title="Next (↵)" onClick={() => jumpMatch(+1)}>↓</button>
              <button className="btn btn--icon btn--ghost btn--sm" title="Close (Esc)" onClick={() => { setQuery(''); setSearchOpen(false); }}>{I.close}</button>
            </div>
          )}

          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
            {tab === "output" && (
              <div className="peek__output" ref={outRef}>
                <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>
                  {`╭─ ${s.cwd || '?'} ${s.branch ? 'on ' + s.branch + ' ' : ''}─ ${s.provider}${s.model ? '/' + s.model : ''}`}
                </div>
                {fullOutput ? (
                  <div dangerouslySetInnerHTML={{ __html: ccHTML }} />
                ) : outputLoading ? (
                  <div className="dim">loading transcript…</div>
                ) : (
                  <div className="dim">no recent output — try sending a message below</div>
                )}
                <div style={{ marginTop: 10 }}>
                  <a href={`/legacy?session=${encodeURIComponent(s.name)}`} target="_blank" rel="noreferrer" className="faint" style={{ fontSize: 11 }}>open full transcript in legacy view ↗</a>
                </div>
              </div>
            )}

            {tab === "steering" && (
              <div className="col" style={{ gap: 10 }}>
                <div className="dim" style={{ fontSize: 11 }}>Steer hint — injected at next tool call boundary</div>
                <textarea className="composer__area" style={{ minHeight: 120 }}
                  placeholder="Steer hint…"
                  value={steerText} onChange={(e) => setSteerText(e.target.value)} />
                <button className="btn btn--primary" style={{ alignSelf: 'flex-end' }}
                  onClick={async () => {
                    try {
                      await fetch(`/api/sessions/${encodeURIComponent(s.name)}/steer`, {
                        method: 'POST',
                        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ steer: steerText }),
                      });
                      pushToast(`Steer saved for ${s.name}`);
                    } catch (err) {
                      pushToast(`Save failed: ${err.message}`, 'error');
                    }
                  }}>
                  {I.steer}<span>Save steer</span>
                </button>
              </div>
            )}

            {tab === "tasks" && (
              <div className="col" style={{ gap: 8 }}>
                {s.task ?
                  <div className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      <span className="pill pill--accent">{s.task.id}</span>
                      <span className="dim" style={{ fontSize: 11 }}>doing · {s.task.elapsed}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.task.title}</div>
                    <div className="hairline" style={{ margin: '10px 0' }}></div>
                    <div className="dim" style={{ fontSize: 12 }}>3 of 5 sub-tasks done · auto-complete on idle</div>
                  </div> :
                  <div className="empty" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 14 }}>No active task</h3>
                    <p>Assign a board issue to this session and it'll show here.</p>
                  </div>
                }
                <div className="dim" style={{ fontSize: 11, padding: '4px 2px' }}>Queued</div>
                <div className="card row" style={{ padding: '8px 10px', gap: 8 }}>
                  <input type="checkbox" />
                  <span style={{ fontSize: 13 }}>Write migration for token-expiry column</span>
                </div>
                <div className="card row" style={{ padding: '8px 10px', gap: 8 }}>
                  <input type="checkbox" />
                  <span style={{ fontSize: 13 }}>Document PKCE flow in /docs/auth.md</span>
                </div>
              </div>
            )}

            {tab === "issues" && (
              <div className="col" style={{ gap: 10 }}>
                <div className="empty" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14 }}>No board issues assigned</h3>
                  <p>Link a board issue to track it here.</p>
                  <button className="btn btn--ghost" style={{ marginTop: 8 }}>Assign issue</button>
                </div>
              </div>
            )}

            {tab === "worktree" && (
              <div className="col" style={{ gap: 10 }}>
                <div className="empty" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14 }}>Worktree</h3>
                  <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>git status would render here</p>
                  <button className="btn btn--ghost" style={{ marginTop: 8 }}
                    onClick={() => pushToast('Worktree refresh requested')}>Refresh</button>
                </div>
              </div>
            )}

            {tab === "commits" && (
              <div className="col" style={{ gap: 10 }}>
                <div className="empty" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14 }}>Recent commits</h3>
                  <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}>Last 10 commits would render here</p>
                  <button className="btn btn--ghost" style={{ marginTop: 8 }}
                    onClick={() => pushToast('Commits refresh requested')}>Refresh</button>
                </div>
              </div>
            )}

            {tab === "schedules" && (
              <div className="col" style={{ gap: 8 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>Daily test run</strong>
                    <span className="spacer"></span>
                    <span className="pill pill--ok">enabled</span>
                  </div>
                  <div className="mono dim" style={{ fontSize: 11, marginTop: 4 }}>daily at 09:00</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>Next run: tomorrow 09:00 (in 14h)</div>
                </div>
                <button className="btn btn--ghost" style={{ justifyContent: 'center', width: '100%' }}>{I.plus}<span>New schedule</span></button>
              </div>
            )}

            {tab === "files" && (
              <div className="empty" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 14 }}>Workspace browser</h3>
                <p>Files in {s.cwd} would render here.</p>
              </div>
            )}

            {tab === "notes" && (
              <div className="col" style={{ gap: 10 }}>
                <div className="dim" style={{ fontSize: 11 }}>Session notes</div>
                <textarea className="composer__area" style={{ minHeight: 200, fontFamily: 'var(--ff-mono)', fontSize: 12 }}
                  placeholder="Notes for this session…"
                  value={notesText} onChange={(e) => setNotesText(e.target.value)} />
                <button className="btn btn--primary" style={{ alignSelf: 'flex-end' }}
                  onClick={async () => {
                    try {
                      await fetch(`/api/sessions/${encodeURIComponent(s.name)}/notes`, {
                        method: 'POST',
                        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: notesText }),
                      });
                      pushToast('Notes saved');
                    } catch (err) {
                      pushToast(`Save failed: ${err.message}`, 'error');
                    }
                  }}>
                  {I.send}<span>Save</span>
                </button>
              </div>
            )}

            {tab === "memory" && (
              <div className="col" style={{ gap: 8 }}>
                <div className="dim" style={{ fontSize: 11 }}>Session memory</div>
                <textarea className="composer__area" style={{ minHeight: 200, fontFamily: 'var(--ff-mono)', fontSize: 12 }}
                  defaultValue={`# ${s.name}\n\nProject: ${s.cwd}\nBranch: ${s.branch}\nProvider: ${s.provider} / ${s.model}\n\n## Conventions\n- 4-space indent\n- pytest for tests\n- conventional commits\n\n## Current focus\n${s.task ? s.task.title : '—'}`} />
              </div>
            )}
          </div>
        </div>

        {splitOpen && tab === 'output' && (
          <aside className="peek__split" style={{ borderLeft: '1px solid var(--border)', width: 240, overflowY: 'auto', padding: 8, fontSize: 12, fontFamily: 'var(--ff-mono)', flexShrink: 0 }}>
            <div className="dim" style={{ marginBottom: 6 }}>Files in {s.cwd}</div>
            <div className="dim">(file browser stub — wired in legacy at <code>/api/files?dir=…</code>)</div>
          </aside>
        )}
      </div>

      {tab === "output" && (
        <div className="peek__composer">
          <QuickKeys
            armedIdx={armedQk}
            qkeysRef={qkeysRef}
            onPress={async (payload, idx) => {
            if (payload.kind === 'key') {
              setArmedQk(null);
              const KEY_MAP = {
                'Esc': 'escape', '↑': 'up', '↓': 'down', '←': 'left', '→': 'right',
                'Tab': 'tab', '⇧Tab': 'shift-tab', '↵': 'enter',
              };
              const k = KEY_MAP[payload.label];
              if (k) {
                try {
                  await fetch(`/api/sessions/${encodeURIComponent(s.name)}/keys`, {
                    method: 'POST',
                    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys: [k] }),
                  });
                  pushToast(`Sent ${payload.label} to ${s.name}`);
                } catch (err) {
                  pushToast(`Key send failed: ${err.message}`, 'error');
                }
              }
            } else if (payload.kind === 'cmd') {
              if (armedQk === idx) {
                // Second click on the armed qkey (or 2nd of a native dblclick):
                // send the command directly, bypass composer.
                await sendCmdDirect(payload.text);
              } else {
                // First click: insert into composer and arm.
                setComposer((c) => (c ? c.replace(/\s*$/, ' ') : '') + payload.text + ' ');
                setArmedQk(idx);
              }
            } else if (payload.kind === 'text') {
              setArmedQk(null);
              setComposer((c) => (c ? c + ' ' : '') + payload.text);
            }
          }} />
          <textarea
            className="composer__area"
            placeholder={steerMode ? "Steer hint (injected on next tool call)…" : "Send a message…   ⌘↵ to send"}
            value={composer}
            onChange={(e) => { setComposer(e.target.value); if (armedQk != null) setArmedQk(null); }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') { e.preventDefault(); queue(); }
              else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
            }} />

          {queued.length > 0 && (
            <div className="queue-strip">
              <span className="queue-strip__label">{I.steer}<span>Queued · {queued.length}</span></span>
              {queued.map((q, i) => (
                <span key={i} className="queue-strip__chip" title={q}>
                  <span className="truncate" style={{ maxWidth: 160 }}>{q}</span>
                  <button className="queue-strip__x" onClick={() => setQueued(qs => qs.filter((_, j) => j !== i))} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="composer__row">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => attachFile(e.target.files?.[0])} />
            <button className="btn btn--ghost btn--icon btn--sm" title="Attach file" onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 7.5L7.5 13A4 4 0 0 1 2 7.5L8 1.5A2.5 2.5 0 0 1 12 5.5L6 11.5A1 1 0 0 1 4.5 10L10 4.5"/>
              </svg>
            </button>
            <button className="btn btn--ghost btn--icon btn--sm" title="Message history" onClick={openHistory}>{I.clock}</button>
            <button className="steer-toggle" aria-pressed={steerMode} onClick={() => setSteerMode((v) => !v)}>
              {I.steer}
              <span>Steer</span>
            </button>
            <span className="spacer"></span>
            <span className="composer__hint" aria-hidden="true">
              <span className="kbd">⌘</span><span className="kbd">⇧</span><span className="kbd">↵</span>
              <span style={{ opacity: .55, margin: '0 6px 0 4px' }}>queue</span>
              <span className="kbd">⌘</span><span className="kbd">↵</span>
              <span style={{ opacity: .55, marginLeft: 4 }}>send</span>
            </span>
            <button className="btn btn--ghost" onClick={queue} title="Queue (⌘⇧↵)">
              <span>Queue</span>
            </button>
            <button className="btn btn--primary" onClick={send} title="Send (⌘↵)">
              {I.send}<span>{steerMode ? "Set steer" : "Send"}</span>
            </button>
          </div>
        </div>
      )}
      </div>{/* /peek__main */}

      {historyOpen && (
        <div className="modal" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in oklch, var(--bg) 70%, transparent)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <div className="card" style={{ width: 'min(420px, 92vw)', maxHeight: '60vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
            <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
              <strong style={{ flex: 1, fontSize: 14 }}>Message history</strong>
              <button className="btn btn--icon btn--ghost btn--sm" onClick={() => setHistoryOpen(false)}>{I.close}</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {historyItems.length === 0 ? (
                <div className="dim" style={{ padding: 16, fontSize: 13, textAlign: 'center' }}>No history available</div>
              ) : historyItems.map((item, i) => (
                <div key={i} className="palette__item" style={{ cursor: 'pointer', borderRadius: 'var(--r-sm)' }}
                  onClick={() => { setComposer(item.text || item); setHistoryOpen(false); }}>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }} className="truncate">{item.text || item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

window.PeekPanel = PeekPanel;

/* QuickKeys — pressable row of keycaps above composer.
   Each item: { label, icon?, kind: 'key'|'cmd'|'text', text?, variant? }
   armedIdx: index of a cmd button that is "armed" (next click sends directly).
   qkeysRef:   parent ref so outside-click detection can target this row. */
function QuickKeys({ onPress, armedIdx, qkeysRef }) {
  const t = window.AppTweaks || {};
  if (t.showQuickKeys === false) return null;

  const KEYS = [
    { kind:'key',  label:'Esc',  hint:'Esc' },
    { kind:'key',  label:'↑',    hint:'Up'  },
    { kind:'key',  label:'↓',    hint:'Down' },
    { kind:'key',  label:'←',    hint:'Left' },
    { kind:'key',  label:'→',    hint:'Right' },
    { kind:'key',  label:'Tab',  hint:'Tab' },
    { kind:'key',  label:'⇧Tab', hint:'Shift+Tab' },
    { kind:'key',  label:'↵',    hint:'Return' },
    { kind:'cmd',  label:'/compact', text:'/compact', variant:'slash' },
    { kind:'cmd',  label:'/clear',   text:'/clear',   variant:'slash' },
    { kind:'cmd',  label:'/resume',  text:'/resume',  variant:'slash' },
    { kind:'cmd',  label:'/memory',  text:'/memory',  variant:'slash' },
    { kind:'text', label:'yes',     text:'yes' },
    { kind:'text', label:'no',      text:'no',       variant:'danger' },
  ];

  return (
    <div className="qkeys" role="toolbar" aria-label="Quick keys" ref={qkeysRef}>
      {KEYS.map((k, i) => {
        const armed = armedIdx === i && k.kind === 'cmd';
        return (
          <button
            key={i}
            type="button"
            className={`qkey${k.variant ? ` qkey--${k.variant}` : ''}${armed ? ' qkey--armed' : ''}`}
            title={armed ? `Click again to send ${k.text} directly` : (k.hint || k.text || k.label)}
            aria-pressed={armed || undefined}
            onClick={() => onPress(k, i)}>
            <span className="qkey__label">{k.label}</span>
            {armed && <span className="qkey__send" aria-hidden="true">Send directly ↵</span>}
          </button>
        );
      })}
    </div>
  );
}
window.QuickKeys = QuickKeys;

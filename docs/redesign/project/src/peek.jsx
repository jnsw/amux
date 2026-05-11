/* Peek panel — session detail */

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

function PeekPanel({ name, onClose }) {
  const s = store.sessions.find((x) => x.name === name);
  const [tab, setTab] = useStateP("output");
  const [composer, setComposer] = useStateP("");
  const [steerMode, setSteerMode] = useStateP(false);
  const [fullscreen, setFullscreen] = useStateP(false);
  useEffectP(() => {
    function onKey(e) {
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        setFullscreen(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [queued, setQueued] = useStateP([]);
  const outRef = useRefP(null);

  useEffectP(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [s?.previewBump, tab]);

  if (!s) return null;

  const tabs = [
  { id: "output", label: "Output" },
  { id: "tasks", label: "Tasks", count: s.task ? 1 : 0 },
  { id: "schedules", label: "Schedules" },
  { id: "files", label: "Files" },
  { id: "memory", label: "Memory" }];


  async function send() {
    const text = composer.trim();
    if (!text) return;
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
  }

  return (
    <aside className="peek" data-fullscreen={fullscreen ? '1' : '0'} role="dialog" aria-label={`Session ${s.name}`}>
      <div className="peek__head">
        <StatusDot status={s.status} />
        <span className="peek__name truncate" data-comment-anchor="3dbe504bfb-span-46-9">{s.name}</span>
        <span className="pill">{s.provider}</span>
        <button className="btn btn--ghost btn--sm peek__fs" onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} aria-pressed={fullscreen}>
          {fullscreen ? I.minimize : I.maximize}
          <span>{fullscreen ? "Exit" : "Expand"}</span>
        </button>
        <button className="btn btn--icon btn--ghost" onClick={onClose} title="Close (Esc)">{I.close}</button>
      </div>

      <div className="peek__tabs" role="tablist">
        {tabs.map((t) =>
        <div key={t.id} className="peek__tab"
        role="tab"
        aria-selected={tab === t.id}
        onClick={() => setTab(t.id)}>
          {t.label}{t.count ? <span className="faint" style={{ marginLeft: 6, fontSize: 10 }}>{t.count}</span> : null}</div>
        )}
      </div>

      <div className="peek__body">
        {tab === "output" &&
        <div className="peek__output" ref={outRef}>
            <div>{`╭─ ${s.cwd || '?'} ${s.branch ? 'on ' + s.branch + ' ' : ''}─ ${s.provider}${s.model ? '/' + s.model : ''}`}</div>
            <div>│</div>
            {(s.preview && s.preview.length > 0) ? s.preview.map((line, i) => (
              <div key={i}>{line || ' '}</div>
            )) : (
              <div className="dim">no recent output — try sending a message below</div>
            )}
            <div style={{marginTop: 10}}><a href={`/legacy?session=${encodeURIComponent(s.name)}`} target="_blank" rel="noreferrer" className="faint" style={{fontSize: 11}}>open full transcript in legacy view ↗</a></div>
          </div>
        }
        {tab === "tasks" &&
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
        }
        {tab === "schedules" &&
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
        }
        {tab === "files" &&
        <div className="empty" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14 }}>Workspace browser</h3>
            <p>Files in {s.cwd} would render here.</p>
          </div>
        }
        {tab === "memory" &&
        <div className="col" style={{ gap: 8 }}>
            <div className="dim" style={{ fontSize: 11 }}>Session memory</div>
            <textarea className="composer__area" style={{ minHeight: 200, fontFamily: 'var(--ff-mono)', fontSize: 12 }}
          defaultValue={`# ${s.name}\n\nProject: ${s.cwd}\nBranch: ${s.branch}\nProvider: ${s.provider} / ${s.model}\n\n## Conventions\n- 4-space indent\n- pytest for tests\n- conventional commits\n\n## Current focus\n${s.task ? s.task.title : '—'}`} />
          
          </div>
        }
      </div>

      {tab === "output" &&
      <div className="peek__composer">
          <QuickKeys onPress={async (payload) => {
            if (payload.kind === 'key') {
              // Map quick key labels to control sequences understood by amux /keys
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
              setComposer((c) => (c ? c.replace(/\s*$/, ' ') : '') + payload.text + ' ');
            } else if (payload.kind === 'text') {
              setComposer((c) => (c ? c + ' ' : '') + payload.text);
            }
          }} />
          <textarea
          className="composer__area"
          placeholder={steerMode ? "Steer hint (injected on next tool call)…" : "Send a message…   ⌘↵ to send"}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {e.preventDefault();queue();}
            else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {e.preventDefault();send();}
          }} />
        
          {queued.length > 0 && (
            <div className="queue-strip">
              <span className="queue-strip__label">{I.steer}<span>Queued · {queued.length}</span></span>
              {queued.map((q, i) => (
                <span key={i} className="queue-strip__chip" title={q}>
                  <span className="truncate" style={{ maxWidth: 160 }}>{q}</span>
                  <button className="queue-strip__x" onClick={() => setQueued(qs => qs.filter((_,j) => j !== i))} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="composer__row">
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
      }
    </aside>);

}

window.PeekPanel = PeekPanel;

/* QuickKeys — pressable row of keycaps above composer.
   Each item: { label, icon?, kind: 'key'|'cmd'|'text', text?, variant? } */
function QuickKeys({ onPress }) {
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
    <div className="qkeys" role="toolbar" aria-label="Quick keys">
      {KEYS.map((k, i) => (
        <button
          key={i}
          type="button"
          className={`qkey${k.variant ? ` qkey--${k.variant}` : ''}`}
          title={k.hint || k.text || k.label}
          onClick={() => onPress(k)}>
          {k.label}
        </button>
      ))}
    </div>
  );
}
window.QuickKeys = QuickKeys;
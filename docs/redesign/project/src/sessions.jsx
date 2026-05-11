/* Sessions tab + Session card */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

function StatusDot({ status }) {
  return <span className={`dot dot--${status}`} aria-label={status}></span>;
}

function MoreMenu({ s, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function act(e, fn) {
    e.stopPropagation();
    onClose();
    try { await fn(); } catch (err) { pushToast('Failed: ' + err.message, 'error'); }
  }

  const enc = encodeURIComponent(s.name);

  const items = [
    {
      label: '⊙ Info',
      fn: async () => pushToast('Info: ' + JSON.stringify(s._raw).slice(0, 120)),
    },
    {
      label: s.pinned ? '▣ Unpin' : '▣ Pin',
      fn: async () => {
        await fetch('/api/sessions/' + enc + '/pin', { method: s.pinned ? 'DELETE' : 'POST', headers: API_HEADERS });
        refreshSessions();
        pushToast(s.pinned ? 'Unpinned ' + s.name : 'Pinned ' + s.name);
      },
    },
    {
      label: '✎ Rename…',
      fn: async () => {
        const n = prompt('New name', s.name);
        if (n && n !== s.name) {
          await fetch('/api/sessions/' + enc + '/rename', { method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) });
          refreshSessions();
          pushToast('Renamed to ' + n);
        }
      },
    },
    {
      label: '▾ Change model…',
      fn: async () => {
        const m = prompt('New model', s.model);
        if (m) {
          await fetch('/api/sessions/' + enc + '/model', { method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) });
          refreshSessions();
          pushToast('Model updated');
        }
      },
    },
    {
      label: '⚡ Toggle YOLO',
      fn: async () => {
        const r = await fetch('/api/sessions/' + enc + '/yolo', { method: 'POST', headers: API_HEADERS });
        const data = r.ok ? await r.json().catch(() => null) : null;
        pushToast(data?.yolo ? 'YOLO enabled' : 'YOLO disabled');
        refreshSessions();
      },
    },
    {
      label: '✎ Edit description…',
      fn: async () => {
        const d = prompt('Description', s._raw?.desc || '');
        if (d !== null) {
          await fetch('/api/sessions/' + enc + '/desc', { method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ desc: d }) });
          refreshSessions();
          pushToast('Description updated');
        }
      },
    },
    {
      label: '# Edit tags…',
      fn: async () => {
        const t = prompt('Tags (comma-separated)', (s._raw?.tags || []).join(', '));
        if (t !== null) {
          const tags = t.split(',').map(x => x.trim()).filter(Boolean);
          await fetch('/api/sessions/' + enc + '/tags', { method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) });
          refreshSessions();
          pushToast('Tags updated');
        }
      },
    },
    {
      label: '⌂ Change directory…',
      fn: async () => {
        const d = prompt('New directory', s.cwd);
        if (d && d !== s.cwd) {
          await fetch('/api/sessions/' + enc + '/dir', { method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: d }) });
          refreshSessions();
          pushToast('Directory updated');
        }
      },
    },
    { sep: true },
    {
      label: '↻ Restart',
      fn: async () => {
        pushToast('Restarting ' + s.name + '…');
        await fetch('/api/sessions/' + enc + '/restart', { method: 'POST', headers: API_HEADERS });
        refreshSessions();
      },
    },
    {
      label: '⌫ Clear scrollback',
      fn: async () => {
        await fetch('/api/sessions/' + enc + '/clear', { method: 'POST', headers: API_HEADERS });
        pushToast('Cleared scrollback');
      },
    },
    {
      label: '⎘ Clone & continue',
      fn: async () => {
        await fetch('/api/sessions/' + enc + '/clone', { method: 'POST', headers: API_HEADERS });
        refreshSessions();
        pushToast('Cloned ' + s.name);
      },
    },
    {
      label: '+ New conversation',
      fn: async () => {
        await fetch('/api/sessions/' + enc + '/new-conversation', { method: 'POST', headers: API_HEADERS });
        pushToast('New conversation started');
      },
    },
    { sep: true },
    {
      label: '↗ Copy share link',
      fn: async () => {
        await navigator.clipboard.writeText(location.origin + '/legacy?session=' + enc);
        pushToast('Link copied');
      },
    },
    {
      label: '$ Copy mosh command',
      fn: async () => {
        await navigator.clipboard.writeText('mosh ' + s.name);
        pushToast('Copied mosh command');
      },
    },
    { sep: true },
    {
      label: '✕ Delete…',
      danger: true,
      fn: async () => {
        if (!confirm('Delete session "' + s.name + '"? This cannot be undone.')) return;
        await fetch('/api/sessions/' + enc, { method: 'DELETE', headers: API_HEADERS });
        refreshSessions();
        pushToast('Deleted ' + s.name);
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 4,
        zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,.3)',
        minWidth: 200,
        overflow: 'hidden',
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.sep ? (
          <div key={i} className="hairline" style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
        ) : (
          <button
            key={i}
            onClick={(e) => act(e, item.fn)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: item.danger ? 'var(--err)' : 'var(--text)',
              background: 'transparent',
              border: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

function SessionCard({ s, selected, onSelect, layout }) {
  const previewRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = previewRef.current.scrollHeight;
  }, [s.previewBump]);

  const lastLineKey = s.preview[s.preview.length - 1] + (s.previewBump || 0);
  const showTokens = window.AppTweaks?.showTokens !== false;

  const stopAction = (e, fn) => { e.stopPropagation(); fn(); };

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div
      className="scard"
      data-status={s.status}
      data-selected={selected ? "1" : "0"}
      onClick={() => onSelect(s.name)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.name); } }}
    >
      <div className="scard__head">
        <StatusDot status={s.status} />
        <span className="scard__name truncate">{s.name}</span>
        <span className="scard__provider">{s.provider}·{s.model}</span>
      </div>

      <div className="scard__path">
        {I.folder}
        <span className="truncate">{s.cwd}</span>
        {s.branch && s.branch !== "—" && (
          <span className="pill" title="branch">
            {I.branch}
            <span style={{marginLeft: 2}}>{s.branch}</span>
          </span>
        )}
      </div>

      {s.status === "stopped" ? (
        <div className="scard__preview scard__preview--empty">Stopped — wake to resume</div>
      ) : s.preview.length === 0 ? (
        <div className="scard__preview scard__preview--empty">No output yet</div>
      ) : (
        <div className="scard__preview" ref={previewRef}>
          {s.preview.map((line, i) => (
            <span
              key={i === s.preview.length - 1 ? lastLineKey : `${s.name}-${i}`}
              className={`line ${i === s.preview.length - 1 && s.previewBump ? 'line--new' : ''}`}
            >{line || ' '}</span>
          ))}
        </div>
      )}

      {s.task && (
        <div className="scard__task">
          {I.bolt}
          <span>{s.task.id}</span>
          <strong className="truncate" style={{flex: 1, minWidth: 0}}>{s.task.title}</strong>
          <span className="faint" style={{fontSize: 10}}>{s.task.elapsed}</span>
        </div>
      )}

      <div className="scard__foot">
        {showTokens && (
          <span className="scard__metric" title="tokens (input+output+cached)">
            {I.token}
            <span>{fmtNum(s.tokens.total)}</span>
          </span>
        )}
        <span className="scard__metric" title="last activity">
          {I.clock}
          <span>{fmtRel(s.last_activity)} ago</span>
        </span>

        <div className="scard__actions" style={{position: 'relative'}}>
          {s.status !== "stopped" ? (
            <>
              <button className="scard__action" title="Open"
                onClick={(e) => stopAction(e, () => onSelect(s.name))}>{I.steer}</button>
              <button className="scard__action" title="Stop"
                onClick={(e) => stopAction(e, async () => {
                  patchSession(s.name, { status: 'stopped' });
                  pushToast(`Stopping ${s.name}…`);
                  try { await stopSession(s.name); pushToast(`Stopped ${s.name}`); }
                  catch (err) { pushToast(`Stop failed: ${err.message}`, 'error'); refreshSessions(); }
                })}>{I.stop}</button>
            </>
          ) : (
            <button className="scard__action" title="Wake"
              onClick={(e) => stopAction(e, async () => {
                patchSession(s.name, { status: 'idle' });
                pushToast(`Waking ${s.name}…`);
                try { await wakeSession(s.name); pushToast(`Woke ${s.name}`); refreshSessions(); }
                catch (err) { pushToast(`Wake failed: ${err.message}`, 'error'); refreshSessions(); }
              })}>{I.bolt}</button>
          )}
          <button className="scard__action" title="Duplicate"
            onClick={(e) => stopAction(e, async () => {
              try { await duplicateSession(s.name); pushToast(`Duplicated ${s.name}`); refreshSessions(); }
              catch (err) { pushToast(`Duplicate failed: ${err.message}`, 'error'); }
            })}>{I.dup}</button>
          <button className="scard__action scard__action--danger" title="Archive"
            onClick={(e) => stopAction(e, async () => {
              try { await archiveSession(s.name); pushToast(`Archived ${s.name}`); refreshSessions(); }
              catch (err) { pushToast(`Archive failed: ${err.message}`, 'error'); }
            })}>{I.archive}</button>
          <button
            className="scard__action"
            title="More actions"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          >{I.more}</button>
          {menuOpen && <MoreMenu s={s} onClose={closeMenu} />}
        </div>
      </div>
    </div>
  );
}

function FilterBar({ filter, setFilter, layout, setLayout, onNew, query, setQuery, sort, setSort }) {
  const opts = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "waiting", label: "Waiting" },
    { id: "idle", label: "Idle" },
    { id: "stopped", label: "Stopped" },
  ];
  return (
    <div className="filterbar">
      {opts.map(o => (
        <button key={o.id} className="chip"
          aria-pressed={filter === o.id}
          onClick={() => setFilter(o.id)}
        >{o.label}</button>
      ))}
      <span className="vhairline" style={{height: 18, margin: '0 4px'}}></span>
      <button className="chip" title="claude provider">claude</button>
      <button className="chip" title="codex provider">codex</button>
      <input
        className="input"
        style={{height: 26, fontSize: 12, width: 160}}
        placeholder="Filter sessions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <span className="spacer"></span>
      <div className="segment" role="tablist" aria-label="Layout">
        {['grid','list','compact'].map(l => (
          <button key={l} aria-pressed={layout === l} onClick={() => setLayout(l)}>{l}</button>
        ))}
      </div>
      <button
        className="btn btn--ghost btn--icon btn--sm"
        title="Sort A-Z"
        aria-pressed={sort === 'az'}
        style={sort === 'az' ? {color: 'var(--accent)', background: 'var(--accent-soft)'} : {}}
        onClick={() => setSort(s => s === 'az' ? 'recent' : 'az')}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 5h7M2 9h5M2 13h3M11 3v10M9 11l2 2 2-2"/>
        </svg>
      </button>
      <button
        className="btn btn--ghost btn--icon btn--sm"
        title="Collapse all cards"
        onClick={() => { window.dispatchEvent(new Event('amux:collapse-cards')); pushToast('Cards eingeklappt'); }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6l5-3 5 3M3 10l5 3 5-3"/>
        </svg>
      </button>
      <button className="btn btn--primary" onClick={onNew}>
        {I.plus}<span>New session</span>
        <span className="kbd" style={{marginLeft: 4}}>⌘N</span>
      </button>
    </div>
  );
}

function SessionsTab({ onSelect, selected, onNew }) {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);
  // tick every 10s for relative-time refresh
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const cardLayout = window.AppTweaks?.cardLayout || "grid";
  const [layout, setLayout] = useState(cardLayout);

  const sessions = useMemo(() => {
    let arr = store.sessions.slice();
    if (filter !== "all") arr = arr.filter(s => s.status === filter);
    if (query) arr = arr.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [filter, query, sort, store.sessions, store.sessions.map(s => s.status).join(",")]);

  return (
    <>
      <FilterBar
        filter={filter} setFilter={setFilter}
        layout={layout} setLayout={setLayout}
        onNew={onNew}
        query={query} setQuery={setQuery}
        sort={sort} setSort={setSort}
      />
      <div className="content">
        {sessions.length === 0 ? (
          <div className="empty">
            <h3>No matching sessions</h3>
            <p>Try a different filter — or spin up a new Claude Code session below.</p>
            <button className="btn btn--primary" onClick={onNew}>{I.plus}<span>New session</span></button>
          </div>
        ) : (
          <div className="sgrid" data-layout={layout}>
            {sessions.map(s => (
              <SessionCard key={s.name} s={s} selected={selected === s.name} onSelect={onSelect} layout={layout} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { SessionCard, SessionsTab, FilterBar });

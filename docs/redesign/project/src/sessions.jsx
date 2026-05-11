/* Sessions tab + Session card */

const { useState, useEffect, useMemo, useRef } = React;

function StatusDot({ status }) {
  return <span className={`dot dot--${status}`} aria-label={status}></span>;
}

function SessionCard({ s, selected, onSelect, layout }) {
  const previewRef = useRef(null);
  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = previewRef.current.scrollHeight;
  }, [s.previewBump]);

  const lastLineKey = s.preview[s.preview.length - 1] + (s.previewBump || 0);
  const showTokens = window.AppTweaks?.showTokens !== false;

  const stopAction = (e, fn) => { e.stopPropagation(); fn(); };

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
            >{line || '\u00a0'}</span>
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

        <div className="scard__actions">
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
        </div>
      </div>
    </div>
  );
}

function FilterBar({ filter, setFilter, layout, setLayout, onNew }) {
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
      <span className="spacer"></span>
      <div className="segment" role="tablist" aria-label="Layout">
        {['grid','list','compact'].map(l => (
          <button key={l} aria-pressed={layout === l} onClick={() => setLayout(l)}>{l}</button>
        ))}
      </div>
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
  const cardLayout = window.AppTweaks?.cardLayout || "grid";
  const [layout, setLayout] = useState(cardLayout);

  const sessions = useMemo(() => {
    if (filter === "all") return store.sessions;
    return store.sessions.filter(s => s.status === filter);
  }, [filter, store.sessions, store.sessions.map(s => s.status).join(",")]);

  return (
    <>
      <FilterBar filter={filter} setFilter={setFilter} layout={layout} setLayout={setLayout} onNew={onNew} />
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

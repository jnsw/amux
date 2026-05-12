/* Command palette + New-session modal */

const { useState: useStateC, useEffect: useEffectC, useMemo: useMemoC, useRef: useRefC } = React;

function CommandPalette({ open, onClose, onNav, onNewSession, onSelectSession, onTweaks }) {
  const [q, setQ] = useStateC("");
  const [active, setActive] = useStateC(0);
  const inputRef = useRefC(null);

  useEffectC(() => {
    if (open) {
      setQ(""); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemoC(() => {
    const sessionItems = store.sessions.map(s => ({
      group: "Sessions", icon: I.sessions,
      label: s.name, hint: `${s.cwd} · ${s.status}`,
      action: () => { onSelectSession(s.name); onClose(); }
    }));
    const navItems = [
      { group: "Go to", icon: I.sessions, label: "Sessions", hint: "G then S", action: () => { onNav('sessions'); onClose(); } },
      { group: "Go to", icon: I.board,    label: "Board",    hint: "G then B", action: () => { onNav('board');    onClose(); } },
      { group: "Go to", icon: I.calendar, label: "Calendar", hint: "G then C", action: () => { onNav('calendar'); onClose(); } },
      { group: "Go to", icon: I.schedule, label: "Scheduler",hint: "G then R", action: () => { onNav('scheduler');onClose(); } },
      { group: "Go to", icon: I.files,    label: "Files",    hint: "G then F", action: () => { onNav('files');    onClose(); } },
      { group: "Go to", icon: I.notes,    label: "Notes",    hint: "G then N", action: () => { onNav('notes');    onClose(); } },
      { group: "Go to", icon: I.logs,     label: "Logs",     hint: "",          action: () => { onNav('logs');     onClose(); } },
      { group: "Go to", icon: I.metrics,  label: "Metrics",  hint: "",          action: () => { onNav('metrics');  onClose(); } },
    ];
    const actionItems = [
      { group: "Actions", icon: I.plus,    label: "New session…",         hint: "⌘N", action: () => { onNewSession(); onClose(); } },
      { group: "Actions", icon: I.settings,label: "Open Settings",        hint: "",   action: () => { onTweaks(); onClose(); } },
      { group: "Actions", icon: I.tweaks,  label: "Switch theme",         hint: "",   action: () => { onTweaks(); onClose(); } },
    ];
    const all = [...navItems, ...sessionItems, ...actionItems];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter(x =>
      x.label.toLowerCase().includes(needle) ||
      (x.hint || "").toLowerCase().includes(needle) ||
      x.group.toLowerCase().includes(needle)
    );
  }, [q, store.sessions.length]);

  useEffectC(() => { setActive(0); }, [q]);

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.action(); }
    else if (e.key === 'Escape') { onClose(); }
  }

  if (!open) return null;

  // group items in order of first appearance
  const grouped = [];
  const seen = new Set();
  items.forEach((it, idx) => {
    if (!seen.has(it.group)) { seen.add(it.group); grouped.push({ group: it.group, items: [] }); }
    grouped.find(g => g.group === it.group).items.push({ ...it, idx });
  });

  return (
    <div className="palette-wrap" onClick={onClose}>
      <div className="scrim" style={{position: 'absolute', inset: 0, zIndex: -1}}></div>
      <div className="palette" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="palette__search">
          {I.search}
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command, session name, or page…" />
          <span className="kbd">esc</span>
        </div>
        <div className="palette__list">
          {grouped.length === 0 ? (
            <div className="empty" style={{padding: 32}}>
              <h3 style={{fontSize: 14}}>No matches</h3>
              <p>Try a session name, page, or action.</p>
            </div>
          ) : grouped.map(g => (
            <div key={g.group}>
              <div className="palette__group">{g.group}</div>
              {g.items.map(it => (
                <div key={it.idx}
                  className="palette__item"
                  data-active={active === it.idx ? "true" : "false"}
                  onMouseEnter={() => setActive(it.idx)}
                  onClick={() => it.action()}
                >
                  <span style={{opacity: .7, display: 'inline-flex'}}>{it.icon}</span>
                  <span style={{flex: 1}}>{it.label}</span>
                  {it.hint && <span className="faint" style={{fontSize: 11}}>{it.hint}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── New Session Modal ────────────────── */
function NewSessionModal({ open, onClose }) {
  const [name, setName] = useStateC("");
  const [cwd, setCwd] = useStateC("~/code/");
  const [provider, setProvider] = useStateC("claude");
  const [branchMode, setBranchMode] = useStateC("current");
  const [branch, setBranch] = useStateC("main");
  const [suggesting, setSuggesting] = useStateC(false);

  useEffectC(() => {
    if (open) { setName(""); setCwd("~/code/"); setProvider("claude"); setBranch("main"); setBranchMode("current"); }
  }, [open]);

  function suggest() {
    setSuggesting(true);
    setTimeout(() => {
      const verbs = ['fix', 'feat', 'refactor', 'docs'];
      const nouns = ['auth-flow', 'login-bug', 'api-pagination', 'onboarding'];
      setBranch(`${verbs[Math.floor(Math.random()*4)]}/${nouns[Math.floor(Math.random()*4)]}`);
      setSuggesting(false);
    }, 700);
  }

  async function create() {
    const finalName = name.trim() || `session-${Date.now().toString(36).slice(-4)}`;
    onClose();
    pushToast(`Creating ${finalName}…`);
    try {
      await createSession({ name: finalName, cwd, provider, branch: branchMode === 'new' ? branch : undefined });
      pushToast(`Created ${finalName}`);
      refreshSessions();
    } catch (err) {
      pushToast(`Create failed: ${err.message}`, 'error');
    }
  }

  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div style={{position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16}}>
        <div className="modal nsm" onClick={e => e.stopPropagation()}>
          <div className="nsm__head">
            <h2>New session</h2>
            <p>Spawn a Claude Code session in a working directory.</p>
          </div>
          <div className="nsm__body">
            <div className="field">
              <label className="field__label">Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="auto-generated if blank" autoFocus />
            </div>
            <div className="field">
              <label className="field__label">Working directory</label>
              <input className="input mono" value={cwd} onChange={e => setCwd(e.target.value)} />
              <div className="field__hint">Tip — start typing for autocomplete from your filesystem.</div>
            </div>
            <div className="field">
              <label className="field__label">Provider</label>
              <div className="segment">
                <button aria-pressed={provider === "claude"} onClick={() => setProvider("claude")}>Claude</button>
                <button aria-pressed={provider === "codex"} onClick={() => setProvider("codex")}>Codex</button>
              </div>
            </div>
            <div className="field">
              <label className="field__label">Branch</label>
              <div className="segment">
                <button aria-pressed={branchMode === "current"} onClick={() => setBranchMode("current")}>Current</button>
                <button aria-pressed={branchMode === "new"} onClick={() => setBranchMode("new")}>New branch</button>
              </div>
              <div className="row" style={{gap: 6, marginTop: 4}}>
                <input className="input mono" value={branch} onChange={e => setBranch(e.target.value)} />
                {branchMode === "new" && (
                  <button className="btn btn--sm" onClick={suggest} disabled={suggesting}>
                    {suggesting ? "…" : "Suggest"}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="nsm__foot">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={create}>{I.plus}<span>Create session</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CommandPalette = CommandPalette;
window.NewSessionModal = NewSessionModal;

/* App shell — sidebar, topbar, bottomnav, footer, toasts */

const { useState: useStateS, useEffect: useEffectS } = React;

const TABS = [
  { id: "sessions", label: "Sessions", icon: I.sessions },
  { id: "board",    label: "Board",    icon: I.board },
  { id: "calendar", label: "Calendar", icon: I.calendar },
  { id: "scheduler",label: "Scheduler",icon: I.schedule },
  { id: "files",    label: "Files",    icon: I.files },
  { id: "notes",    label: "Notes",    icon: I.notes },
  { id: "logs",     label: "Logs",     icon: I.logs },
  { id: "metrics",  label: "Metrics",  icon: I.metrics },
  { id: "terminal", label: "Terminal", icon: I.terminal },
  { id: "browser",  label: "Browser",  icon: I.browser },
  { id: "crm",      label: "People",   icon: I.crm },
  { id: "map",      label: "Map",      icon: I.map },
  { id: "habits",   label: "Habits",   icon: I.habits },
  { id: "settings", label: "Settings", icon: I.settings },
];

function Sidebar({ collapsed, setCollapsed, tab, setTab, openTweaks, openPalette, onNewSession }) {
  const [, force] = useStateS(0);
  useEffectS(() => subscribe(() => force(n => n + 1)), []);

  const [notifs, setNotifs] = useStateS([]);
  const [notifOpen, setNotifOpen] = useStateS(false);
  const [addOpen, setAddOpen] = useStateS(false);
  const notifCount = notifs.length;

  useEffectS(() => {
    fetch('/api/notifications', { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(arr => setNotifs(Array.isArray(arr) ? arr : []))
      .catch(() => setNotifs([]));
  }, []);

  function clearNotifs() {
    fetch('/api/notifications', { method: 'DELETE', headers: API_HEADERS }).catch(() => {});
    setNotifs([]);
    setNotifOpen(false);
  }

  const liveCount = store.sessions.filter(s => s.status === 'active').length;
  const conn = store.connection;

  return (
    <aside className="sidebar" data-collapsed={collapsed ? "1" : "0"}>
      <div className="sidebar__head" style={{position:'relative'}}>
        <button className="brand" title="About amux" onClick={() => window.open('https://github.com/mixpeek/amux','_blank')}
          style={{background:'none', border:'none', padding:0, color:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:0}}>
          <div className="brand__mark">a</div>
          <span className="brand__name">amux</span>
        </button>
        <span className="spacer"></span>
        {/* Notifications bell */}
        <button className="btn btn--icon btn--ghost btn--sm"
          title={`Notifications${notifCount ? ` (${notifCount})` : ''}`}
          onClick={() => { setNotifOpen(v => !v); setAddOpen(false); }}
          style={{position:'relative'}}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3.5 11.5h9a1 1 0 0 0 .8-1.6L12 8.5V6a4 4 0 1 0-8 0v2.5l-1.3 1.4a1 1 0 0 0 .8 1.6z"/>
            <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{position:'absolute', top:-2, right:-2, background:'var(--err)', color:'#fff',
              fontSize:9, fontWeight:600, borderRadius:8, padding:'0 4px', minWidth:14, height:14,
              display:'flex', alignItems:'center', justifyContent:'center'}}>{notifCount}</span>
          )}
        </button>
        {/* Add menu */}
        <button className="btn btn--icon btn--ghost btn--sm" title="Add…"
          onClick={() => { setAddOpen(v => !v); setNotifOpen(false); }}>
          {I.plus}
        </button>
        {!collapsed && (
          <button className="btn btn--icon btn--ghost btn--sm" title="Collapse" onClick={() => setCollapsed(true)}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4L6 8l4 4"/></svg>
          </button>
        )}
        {collapsed && (
          <button className="btn btn--icon btn--ghost btn--sm" title="Expand" onClick={() => setCollapsed(false)}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
          </button>
        )}
        {/* Notifications panel */}
        {notifOpen && (
          <div style={{position:'absolute', top:50, left:8, right:8, background:'var(--surface)',
            border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,.35)',
            padding:6, maxHeight:300, overflowY:'auto', zIndex:50}}>
            {notifs.length === 0 ? (
              <div style={{padding:'12px 8px', color:'var(--fg-muted)', fontSize:12, textAlign:'center'}}>No notifications</div>
            ) : notifs.map((n, i) => (
              <div key={i} style={{display:'flex', alignItems:'flex-start', gap:6, padding:'6px 4px',
                borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1, minWidth:0}}>
                  {n.title && <div style={{fontSize:12, fontWeight:600, marginBottom:2}}>{n.title}</div>}
                  {n.body && <div style={{fontSize:11, color:'var(--fg-muted)'}}>{n.body}</div>}
                  {n.time && <div style={{fontSize:10, color:'var(--fg-muted)', marginTop:2}}>{n.time}</div>}
                </div>
                <button className="btn btn--icon btn--ghost btn--sm" style={{flexShrink:0}}
                  onClick={() => setNotifs(ns => ns.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {notifs.length > 0 && (
              <div style={{paddingTop:6}}>
                <button className="btn btn--ghost btn--sm" style={{width:'100%'}} onClick={clearNotifs}>Clear all</button>
              </div>
            )}
          </div>
        )}
        {/* Add floating menu */}
        {addOpen && (
          <div style={{position:'absolute', top:50, left:8, right:8, background:'var(--surface)',
            border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,.35)',
            padding:4, zIndex:50}}>
            <button className="nav__item" style={{width:'100%', background:'none', border:'none',
              color:'inherit', cursor:'pointer', borderRadius:6}}
              onClick={() => { setAddOpen(false); onNewSession && onNewSession(); }}>
              <span className="nav__icon">{I.plus}</span>
              <span className="nav__label">New session</span>
            </button>
            <button className="nav__item" style={{width:'100%', background:'none', border:'none',
              color:'inherit', cursor:'pointer', borderRadius:6}}
              onClick={() => { setAddOpen(false); pushToast('Connect tmux — not yet implemented'); }}>
              <span className="nav__icon">{I.terminal}</span>
              <span className="nav__label">Connect tmux</span>
            </button>
          </div>
        )}
      </div>

      <div className="sidebar__nav">
        <div className="nav__item" onClick={openPalette} title="Command palette (⌘K)">
          <span className="nav__icon">{I.search}</span>
          <span className="nav__label">Search</span>
          <span className="kbd" style={{marginLeft: 'auto'}}>⌘K</span>
        </div>
        <div className="nav__group">Workspace</div>
        {TABS.slice(0, 8).map(t => (
          <div key={t.id} className="nav__item"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="nav__icon">{t.icon}</span>
            <span className="nav__label">{t.label}</span>
            {t.id === "sessions" && liveCount > 0 && (
              <span className="nav__badge">
                <span className="dot dot--active" style={{display:'inline-block', verticalAlign:'middle', marginRight: 4}}></span>
                {liveCount}
              </span>
            )}
          </div>
        ))}
        <div className="nav__group">Tools</div>
        {TABS.slice(8).map(t => (
          <div key={t.id} className="nav__item"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="nav__icon">{t.icon}</span>
            <span className="nav__label">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="footer__row">
          <button className="conn" title="Connection status — click for details"
            style={{background:'none', border:'none', padding:0, color:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:6}}
            onClick={() => pushToast('Connection: ' + conn + ' · last ping ' + new Date(store.lastPing || Date.now()).toLocaleTimeString())}>
            <span className={`dot ${conn === 'live' ? 'dot--active' : conn === 'reconnecting' ? 'dot--waiting' : ''}`}
              style={{background: conn === 'offline' ? 'var(--err)' : undefined}}></span>
            <span className="meta">{conn}</span>
          </button>
          <span className="spacer"></span>
          <span className="meta" title="Total tokens across all sessions">
            {I.token}
            <span style={{marginLeft: 4}}>{fmtNum(totalTokens())}</span>
          </span>
        </div>
        <div className="footer__row">
          <button className="btn btn--ghost btn--sm" onClick={() => setTab('settings')} style={{padding: '0 8px', height: 24}}>
            {I.settings}<span className="nav__label" style={{marginLeft: 4}}>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ tab, onMenu, openPalette, onNewSession }) {
  const [, force] = useStateS(0);
  useEffectS(() => subscribe(() => force(n => n + 1)), []);
  const meta = TABS.find(t => t.id === tab);
  const liveCount = store.sessions.filter(s => s.status === 'active').length;
  const [notifCount, setNotifCount] = useStateS(0);
  useEffectS(() => {
    fetch('/api/notifications', { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(arr => setNotifCount(Array.isArray(arr) ? arr.length : 0))
      .catch(() => {});
  }, []);
  return (
    <header className="topbar">
      <button className="btn btn--icon btn--ghost" onClick={onMenu} style={{display: 'none'}} id="menu-btn">{I.menu}</button>
      <div className="col" style={{gap: 0}}>
        <h1>{meta?.label || tab}</h1>
        {tab === 'sessions' && (
          <div className="topbar__sub">
            {store.sessions.length} total · {liveCount} active · realtime via SSE
          </div>
        )}
      </div>
      <span className="spacer"></span>
      {/* Notifications bell */}
      <button className="btn btn--icon btn--ghost" title="Notifications"
        style={{position:'relative'}}
        onClick={() => pushToast('Notifications — open sidebar for details')}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 11.5h9a1 1 0 0 0 .8-1.6L12 8.5V6a4 4 0 1 0-8 0v2.5l-1.3 1.4a1 1 0 0 0 .8 1.6z"/>
          <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/>
        </svg>
        {notifCount > 0 && (
          <span style={{position:'absolute', top:-2, right:-2, background:'var(--err)', color:'#fff',
            fontSize:9, fontWeight:600, borderRadius:8, padding:'0 4px', minWidth:14, height:14,
            display:'flex', alignItems:'center', justifyContent:'center'}}>{notifCount}</span>
        )}
      </button>
      {/* New session */}
      <button className="btn btn--icon btn--ghost" title="New session (⌘N)" onClick={onNewSession}>{I.plus}</button>
      <button className="topbar__search" onClick={openPalette}>
        {I.search}
        <span style={{flex: 1, textAlign: 'left'}}>Search or run a command…</span>
        <span className="kbd">⌘K</span>
      </button>
    </header>
  );
}

function BottomNav({ tab, setTab, openPalette }) {
  const items = TABS.slice(0, 4);
  return (
    <nav className="bottomnav" style={{display: 'flex'}}>
      {items.map(t => (
        <button key={t.id} className="bottomnav__item"
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => setTab(t.id)}
        >
          {t.icon}<span>{t.label}</span>
        </button>
      ))}
      <button className="bottomnav__item" onClick={openPalette}>
        {I.search}<span>Search</span>
      </button>
    </nav>
  );
}

function Toasts() {
  const [, force] = useStateS(0);
  useEffectS(() => subscribe(() => force(n => n + 1)), []);
  return (
    <div className="toasts" aria-live="polite">
      {store.toasts.map(t => (
        <div key={t.id} className="toast">
          <span className="toast__dot"></span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectionBanner() {
  const [, force] = useStateS(0);
  useEffectS(() => subscribe(() => force(n => n + 1)), []);
  if (store.connection === 'live') return null;
  return (
    <div className="banner" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <span className={`dot ${store.connection === 'reconnecting' ? 'dot--waiting' : ''}`}
          style={{background: store.connection === 'offline' ? 'var(--err)' : undefined}}></span>
        <span>{store.connection === 'reconnecting' ? 'Reconnecting to amux…' : 'Offline — showing last known state'}</span>
      </div>
      <button className="btn btn--ghost btn--sm" style={{marginLeft:'auto'}}
        onClick={() => {
          if (typeof window.refreshSessions === 'function') window.refreshSessions();
          pushToast('Retrying…');
        }}>Retry</button>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, BottomNav, Toasts, ConnectionBanner, TABS });

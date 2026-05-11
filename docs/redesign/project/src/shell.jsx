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

function Sidebar({ collapsed, setCollapsed, tab, setTab, openTweaks, openPalette }) {
  const [, force] = useStateS(0);
  useEffectS(() => subscribe(() => force(n => n + 1)), []);

  const liveCount = store.sessions.filter(s => s.status === 'active').length;
  const conn = store.connection;

  return (
    <aside className="sidebar" data-collapsed={collapsed ? "1" : "0"}>
      <div className="sidebar__head">
        <div className="brand">
          <div className="brand__mark">a</div>
          <span className="brand__name">amux</span>
        </div>
        <span className="spacer"></span>
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
          <span className="conn">
            <span className={`dot ${conn === 'live' ? 'dot--active' : conn === 'reconnecting' ? 'dot--waiting' : ''}`}
              style={{background: conn === 'offline' ? 'var(--err)' : undefined}}></span>
            <span className="meta">{conn}</span>
          </span>
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

function Topbar({ tab, onMenu, openPalette }) {
  const meta = TABS.find(t => t.id === tab);
  const liveCount = store.sessions.filter(s => s.status === 'active').length;
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
    <div className="banner">
      <span className={`dot ${store.connection === 'reconnecting' ? 'dot--waiting' : ''}`}
        style={{background: store.connection === 'offline' ? 'var(--err)' : undefined}}></span>
      <span>{store.connection === 'reconnecting' ? 'Reconnecting to amux…' : 'Offline — showing last known state'}</span>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, BottomNav, Toasts, ConnectionBanner, TABS });

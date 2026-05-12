/* Root app */

const { useState: useStateA, useEffect: useEffectA } = React;

let _wsId = 0;
const newWs = (name, tab = 'sessions') => ({ id: ++_wsId, name, tab, selected: null });

function App() {
  const [workspaces, setWorkspaces] = useStateA([
    newWs('Atlas', 'sessions'),
    newWs('Marketing', 'board'),
    newWs('Ops', 'calendar'),
  ]);
  const [activeIdx, setActiveIdx] = useStateA(0);
  const [collapsed, setCollapsed] = useStateA(false);
  const [paletteOpen, setPaletteOpen] = useStateA(false);
  const [newOpen, setNewOpen] = useStateA(false);
  const [, force] = useStateA(0);

  const active = workspaces[activeIdx] || workspaces[0];
  const tab = active.tab;
  const selected = active.selected;

  function updateActive(patch) {
    setWorkspaces(ws => ws.map((w, i) => i === activeIdx ? { ...w, ...patch } : w));
  }
  const setTab = (t) => updateActive({ tab: t, selected: null });
  const setSelected = (s) => updateActive({ selected: s });

  function addWorkspace() {
    const idx = workspaces.length + 1;
    const ws = newWs(`Tab ${idx}`);
    setWorkspaces(w => [...w, ws]);
    setActiveIdx(workspaces.length);
  }
  function closeWorkspace(i) {
    if (workspaces.length === 1) return;
    setWorkspaces(w => w.filter((_, j) => j !== i));
    setActiveIdx(j => Math.max(0, j > i ? j - 1 : (j === i ? Math.min(j, workspaces.length - 2) : j)));
  }
  function renameWorkspace(i, name) {
    setWorkspaces(w => w.map((x, j) => j === i ? { ...x, name } : x));
  }

  useEffectA(() => {
    startMockSSE();
    return subscribe(() => force(n => n + 1));
  }, []);

  const [t] = useAppTweaks();
  useEffectA(() => { window.AppTweaks = t; }, [t]);
  useEffectA(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t.theme || 'github');
    root.setAttribute('data-light', t.light ? '1' : '0');
    root.setAttribute('data-density', t.density || 'comfortable');
    root.setAttribute('data-accent', window.resolveAccent ? window.resolveAccent(t.accent) : (t.accent || 'indigo'));
    root.setAttribute('data-qkstyle', t.quickKeysStyle || 'keycap');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
      t.light ? '#ffffff' : (
        t.theme === 'github' ? '#0d1117' :
        t.theme === 'phosphor' ? '#050a05' :
        t.theme === 'phosphor-amber' ? '#0a0703' :
        t.theme === 'trade' ? '#000000' :
        t.theme === 'glass' ? '#0b0d12' : '#0a0a0b'
      ));
  }, [t.theme, t.light, t.density, t.accent, t.quickKeysStyle]);
  useEffectA(() => {
    document.documentElement.style.setProperty('--dur-1', t.animations ? '80ms'  : '0ms');
    document.documentElement.style.setProperty('--dur-2', t.animations ? '140ms' : '0ms');
    document.documentElement.style.setProperty('--dur-3', t.animations ? '220ms' : '0ms');
  }, [t.animations]);

  useEffectA(() => {
    function key(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); setPaletteOpen(true); }
      else if (mod && e.key === 'n') { e.preventDefault(); setNewOpen(true); }
      else if (mod && e.key === 't') { e.preventDefault(); addWorkspace(); }
      else if (mod && /^[1-9]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (i < workspaces.length) { e.preventDefault(); setActiveIdx(i); }
      }
      else if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        else if (newOpen) setNewOpen(false);
        else if (selected) setSelected(null);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [paletteOpen, newOpen, selected, workspaces.length, activeIdx]);

  useEffectA(() => {
    const seq = [[12000,'reconnecting'],[14500,'live']];
    const timers = seq.map(([ms, st]) => setTimeout(() => simulateConnection(st), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const sidebarPos = t.sidebar || 'left';
  const navMode = t.nav || 'sidebar';

  function selectSession(name) {
    if (document.startViewTransition) {
      document.startViewTransition(() => setSelected(name));
    } else { setSelected(name); }
  }

  function renderTab() {
    switch (tab) {
      case 'sessions': return <SessionsTab onSelect={selectSession} selected={selected} onNew={() => setNewOpen(true)} />;
      case 'board':    return <LegacyEmbed view="board" label="Board" />;
      case 'calendar': return <LegacyEmbed view="calendar" label="Calendar" />;
      case 'scheduler':return <LegacyEmbed view="scheduler" label="Scheduler" />;
      case 'files':    return <LegacyEmbed view="files" label="Files" />;
      case 'notes':    return <LegacyEmbed view="notes" label="Notes" />;
      case 'logs':     return <LegacyEmbed view="logs" label="Logs" />;
      case 'metrics':  return <LegacyEmbed view="metrics" label="Metrics" />;
      case 'terminal': return <LegacyEmbed view="terminal" label="Terminal" />;
      case 'browser':  return <LegacyEmbed view="browser" label="Browser" />;
      case 'crm':      return <LegacyEmbed view="crm" label="People" />;
      case 'map':      return <LegacyEmbed view="map" label="Map" />;
      case 'habits':   return <LegacyEmbed view="habits" label="Habits" />;
      case 'torrents': return <LegacyEmbed view="torrents" label="Torrents" />;
      case 'journal':  return <LegacyEmbed view="journal" label="Journal" />;
      case 'graph':    return <LegacyEmbed view="graph" label="Graph" />;
      case 'settings': return <SettingsTab />;
      default:         return <LegacyEmbed view={tab} label={TABS.find(x => x.id === tab)?.label || tab} />;
    }
  }

  return (
    <div className="app" data-sidebar={sidebarPos} data-nav={navMode} data-sidebar-collapsed={collapsed ? '1' : '0'}>
      {navMode === 'sidebar' && (
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} tab={tab} setTab={setTab} openTweaks={() => setTab('settings')} openPalette={() => setPaletteOpen(true)} onNewSession={() => setNewOpen(true)} />
      )}
      <main className="main">
        <WorkspaceTabs
          workspaces={workspaces}
          activeIdx={activeIdx}
          onSwitch={setActiveIdx}
          onAdd={addWorkspace}
          onClose={closeWorkspace}
          onRename={renameWorkspace}
          navMode={navMode}
          openTweaks={() => setTab('settings')}
          openPalette={() => setPaletteOpen(true)}
        />
        {navMode === 'tabs' && <ViewTabs tab={tab} setTab={setTab} />}
        <Topbar tab={tab} onMenu={() => setCollapsed(false)} openPalette={() => setPaletteOpen(true)} onNewSession={() => setNewOpen(true)} />
        {renderTab()}
      </main>

      {selected && tab === 'sessions' && (
        <PeekPanel name={selected} onClose={() => setSelected(null)} onSwitch={selectSession} />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}
        onNav={setTab}
        onSelectSession={(n) => { setTab('sessions'); selectSession(n); }}
        onNewSession={() => setNewOpen(true)}
        onTweaks={() => window.dispatchEvent(new Event('open-tweaks'))}
      />
      <NewSessionModal open={newOpen} onClose={() => setNewOpen(false)} />
      <ConnectionBanner />
      <Toasts />
    </div>
  );
}

window.App = App;

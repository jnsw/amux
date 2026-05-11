/* Tweaks wiring — exposes a Settings tab + persists values in localStorage so
   changes survive reloads. The legacy floating TweaksPanel is no longer mounted
   by default; the Settings tab (renderTab('settings') in app.jsx) owns the UI. */

const APP_TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "github",
  "light": true,
  "density": "comfortable",
  "accent": "indigo",
  "cardLayout": "grid",
  "showTokens": true,
  "animations": true,
  "nav": "sidebar",
  "sidebar": "left",
  "showPreview": true,
  "showQuickKeys": true,
  "quickKeysStyle": "keycap"
}/*EDITMODE-END*/;

const APP_TWEAKS_KEY = 'amux_redesign_tweaks_v1';

function _loadTweaks() {
  try {
    const raw = localStorage.getItem(APP_TWEAKS_KEY);
    if (!raw) return { ...APP_TWEAKS_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...APP_TWEAKS_DEFAULTS, ...parsed };
  } catch (e) { return { ...APP_TWEAKS_DEFAULTS }; }
}

function _saveTweaks(v) {
  try { localStorage.setItem(APP_TWEAKS_KEY, JSON.stringify(v)); } catch (e) {}
}

function useAppTweaks() {
  const [values, setValues] = React.useState(_loadTweaks);
  React.useEffect(() => {
    function onChange(e) {
      const edits = e.detail || {};
      setValues(prev => ({ ...prev, ...edits }));
    }
    window.addEventListener('amux:tweakchange', onChange);
    return () => window.removeEventListener('amux:tweakchange', onChange);
  }, []);
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues(prev => {
      const next = { ...prev, ...edits };
      _saveTweaks(next);
      window.AppTweaks = next;
      return next;
    });
    window.dispatchEvent(new CustomEvent('amux:tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

function AppTweaks() {
  const [t, setTweak] = useAppTweaks();
  window.AppTweaks = t;

  React.useEffect(() => {
    document.documentElement.style.setProperty('--dur-1', t.animations ? '80ms'  : '0ms');
    document.documentElement.style.setProperty('--dur-2', t.animations ? '140ms' : '0ms');
    document.documentElement.style.setProperty('--dur-3', t.animations ? '220ms' : '0ms');
  }, [t.animations]);

  return null;
}

window.AppTweaksComp = AppTweaks;

/* ── Settings tab — inline (not a floating panel) ───────────────────────── */
function SettingsTab() {
  const [t, setTweak] = useAppTweaks();
  function reset() {
    if (!confirm('Reset all settings to defaults?')) return;
    try { localStorage.removeItem(APP_TWEAKS_KEY); } catch(e){}
    Object.entries(APP_TWEAKS_DEFAULTS).forEach(([k,v]) => setTweak(k, v));
  }
  function openWalkthrough() {
    try { localStorage.removeItem('amux_redesign_walkthrough_done'); } catch(e){}
    if (typeof window.openWalkthrough === 'function') window.openWalkthrough();
  }
  return (
    <div className="content settings">
      <div className="settings__grid">
        <SettingsCard title="Theme" desc="Color scheme and accent">
          <SetSelect label="Style" value={t.theme} onChange={v => setTweak('theme', v)}
            options={[
              { value: 'github', label: 'GitHub' },
              { value: 'quiet', label: 'Quiet' },
              { value: 'glass', label: 'Glass' },
              { value: 'phosphor', label: 'Phosphor green' },
              { value: 'phosphor-amber', label: 'Phosphor amber' },
              { value: 'trade', label: 'Trade' },
            ]} />
          <SetToggle label="Light mode" value={t.light} onChange={v => setTweak('light', v)} />
          <SetSwatch label="Accent" value={t.accent} onChange={v => setTweak('accent', v)}
            options={['#7c9eff','#3fb950','#ffb84d','#ff6f8d']} />
        </SettingsCard>

        <SettingsCard title="Layout" desc="Density and navigation">
          <SetSelect label="Density" value={t.density} onChange={v => setTweak('density', v)}
            options={[
              { value: 'spacious', label: 'Spacious' },
              { value: 'comfortable', label: 'Cozy' },
              { value: 'dense', label: 'Dense' },
            ]} />
          <SetSelect label="Card layout" value={t.cardLayout} onChange={v => setTweak('cardLayout', v)}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
              { value: 'compact', label: 'Compact' },
            ]} />
          <SetSelect label="Navigation" value={t.nav} onChange={v => setTweak('nav', v)}
            options={[{ value: 'sidebar', label: 'Sidebar' }, { value: 'tabs', label: 'Top tabs' }]} />
          {t.nav === 'sidebar' && (
            <SetSelect label="Sidebar side" value={t.sidebar} onChange={v => setTweak('sidebar', v)}
              options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
          )}
        </SettingsCard>

        <SettingsCard title="Cards" desc="What session cards show">
          <SetToggle label="Show tokens" value={t.showTokens} onChange={v => setTweak('showTokens', v)} />
          <SetToggle label="Show preview" value={t.showPreview} onChange={v => setTweak('showPreview', v)} />
          <SetToggle label="Animations" value={t.animations} onChange={v => setTweak('animations', v)} />
        </SettingsCard>

        <SettingsCard title="Composer" desc="Send-message UX in the peek panel">
          <SetToggle label="Quick keys" value={t.showQuickKeys} onChange={v => setTweak('showQuickKeys', v)} />
          <SetSelect label="Key style" value={t.quickKeysStyle} onChange={v => setTweak('quickKeysStyle', v)}
            options={[
              { value: 'keycap', label: 'Keycap' },
              { value: 'flat', label: 'Flat' },
              { value: 'terminal', label: 'Mono' },
            ]} />
        </SettingsCard>

        <SettingsCard title="Onboarding" desc="Show the first-run tour again">
          <div className="row" style={{gap: 8, flexWrap: 'wrap'}}>
            <button className="btn btn--ghost" onClick={openWalkthrough}>Replay walkthrough</button>
            <button className="btn btn--ghost" onClick={reset}>Reset all settings</button>
          </div>
        </SettingsCard>

        <SettingsCard title="About" desc="Build & connectivity">
          <div className="settings__meta">
            <div><span className="dim">Auth</span><span className="mono">{(window.AMUX_AUTH || '').slice(0, 8) || 'localhost'}…</span></div>
            <div><span className="dim">SSE</span><span>{store.connection}</span></div>
            <div><span className="dim">Sessions</span><span>{store.sessions.length}</span></div>
            <div><span className="dim">Server</span><span><a href="/legacy" className="faint">open legacy view ↗</a></span></div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

/* Settings primitives — purposely plain, no backdrop-blur, no floating panel */
function SettingsCard({ title, desc, children }) {
  return (
    <section className="settings__card">
      <header className="settings__cardhead">
        <h3>{title}</h3>
        {desc && <p className="dim">{desc}</p>}
      </header>
      <div className="settings__rows">{children}</div>
    </section>
  );
}

function SetSelect({ label, value, onChange, options }) {
  const opts = options.map(o => typeof o === 'object' ? o : { value: o, label: o });
  return (
    <label className="settings__row">
      <span className="settings__label">{label}</span>
      <select className="settings__field" value={value} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function SetToggle({ label, value, onChange }) {
  return (
    <div className="settings__row settings__row--toggle">
      <span className="settings__label">{label}</span>
      <button type="button" role="switch" aria-checked={!!value}
        className={`set-toggle ${value ? 'set-toggle--on' : ''}`}
        onClick={() => onChange(!value)}>
        <span className="set-toggle__knob" />
      </button>
    </div>
  );
}

function SetSwatch({ label, value, onChange, options }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <div className="settings__swatches">
        {options.map(c => (
          <button key={c} type="button" title={c}
            className={`set-swatch ${c === value ? 'set-swatch--active' : ''}`}
            style={{background: c}} onClick={() => onChange(c)} aria-label={c} />
        ))}
      </div>
    </div>
  );
}

window.SettingsTab = SettingsTab;

// Map accent color hex back to data-accent name
const ACCENT_MAP = {
  '#7c9eff': 'indigo',
  '#3fb950': 'emerald',
  '#ffb84d': 'amber',
  '#ff6f8d': 'rose',
};
window.resolveAccent = (v) => ACCENT_MAP[v] || v || 'indigo';

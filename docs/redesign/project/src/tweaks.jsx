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

  // API Keys
  const [anthKey, setAnthKey] = React.useState('');
  const [googleKey, setGoogleKey] = React.useState('');

  // Team modal
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState('');
  const [inviteLoading, setInviteLoading] = React.useState(false);

  // Skills modal
  const [skillsModalOpen, setSkillsModalOpen] = React.useState(false);
  const [skills, setSkills] = React.useState([]);

  // Connections
  const [conns, setConns] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('amux_connections') || '[]'); } catch { return []; }
  });

  // About: version + uptime
  const [serverVersion, setServerVersion] = React.useState('—');
  const [serverUptime, setServerUptime] = React.useState('—');

  // Devtools sub-tab
  const [devtoolsOpen, setDevtoolsOpen] = React.useState(false);
  const [lsKeys, setLsKeys] = React.useState([]);
  const [debugData, setDebugData] = React.useState(null);

  // Load API key placeholders on mount
  React.useEffect(() => {
    fetch('/api/settings/env', { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.ANTHROPIC_API_KEY) setAnthKey('');
      })
      .catch(() => {});
    // Load health/version
    fetch('/health', { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.uptime_s != null) {
          const s = d.uptime_s;
          const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
          setServerUptime(h ? `${h}h ${m}m` : `${m}m`);
        }
        if (d.version) setServerVersion(d.version);
      })
      .catch(() => {});
  }, []);

  function _saveConns(list) {
    try { localStorage.setItem('amux_connections', JSON.stringify(list)); } catch {}
    setConns(list);
  }

  async function saveAnth() {
    if (!anthKey.trim()) return;
    try {
      const r = await fetch('/api/settings/env', {
        method: 'PATCH', headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ANTHROPIC_API_KEY: anthKey.trim() }),
      });
      if (r.ok) { setAnthKey(''); pushToast('Saved — server will reload', 'info'); }
      else pushToast('Save failed (' + r.status + ')', 'error');
    } catch (e) { pushToast('Error: ' + e.message, 'error'); }
  }

  async function saveGoogle() {
    if (!googleKey.trim()) return;
    try {
      const r = await fetch('/api/settings/env', {
        method: 'PATCH', headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ GOOGLE_API_KEY: googleKey.trim() }),
      });
      if (r.ok) { setGoogleKey(''); pushToast('Saved — server will reload', 'info'); }
      else pushToast('Save failed (' + r.status + ')', 'error');
    } catch (e) { pushToast('Error: ' + e.message, 'error'); }
  }

  async function openTeamModal() {
    setTeamModalOpen(true);
    setInviteUrl('');
    setInviteLoading(true);
    try {
      const r = await fetch('/api/org/invites', {
        method: 'POST', headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (d.url) { setInviteUrl(d.url); try { navigator.clipboard.writeText(d.url); } catch {} }
      else pushToast(d.error || 'Failed to create invite', 'error');
    } catch (e) { pushToast('Error: ' + e.message, 'error'); }
    setInviteLoading(false);
  }

  async function openSkillsModal() {
    setSkillsModalOpen(true);
    try {
      const r = await fetch('/api/skills', { headers: API_HEADERS });
      const d = r.ok ? await r.json() : [];
      setSkills(Array.isArray(d) ? d : []);
    } catch { setSkills([]); }
  }

  function addConn(name, url) {
    const list = [...conns];
    if (!list.find(c => c.url === url)) { list.push({ name, url }); _saveConns(list); pushToast('Connection added', 'info'); }
  }

  function removeConn(i) {
    const list = [...conns];
    list.splice(i, 1);
    _saveConns(list);
  }

  function openDevtools() {
    setDevtoolsOpen(true);
    setLsKeys(Object.keys(localStorage));
    fetch('/api/debug', { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => setDebugData(d))
      .catch(() => setDebugData({ error: 'Not available' }));
  }

  function reset() {
    if (!confirm('Reset all settings to defaults?')) return;
    try { localStorage.removeItem(APP_TWEAKS_KEY); } catch(e){}
    Object.entries(APP_TWEAKS_DEFAULTS).forEach(([k,v]) => setTweak(k, v));
  }

  function openWalkthrough() {
    try { localStorage.removeItem('amux_redesign_walkthrough_done'); } catch(e){}
    window.dispatchEvent(new Event('amux:restart-walkthrough'));
    if (typeof window.openWalkthrough === 'function') window.openWalkthrough();
    pushToast('Walkthrough restarted', 'info');
  }

  const SectionHead = ({ label }) => (
    <h3 style={{fontSize:13, fontWeight:600, color:'var(--text-dim)', textTransform:'uppercase',
      letterSpacing:'0.04em', margin:'0 0 12px'}}>{label}</h3>
  );

  return (
    <div className="content settings">
      <div className="settings__grid">

        {/* ── Theme ── */}
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

        {/* ── Layout ── */}
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

        {/* ── Cards ── */}
        <SettingsCard title="Cards" desc="What session cards show">
          <SetToggle label="Show tokens" value={t.showTokens} onChange={v => setTweak('showTokens', v)} />
          <SetToggle label="Show preview" value={t.showPreview} onChange={v => setTweak('showPreview', v)} />
          <SetToggle label="Animations" value={t.animations} onChange={v => setTweak('animations', v)} />
        </SettingsCard>

        {/* ── Composer ── */}
        <SettingsCard title="Composer" desc="Send-message UX in the peek panel">
          <SetToggle label="Quick keys" value={t.showQuickKeys} onChange={v => setTweak('showQuickKeys', v)} />
          <SetSelect label="Key style" value={t.quickKeysStyle} onChange={v => setTweak('quickKeysStyle', v)}
            options={[
              { value: 'keycap', label: 'Keycap' },
              { value: 'flat', label: 'Flat' },
              { value: 'terminal', label: 'Mono' },
            ]} />
        </SettingsCard>

        {/* ── API Keys ── */}
        <SettingsCard title="API Keys" desc="Server-side credentials saved to ~/.amux/server.env">
          <div style={{display:'flex', gap:8}}>
            <input className="settings__field" type="password" placeholder="Anthropic API key (sk-ant-…)"
              style={{flex:1}} value={anthKey} onChange={e => setAnthKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveAnth()} />
            <button className="btn btn--primary" style={{minWidth:56, minHeight:36}} onClick={saveAnth}>Save</button>
          </div>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <input className="settings__field" type="password" placeholder="Google API key (optional, for Gemini)"
              style={{flex:1}} value={googleKey} onChange={e => setGoogleKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGoogle()} />
            <button className="btn btn--primary" style={{minWidth:56, minHeight:36}} onClick={saveGoogle}>Save</button>
          </div>
          <div className="faint" style={{fontSize:11, marginTop:6}}>Saved to ~/.amux/server.env — survives restarts.</div>
        </SettingsCard>

        {/* ── Team & Cloud ── */}
        <SettingsCard title="Team & Cloud" desc="Workspace sharing and account">
          <div className="row" style={{gap:8, flexWrap:'wrap'}}>
            <button className="btn btn--primary" style={{minHeight:36}} onClick={openTeamModal}>Invite team member…</button>
            <button className="btn btn--danger" style={{minHeight:36}}
              onClick={() => { window.location = '/api/cloud-logout'; }}>Sign out</button>
          </div>
        </SettingsCard>

        {/* ── Connections ── */}
        <SettingsCard title="Connections" desc="Server endpoints — click to switch">
          {conns.length === 0 && (
            <div className="faint" style={{fontSize:12, marginBottom:8}}>No connections saved. Add your local or Tailscale URL.</div>
          )}
          {conns.map((c, i) => (
            <div key={i} className="row" style={{gap:8, padding:'4px 0', borderBottom:'1px solid var(--border)', alignItems:'center'}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.name}</div>
                <div className="faint" style={{fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.url}</div>
              </div>
              <button className="btn btn--ghost" style={{minWidth:36, minHeight:36, padding:'0 8px', fontSize:11}}
                onClick={() => { window.location.href = c.url; }}>Open</button>
              <button className="btn btn--ghost" style={{minWidth:36, minHeight:36, padding:'0 6px', fontSize:16, lineHeight:1}}
                title="Remove" onClick={() => removeConn(i)}>×</button>
            </div>
          ))}
          <div className="row" style={{gap:8, marginTop:10, flexWrap:'wrap'}}>
            <button className="btn btn--ghost" style={{minHeight:36, fontSize:12}}
              onClick={() => addConn('Localhost', 'https://localhost:8822')}>+ Localhost (localhost:8822)</button>
            <button className="btn btn--ghost" style={{minHeight:36, fontSize:12}}
              onClick={() => addConn('Cloud', 'https://cloud.amux.io')}>☁ Cloud (cloud.amux.io)</button>
          </div>
        </SettingsCard>

        {/* ── Skills & Commands ── */}
        <SettingsCard title="Skills & Commands" desc="Installed Claude Code skills">
          <button className="btn btn--ghost" style={{minHeight:36}} onClick={openSkillsModal}>Open Skills…</button>
        </SettingsCard>

        {/* ── About ── */}
        <SettingsCard title="About" desc="Build & connectivity">
          <div className="settings__meta">
            <div><span className="dim">Version</span><span>{serverVersion}</span></div>
            <div><span className="dim">Uptime</span><span>{serverUptime}</span></div>
            <div><span className="dim">Tokens</span><span>{fmtNum(totalTokens())}</span></div>
            <div><span className="dim">Auth</span><span className="mono">{(window.AMUX_AUTH || '').slice(0, 8) || 'localhost'}…</span></div>
            <div><span className="dim">SSE</span><span>{store.connection}</span></div>
            <div><span className="dim">Sessions</span><span>{store.sessions.length}</span></div>
            <div><span className="dim">Server</span><span><a href="/legacy" className="faint">open legacy view ↗</a></span></div>
          </div>
          <div style={{marginTop:10}}>
            <button className="btn btn--ghost" style={{minHeight:36, fontSize:12}} onClick={openDevtools}>
              🛠 Developer Tools
            </button>
          </div>
        </SettingsCard>

        {/* ── Onboarding ── */}
        <SettingsCard title="Onboarding" desc="Show the first-run tour again">
          <div className="row" style={{gap: 8, flexWrap: 'wrap'}}>
            <button className="btn btn--ghost" style={{minHeight:36}} onClick={openWalkthrough}>Restart walkthrough</button>
            <button className="btn btn--ghost" style={{minHeight:36}} onClick={reset}>Reset all settings</button>
          </div>
        </SettingsCard>

      </div>

      {/* ── Team Invite Modal ── */}
      {teamModalOpen && (
        <>
          <div className="scrim" onClick={() => setTeamModalOpen(false)} />
          <div className="modal" role="dialog" aria-label="Invite team member"
            style={{display:'flex', flexDirection:'column', gap:12}}>
            <h3 style={{margin:0}}>Invite team member</h3>
            <p className="dim" style={{margin:0, fontSize:13}}>
              {inviteLoading ? 'Generating invite link…' : inviteUrl ? 'Link copied to clipboard. Share it — expires in 7 days.' : 'Failed to generate link.'}
            </p>
            {inviteUrl && (
              <input className="settings__field" readOnly value={inviteUrl}
                onClick={e => e.target.select()} style={{fontFamily:'monospace', fontSize:11}} />
            )}
            <div className="row" style={{justifyContent:'flex-end', gap:8}}>
              {inviteUrl && (
                <button className="btn btn--primary"
                  onClick={() => { navigator.clipboard.writeText(inviteUrl).catch(()=>{}); pushToast('Copied!', 'info'); }}>
                  Copy link
                </button>
              )}
              <button className="btn btn--ghost" onClick={() => setTeamModalOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* ── Skills Modal ── */}
      {skillsModalOpen && (
        <>
          <div className="scrim" onClick={() => setSkillsModalOpen(false)} />
          <div className="modal" role="dialog" aria-label="Skills"
            style={{display:'flex', flexDirection:'column', gap:12, maxHeight:'70vh', overflow:'hidden'}}>
            <h3 style={{margin:0}}>Skills & Commands</h3>
            <div style={{overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:8}}>
              {skills.length === 0
                ? <div className="faint" style={{fontSize:13}}>No skills installed.</div>
                : skills.map((sk, i) => (
                    <div key={i} style={{padding:'8px 12px', background:'var(--bg2)', borderRadius:6}}>
                      <div style={{fontWeight:600, fontSize:13}}>{sk.name || sk}</div>
                      {sk.description && <div className="dim" style={{fontSize:12, marginTop:2}}>{sk.description}</div>}
                    </div>
                  ))
              }
            </div>
            <div className="row" style={{justifyContent:'flex-end'}}>
              <button className="btn btn--ghost" onClick={() => setSkillsModalOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* ── Developer Tools Sub-panel ── */}
      {devtoolsOpen && (
        <>
          <div className="scrim" onClick={() => setDevtoolsOpen(false)} />
          <div className="modal" role="dialog" aria-label="Developer Tools"
            style={{display:'flex', flexDirection:'column', gap:12, maxHeight:'80vh', overflow:'hidden', width:'min(600px, 95vw)'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Developer Tools</h3>
              <button className="btn btn--ghost" style={{minWidth:36, minHeight:36}} onClick={() => setDevtoolsOpen(false)}>×</button>
            </div>
            <div style={{overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16}}>
              <div>
                <div className="faint" style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6}}>localStorage keys ({lsKeys.length})</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                  {lsKeys.map(k => (
                    <span key={k} className="pill" style={{fontFamily:'monospace', fontSize:11}}>{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="faint" style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6}}>/api/debug</div>
                <pre style={{margin:0, fontSize:11, fontFamily:'monospace', background:'var(--bg2)', padding:10, borderRadius:6, overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all'}}>
                  {debugData == null ? 'Loading…' : JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
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

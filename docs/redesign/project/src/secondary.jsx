/* Secondary tab placeholders — share PageShell pattern */

function PageShell({ title, sub, action, children }) {
  return (
    <>
      <div className="filterbar">
        <div className="col" style={{gap: 0}}>
          <strong style={{fontSize: 14}}>{title}</strong>
          {sub && <span className="faint" style={{fontSize: 11}}>{sub}</span>}
        </div>
        <span className="spacer"></span>
        {action}
      </div>
      <div className="content">{children}</div>
    </>
  );
}

function BoardTab() {
  const cols = [
    { id: 'backlog', label: 'Backlog', count: 4 },
    { id: 'todo',    label: 'To do',   count: 3 },
    { id: 'doing',   label: 'In progress', count: 2, accent: true },
    { id: 'review',  label: 'In review', count: 1 },
    { id: 'done',    label: 'Done',    count: 7 },
  ];
  const issues = {
    todo: [
      { id: 'ATLAS-204', title: 'Rate-limit /api/login', tags: ['api','sec'], due: '2026-05-14' },
      { id: 'OPS-090',   title: 'Pager rotation for next sprint', tags: ['ops'] },
      { id: 'INT-019',   title: 'Slack notif for failed schedules', tags: ['integration'] },
    ],
    doing: [
      { id: 'ATLAS-142', title: 'Add OAuth PKCE flow', tags: ['auth'], session: 'auth-refactor' },
      { id: 'ATLAS-201', title: 'Stabilize LoginUITests on iOS 18', tags: ['ios','flake'], session: 'ios-uitests' },
    ],
    review: [
      { id: 'ATLAS-188', title: 'Refresh-token rotation on logout', tags: ['auth'] },
    ],
    backlog: [
      { id: 'WEB-022', title: 'Hero copy refresh', tags: ['marketing'] },
      { id: 'WEB-024', title: 'Cookie banner i18n', tags: ['marketing'] },
      { id: 'DOC-005', title: 'API quickstart rewrite', tags: ['docs'] },
      { id: 'DOC-007', title: 'Migration runbook', tags: ['docs','ops'] },
    ],
    done: [],
  };
  return (
    <PageShell title="Board" sub="Issues, assigned to sessions" action={<button className="btn btn--primary">{I.plus}<span>New issue</span></button>}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: 12, minWidth: 1100}}>
        {cols.map(c => (
          <div key={c.id} style={{background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 320}}>
            <div className="row">
              <strong style={{fontSize: 12}}>{c.label}</strong>
              <span className="faint" style={{fontSize: 11}}>{c.count}</span>
              <span className="spacer"></span>
              <button className="btn btn--icon btn--ghost btn--sm">{I.plus}</button>
            </div>
            {(issues[c.id] || []).map(it => (
              <div key={it.id} className="card" style={{padding: 10}}>
                <div className="row" style={{gap: 6, marginBottom: 6}}>
                  <span className="pill" style={{fontSize: 10}}>{it.id}</span>
                  {it.session && <span className="pill pill--accent" style={{fontSize: 10}}>{it.session}</span>}
                </div>
                <div style={{fontSize: 12.5, fontWeight: 500, marginBottom: 6}}>{it.title}</div>
                <div className="row" style={{gap: 4, flexWrap: 'wrap'}}>
                  {it.tags.map(t => <span key={t} className="faint" style={{fontSize: 10}}>#{t}</span>)}
                  {it.due && <><span className="spacer"></span><span className="faint" style={{fontSize: 10}}>{it.due}</span></>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function CalendarTab() {
  const days = Array.from({length: 35}, (_, i) => i - 3);
  const events = { 5: ['ATLAS-142'], 8: ['team digest'], 14: ['ATLAS-204'], 19: ['report Q2'], 22: ['standup'] };
  return (
    <PageShell title="Calendar" sub="Board dues + extracted email events" action={<button className="btn">Subscribe (iCal)</button>}>
      <div className="row" style={{gap: 12, marginBottom: 12}}>
        <strong style={{fontSize: 18}}>May 2026</strong>
        <span className="spacer"></span>
        <div className="segment"><button aria-pressed="true">Month</button><button>Week</button><button>Agenda</button></div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden'}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{padding: 8, background: 'var(--surface)', fontSize: 11, color: 'var(--text-dim)', fontWeight: 500}}>{d}</div>
        ))}
        {days.map(d => (
          <div key={d} style={{background: 'var(--bg-elev)', minHeight: 78, padding: 6, display: 'flex', flexDirection: 'column', gap: 4}}>
            <span className="faint" style={{fontSize: 11, color: d <= 0 || d > 31 ? 'var(--text-faint)' : (d === 11 ? 'var(--accent)' : 'var(--text-dim)'), fontWeight: d === 11 ? 600 : 400}}>{d <= 0 ? 30 + d : d > 31 ? d - 31 : d}</span>
            {(events[d] || []).map(ev => (
              <span key={ev} className="pill pill--accent" style={{fontSize: 9, height: 16, padding: '0 6px'}}>{ev}</span>
            ))}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function ComingSoon({ title, sub }) {
  return (
    <PageShell title={title} sub={sub}>
      <div className="empty" style={{padding: 80}}>
        <h3>Coming next</h3>
        <p>This view is wired to the same shell. Real {title.toLowerCase()} surface is being designed — open the Sessions tab to see the current focus of this prototype.</p>
      </div>
    </PageShell>
  );
}

/* LegacyEmbed — iframe-passthrough to the original DASHBOARD_HTML.
   Re-uses every legacy tab (scheduler, files, notes, logs, …) without re-implementing them.
   The legacy dashboard accepts ?view=<name>&embedded=1 to auto-switch tab and hide its own chrome. */
function LegacyEmbed({ view, label }) {
  const src = `/legacy?view=${encodeURIComponent(view)}&embedded=1&token=${encodeURIComponent(window.AMUX_AUTH || '')}`;
  return (
    <div className="content" style={{padding: 0, height: '100%', display: 'flex', flexDirection: 'column'}}>
      <iframe
        src={src}
        title={label}
        style={{flex: 1, width: '100%', border: 'none', background: 'var(--bg)', minHeight: 0}}
      />
    </div>
  );
}

Object.assign(window, { PageShell, BoardTab, CalendarTab, ComingSoon, LegacyEmbed });

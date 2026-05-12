/* Workspace tabs (browser-style, "Tab 1 Tab 2 Tab 3 +")
   + ViewTabs (horizontal Sessions/Board/Calendar primary tabs) */

const { useState: useStateW, useRef: useRefW, useEffect: useEffectW } = React;

function WorkspaceTabs({ workspaces, activeIdx, onSwitch, onAdd, onClose, onRename }) {
  const [editing, setEditing] = useStateW(null);

  return (
    <div className="wtabs" role="tablist" aria-label="Workspaces">
      {workspaces.map((w, i) => (
        <div
          key={w.id}
          role="tab"
          aria-selected={i === activeIdx}
          className="wtab"
          onClick={() => onSwitch(i)}
          onDoubleClick={() => setEditing(i)}
          title="Double-click to rename · ⌘1-9 to switch">
          <span className="wtab__bullet" aria-hidden="true">●</span>
          {editing === i ? (
            <input
              autoFocus
              className="wtab__edit"
              defaultValue={w.name}
              onBlur={(e) => { onRename(i, e.target.value.trim() || `Tab ${i+1}`); setEditing(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') { e.target.value = w.name; e.target.blur(); }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="wtab__name">{w.name}</span>
          )}
          {workspaces.length > 1 && (
            <button
              className="wtab__close"
              onClick={(e) => { e.stopPropagation(); onClose(i); }}
              aria-label={`Close ${w.name}`}>×</button>
          )}
        </div>
      ))}
      <button className="wtab__add" onClick={onAdd} title="New tab (⌘T)" aria-label="New tab">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3v10M3 8h10"/></svg>
      </button>
    </div>
  );
}

const VIEW_TABS = [
  { id: 'sessions', label: 'Sessions', icon: I.sessions },
  { id: 'board',    label: 'Board',    icon: I.board },
  { id: 'calendar', label: 'Calendar', icon: I.calendar },
  { id: 'scheduler',label: 'Scheduler',icon: I.schedule },
  { id: 'files',    label: 'Files',    icon: I.files },
  { id: 'notes',    label: 'Notes',    icon: I.notes },
  { id: 'logs',     label: 'Logs',     icon: I.logs },
  { id: 'metrics',  label: 'Metrics',  icon: I.metrics },
];

function ViewTabs({ tab, setTab }) {
  return (
    <div className="vtabs" role="tablist" aria-label="Views">
      {VIEW_TABS.map(v => (
        <button
          key={v.id}
          role="tab"
          aria-selected={tab === v.id}
          className="vtab"
          onClick={() => setTab(v.id)}>
          <span className="vtab__icon">{v.icon}</span>
          <span className="vtab__label">{v.label}</span>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { WorkspaceTabs, ViewTabs });

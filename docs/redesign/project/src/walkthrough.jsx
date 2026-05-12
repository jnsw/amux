/* Onboarding walkthrough — ported from the legacy dashboard.
   Anchors a numbered "step bubble + body + Skip/Next" popover to specific DOM nodes
   in the redesign shell. Shows once on first visit; persisted via localStorage. */

const { useState: useStateWT, useEffect: useEffectWT, useRef: useRefWT } = React;

const WT_KEY = 'amux_redesign_walkthrough_done';

const WT_STEPS = [
  {
    target: () => document.querySelector('.btn--primary')                    // "+ New session"
              || document.querySelector('.nav__item[aria-current="page"]'),
    title: 'Create a session',
    body: 'Start here. Each session is a Claude Code agent running in tmux. Pick a project directory, optionally enable YOLO mode, and hit Start.',
    pos: 'bottom',
  },
  {
    target: () => document.querySelector('.sidebar') || document.querySelector('.wtabs'),
    title: 'Navigate with the sidebar',
    body: 'Switch between Sessions, Board, Calendar, Scheduler, Files, Logs and more. Hit ⌘K to open the command palette.',
    pos: 'right',
  },
  {
    target: () => document.querySelector('.sgrid') || document.querySelector('.scard') || document.querySelector('.content'),
    title: 'Your agent fleet',
    body: 'Sessions appear here as live cards — status dot, last output, token usage, last activity, and the current task.',
    pos: 'top',
  },
  {
    target: () => document.querySelector('.peek') || document.querySelector('.scard'),
    targetFallback: () => document.querySelector('.sgrid'),
    title: 'Peek & steer',
    body: 'Click a card to open the peek panel — output, tasks, schedules, files and memory side-by-side. Press F for fullscreen.',
    pos: 'left',
  },
  {
    target: () => [...document.querySelectorAll('.nav__item')].find(x => x.textContent.includes('Board')),
    title: 'Coordinate with the board',
    body: 'Plan work across your fleet. Create tasks, assign sessions, and agents claim them atomically — no duplicate work.',
    pos: 'right',
  },
  {
    target: () => document.querySelector('.wtabs') || document.querySelector('.brand'),
    title: 'Workspace tabs',
    body: 'Open multiple amux UI instances side-by-side. ⌘T for a new tab, ⌘1–9 to jump between them, double-click to rename.',
    pos: 'bottom',
  },
];

function _wtClampPosition(r, pos, tw, th) {
  const gap = 14, pad = 10;
  let top, left;
  if (pos === 'bottom') {
    top = r.bottom + pad + gap;
    left = r.left + r.width / 2 - tw / 2;
  } else if (pos === 'top') {
    top = r.top - pad - gap - th;
    left = r.left + r.width / 2 - tw / 2;
  } else if (pos === 'right') {
    top = r.top + r.height / 2 - th / 2;
    left = r.right + pad + gap;
  } else if (pos === 'left') {
    top = r.top + r.height / 2 - th / 2;
    left = r.left - pad - gap - tw;
  } else {
    top = r.bottom + pad + gap;
    left = r.left;
  }
  if (left < 12) left = 12;
  if (left + tw > window.innerWidth - 12) left = window.innerWidth - 12 - tw;
  if (top < 12) top = r.bottom + pad + gap;
  if (top + th > window.innerHeight - 12) top = r.top - pad - gap - th;
  return { top, left };
}

function Walkthrough() {
  const [open, setOpen] = useStateWT(false);
  const [step, setStep] = useStateWT(0);
  const [rect, setRect] = useStateWT(null);
  const [pos, setPos] = useStateWT({ top: 0, left: 0 });
  const tooltipRef = useRefWT(null);

  useEffectWT(() => {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(WT_KEY); } catch (e) {}
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Listen for manual reopen ("amux:walkthrough:open" custom event)
  useEffectWT(() => {
    function onOpen() { setStep(0); setOpen(true); }
    window.addEventListener('amux:walkthrough:open', onOpen);
    return () => window.removeEventListener('amux:walkthrough:open', onOpen);
  }, []);

  function getTargetEl() {
    const s = WT_STEPS[step];
    let el = null;
    try { el = typeof s.target === 'function' ? s.target() : document.querySelector(s.target); } catch (e) {}
    if (!el && s.targetFallback) try { el = typeof s.targetFallback === 'function' ? s.targetFallback() : document.querySelector(s.targetFallback); } catch (e) {}
    return el;
  }

  function reposition() {
    if (!open) return;
    const el = getTargetEl();
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect(r);
    const tt = tooltipRef.current;
    const tw = tt ? tt.offsetWidth  : 320;
    const th = tt ? tt.offsetHeight : 160;
    setPos(_wtClampPosition(r, WT_STEPS[step].pos, tw, th));
  }

  useEffectWT(() => {
    if (!open) return;
    // After render — position
    const id = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(id);
  }, [open, step]);

  useEffectWT(() => {
    if (!open) return;
    function onResize() { reposition(); }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // re-poll for target every 250ms (some targets render lazily)
    const iv = setInterval(reposition, 250);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true); clearInterval(iv); };
  }, [open, step]);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(WT_KEY, '1'); } catch (e) {}
  }
  function next() {
    if (step < WT_STEPS.length - 1) setStep(step + 1); else dismiss();
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!open) return null;
  const s = WT_STEPS[step];
  const isFirst = step === 0, isLast = step === WT_STEPS.length - 1;

  return (
    <div className="wt-root" style={{position: 'fixed', inset: 0, zIndex: 2147483600, pointerEvents: 'auto'}}>
      <div onClick={dismiss} style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)'}} />
      {rect && (
        <div style={{
          position: 'absolute',
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px var(--accent, #7c9eff)',
          pointerEvents: 'none',
        }} />
      )}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
          width: 320,
          background: 'var(--surface, #1a1a1d)',
          color: 'var(--text, #f1f3f5)',
          border: '1px solid var(--border, #2a2d33)',
          borderRadius: 12,
          padding: '14px 16px 12px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          fontSize: 13,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--accent, #7c9eff)', color: '#fff', fontSize: 12, fontWeight: 700,
          }}>{step + 1}</span>
          <strong style={{fontSize: 14, fontWeight: 600}}>{s.title}</strong>
        </div>
        <div style={{lineHeight: 1.45, color: 'var(--text-dim, #c7cbd1)', marginBottom: 14}}>{s.body}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{display: 'flex', gap: 4}}>
            {WT_STEPS.map((_, i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === step ? 'var(--accent, #7c9eff)' : (i < step ? 'var(--text-dim, #c7cbd1)' : 'var(--border, #2a2d33)'),
              }} />
            ))}
          </div>
          <span style={{flex: 1}} />
          <button onClick={dismiss} className="btn btn--ghost btn--sm" style={{fontSize: 12, padding: '4px 10px'}}>Skip</button>
          {!isFirst && <button onClick={prev} className="btn btn--sm" style={{fontSize: 12, padding: '4px 10px'}}>Back</button>}
          <button onClick={next} className="btn btn--primary btn--sm" style={{fontSize: 12, padding: '4px 12px'}}>{isLast ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

window.Walkthrough = Walkthrough;
window.openWalkthrough = () => window.dispatchEvent(new CustomEvent('amux:walkthrough:open'));

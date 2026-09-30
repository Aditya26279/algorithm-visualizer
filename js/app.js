'use strict';
/* ============================================================
   App shell: tabs, theme, keyboard shortcuts, resize
   ============================================================ */

(function (AV) {
  const tabs = {
    sort: AV.SortTab(),
    search: AV.SearchTab(),
    graph: AV.GraphTab(),
    race: AV.RaceTab(),
  };

  // Uniform transport API over Player-based tabs and the race tab
  const transport = (c) => c.player
    ? {
      toggle: () => c.player.toggle(),
      step: (d) => c.player.step(d),
      first: () => { c.player.pause(false); c.player.seek(0); },
      last: () => { c.player.pause(false); c.player.seek(c.player.last); },
    }
    : c;

  let active = 'sort';

  function show(name) {
    // own-property check: '#constructor', '#toString' etc. must not resolve to Object.prototype members
    if (!Object.prototype.hasOwnProperty.call(tabs, name)) name = 'sort';
    // stop animations in the tab being left (the race clock would otherwise keep running unseen)
    for (const k in tabs) {
      if (k === name) continue;
      if (tabs[k].player) tabs[k].player.pause();
      else if (tabs[k].pause) tabs[k].pause();
    }
    active = name;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
    const c = tabs[name];
    (c.onShow || c.redraw)();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// in some browsers */ }
  }

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

  /* theme */
  const themeBtn = document.getElementById('themeBtn');
  const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const syncThemeIcon = () => { themeBtn.innerHTML = document.documentElement.dataset.theme === 'light' ? MOON : SUN; };
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    AV.invalidateColors();
    syncThemeIcon();
    tabs[active].redraw();
  };
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('av-theme', next); } catch (e) { /* storage unavailable */ }
    applyTheme(next);
  });
  // follow OS theme changes unless the user picked one explicitly
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', (e) => {
      let stored = null;
      try { stored = localStorage.getItem('av-theme'); } catch (err) { /* storage unavailable */ }
      if (!stored) applyTheme(e.matches ? 'light' : 'dark');
    });
  }
  // sanitize a stored value that isn't one of ours
  if (!['light', 'dark'].includes(document.documentElement.dataset.theme)) document.documentElement.dataset.theme = 'dark';
  syncThemeIcon();

  /* help */
  const help = document.getElementById('help');
  document.getElementById('helpBtn').addEventListener('click', () => help.showModal());
  document.getElementById('helpClose').addEventListener('click', () => help.close());

  /* keyboard */
  const order = ['sort', 'search', 'graph', 'race'];
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || help.open) return;
    const tag = e.target.tagName;
    // leave form controls alone (Space must still toggle checkboxes, arrows must move sliders)
    if (tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'INPUT' || e.target.isContentEditable) return;
    const t = transport(tabs[active]);
    switch (e.key) {
      case ' ':
        if (tag === 'BUTTON') return;
        e.preventDefault(); t.toggle(); break;
      case 'ArrowRight': e.preventDefault(); t.step(e.shiftKey ? 10 : 1); break;
      case 'ArrowLeft': e.preventDefault(); t.step(e.shiftKey ? -10 : -1); break;
      case 'Home': e.preventDefault(); t.first(); break;
      case 'End': e.preventDefault(); t.last(); break;
      case 'r': case 'R': tabs[active].regenerate(); break;
      case '1': case '2': case '3': case '4': show(order[+e.key - 1]); break;
      case '?': help.showModal(); break;
      default: return;
    }
  });

  /* resize */
  let rz = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => tabs[active].redraw());
  });

  // back/forward or a hand-edited hash switches tabs
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (name !== active) show(name);
  });

  // canvases drawn before the web fonts arrived use fallback metrics — redraw once they load
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tabs[active].redraw());

  show(location.hash.slice(1) || 'sort');
})(window.AV);

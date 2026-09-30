'use strict';
/* ============================================================
   Core: utilities, step Recorder, Player, bar renderer
   ============================================================ */
window.AV = window.AV || {};

(function (AV) {
  /* ---------------- utilities ---------------- */
  AV.randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  AV.shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  AV.fmt = (n) => Math.round(n).toLocaleString('en-US');
  AV.compact = (n) => {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
    if (a > 0 && a < 1) return n.toPrecision(2);
    return String(Math.round(n * 10) / 10);
  };
  AV.log2 = (x) => Math.log(x) / Math.LN2;

  AV.PRESETS = {
    random: 'Random',
    nearly: 'Nearly sorted',
    reversed: 'Reversed',
    few: 'Few unique',
    sorted: 'Already sorted',
  };

  /** Array of n values in [5, 100] shaped by a preset. */
  AV.genArray = function (n, preset = 'random') {
    const ramp = Array.from({ length: n }, (_, i) => Math.round(5 + (95 * (i + 1)) / n));
    switch (preset) {
      case 'sorted': return ramp;
      case 'reversed': return ramp.reverse();
      case 'few': {
        const levels = [22, 46, 70, 94];
        return Array.from({ length: n }, () => levels[AV.randInt(0, 3)]);
      }
      case 'nearly': {
        const swaps = Math.max(1, Math.round(n / 10));
        for (let k = 0; k < swaps; k++) {
          const i = AV.randInt(0, n - 1);
          const j = Math.min(n - 1, Math.max(0, i + AV.randInt(-3, 3)));
          const t = ramp[i]; ramp[i] = ramp[j]; ramp[j] = t;
        }
        return ramp;
      }
      default: return AV.shuffle(ramp);
    }
  };

  /** Sorted array of n distinct positive integers (for searching). */
  AV.genSorted = function (n) {
    const a = new Array(n);
    let v = AV.randInt(1, 4);
    for (let i = 0; i < n; i++) { a[i] = v; v += AV.randInt(1, 4); }
    return a;
  };

  /* ---------------- Recorder ----------------
     Algorithms operate on the recorder's working array through
     compare / swap / write. Each operation costs one "op" and (when
     recording) emits an immutable frame. Unchanged snapshots are
     shared between frames to keep memory low. */
  class Recorder {
    constructor(arr, { record = true, copy = true } = {}) {
      this.a = copy ? arr.slice() : arr; // copy:false is only safe for read-only algorithms (searching)
      this.n = arr.length;
      this.record = record;
      this.frames = [];
      this.cmp = 0;
      this.wr = 0;
      this.sorted = record ? new Uint8Array(this.n) : null;
      this.ctx = {};
      this.line = -1;
      this._arr = null;
      this._sorted = null;
      this._push({ start: true });
    }
    _push(hl, note) {
      if (!this.record) return;
      if (!this._arr) this._arr = this.a.slice();
      if (!this._sorted) this._sorted = this.sorted.slice();
      this.frames.push({
        arr: this._arr, sorted: this._sorted, hl, ctx: { ...this.ctx },
        line: this.line, cmp: this.cmp, wr: this.wr, note,
      });
    }
    /** compare a[i] with a[j]; returns a[i] - a[j] */
    compare(i, j) {
      this.cmp++;
      const d = this.a[i] - this.a[j];
      if (this.record) this._push({ compare: [i, j], res: Math.sign(d) });
      return d;
    }
    /** compare a[i] with a plain value v (e.g. a search target) */
    compareVal(i, v, note) {
      this.cmp++;
      const d = this.a[i] - v;
      if (this.record) this._push({ compare: [i], vals: [this.a[i], v], res: Math.sign(d) }, note);
      return d;
    }
    /** compare two values held elsewhere (e.g. merge sort's aux buffer), highlighting positions idx */
    cmpv(idx, x, y) {
      this.cmp++;
      const d = x - y;
      if (this.record) this._push({ compare: idx, vals: [x, y], res: Math.sign(d), aux: true });
      return d;
    }
    swap(i, j) {
      const t = this.a[i]; this.a[i] = this.a[j]; this.a[j] = t;
      this.wr += 2;
      this._arr = null;
      this._push({ swap: [i, j] });
    }
    write(i, v) {
      this.a[i] = v;
      this.wr++;
      this._arr = null;
      this._push({ write: [i] });
    }
    markSorted(...idx) {
      if (!this.record) return;
      for (const i of idx) this.sorted[i] = 1;
      this._sorted = null;
    }
    finish() {
      if (!this.record) return;
      this.sorted.fill(1);
      this._sorted = null;
      this.ctx = {};
      this.line = -1;
      this._push({ done: true });
    }
    /** end a search: found at index i (or -1) */
    endSearch(i) {
      this.ctx = i >= 0 ? { range: [i, i] } : { range: [0, -1] };
      this._push(i >= 0 ? { found: i, done: true } : { missing: true, done: true });
      return i;
    }
  }
  AV.Recorder = Recorder;

  /* ---------------- theme colors (cached) ---------------- */
  let colorCache = null;
  AV.colors = () => {
    if (colorCache) return colorCache;
    const s = getComputedStyle(document.documentElement);
    const g = (k) => s.getPropertyValue(k).trim();
    colorCache = {
      bar: g('--bar'), dim: g('--bar-dim'), compare: g('--c-compare'), swap: g('--c-swap'),
      sorted: g('--c-sorted'), pivot: g('--c-pivot'), range: g('--c-range'), target: g('--c-target'),
      text: g('--text'), text2: g('--text-2'), text3: g('--text-3'), grid: g('--grid'),
      card: g('--card'), border: g('--border-2'), accent: g('--accent'),
    };
    return colorCache;
  };
  AV.invalidateColors = () => { colorCache = null; };

  /** Size a canvas's backing store to its CSS box × devicePixelRatio. */
  AV.fitCanvas = function (canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  function roundTop(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------------- bar renderer ----------------
     Draws a frame's array as bars. opt.mode = 'sort' | 'search';
     opt.target draws the search target line. */
  AV.drawBars = function (canvas, f, opt = {}) {
    if (!canvas.clientWidth || !canvas.clientHeight) return; // hidden tab — redrawn when shown
    const { ctx, w, h } = AV.fitCanvas(canvas);
    const C = AV.colors();
    ctx.clearRect(0, 0, w, h);
    if (!f) return;
    const arr = f.arr, n = arr.length, hl = f.hl || {}, cx = f.ctx || {};
    const search = opt.mode === 'search';
    let max = 1;
    for (let i = 0; i < n; i++) if (arr[i] > max) max = arr[i];
    if (search && opt.target != null && opt.target > max) max = opt.target;

    const padX = 4, padB = 4;
    let gap = n > 120 ? 0.6 : n > 60 ? 1.5 : n > 25 ? 3 : 5;
    let bw = (w - padX * 2 - gap * (n - 1)) / n;
    if (bw < 2) { gap = 0; bw = (w - padX * 2) / n; }
    const showVals = !opt.compact && bw >= 17;
    const padT = showVals ? 20 : 10;
    const H = h - padT - padB;
    const x = (i) => padX + i * (bw + gap);

    // active range backdrop
    if (cx.range && cx.range[1] >= cx.range[0] && !(search && hl.done)) {
      const [a, b] = cx.range;
      ctx.fillStyle = C.range;
      ctx.fillRect(x(a) - gap / 2 - 1, 0, x(b) + bw - x(a) + gap + 2, h);
    }

    const cmp = hl.compare || [], sw = hl.swap || hl.write || [];
    for (let i = 0; i < n; i++) {
      let c = C.bar;
      if (f.sorted && f.sorted[i] && !search) c = C.sorted;
      if (search && cx.range && (i < cx.range[0] || i > cx.range[1])) c = C.dim;
      if (cx.pivot === i) c = C.pivot;
      if (cmp[0] === i || cmp[1] === i) c = C.compare;
      if (sw[0] === i || sw[1] === i) c = C.swap;
      if (hl.found === i) c = C.sorted;
      const bh = Math.max(2, (arr[i] / max) * H);
      ctx.fillStyle = c;
      if (bw >= 5) roundTop(ctx, x(i), h - padB - bh, bw, bh, Math.min(4, bw / 3));
      else ctx.fillRect(x(i), h - padB - bh, Math.max(bw, 0.8), bh);
      if (showVals) {
        ctx.fillStyle = c === C.bar || c === C.dim ? C.text3 : c;
        ctx.font = `600 ${bw >= 26 ? 11 : 9.5}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(arr[i]), x(i) + bw / 2, h - padB - bh - 5);
      }
    }

    // merge sort split marker
    if (cx.split != null && cx.range) {
      const sx = x(cx.split + 1) - gap / 2;
      ctx.strokeStyle = C.text3;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, 4); ctx.lineTo(sx, h); ctx.stroke();
      ctx.setLineDash([]);
    }

    // search target line
    if (search && opt.target != null) {
      const y = Math.max(1, Math.min(h - 1, h - padB - (opt.target / max) * H));
      ctx.strokeStyle = C.target;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.setLineDash([]);
      if (!opt.compact) {
        const label = `target ${opt.target}`;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const tw = ctx.measureText(label).width + 12;
        const ly = Math.max(2, y - 22);
        ctx.fillStyle = C.target;
        ctx.fillRect(w - tw - 2, ly, tw, 18);
        ctx.fillStyle = C.card;
        ctx.textAlign = 'center';
        ctx.fillText(label, w - tw / 2 - 2, ly + 13);
      }
    }
  };

  /* ---------------- Player ----------------
     Steps through a precomputed frame list with play/pause,
     single-step in both directions and scrubbing. */
  class Player {
    constructor(onFrame) {
      this.onFrame = onFrame;
      this.frames = [];
      this.i = 0;
      this.playing = false;
      this.sps = 20; // steps per second
      this.listeners = new Set();
      this._raf = 0;
      this._tick = this._tick.bind(this);
    }
    get last() { return Math.max(0, this.frames.length - 1); }
    get frame() { return this.frames[this.i]; }
    load(frames) { this.pause(false); this.frames = frames; this.i = 0; this._emit(); }
    play() {
      if (!this.frames.length) return;
      if (this.i >= this.last) this.i = 0;
      this.playing = true;
      this._t = performance.now();
      this._acc = 0;
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(this._tick);
      this._emit();
    }
    pause(emit = true) {
      this.playing = false;
      cancelAnimationFrame(this._raf);
      if (emit) this._emit();
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    step(d) { this.pause(false); this.seek(this.i + d); }
    seek(i) { this.i = Math.max(0, Math.min(this.last, i)); this._emit(); }
    _tick(t) {
      if (!this.playing) return;
      const dt = Math.min(100, t - this._t);
      this._t = t;
      this._acc += (dt / 1000) * this.sps;
      const k = Math.floor(this._acc);
      if (k > 0) {
        this._acc -= k;
        this.i = Math.min(this.last, this.i + k);
        if (this.i >= this.last) { this.playing = false; this._emit(); return; }
        this._emit();
      }
      this._raf = requestAnimationFrame(this._tick);
    }
    _emit() {
      this.onFrame(this.frames[this.i], this.i);
      for (const fn of this.listeners) fn(this);
    }
  }
  AV.Player = Player;

  /* ---------------- shared UI helpers ---------------- */
  AV.ICONS = {
    first: '<svg viewBox="0 0 24 24"><path d="M3 5h2v14H3zM13 5v14L6 12zM20 5v14l-7-7z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M5 5h2.5v14H5zM19 5v14L9 12z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16.5 5H19v14h-2.5zM5 5v14l10-7z"/></svg>',
    last: '<svg viewBox="0 0 24 24"><path d="M19 5h2v14h-2zM11 5v14l7-7zM4 5v14l7-7z"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-6.3 4H3l3.5-4.5L10 9H7.9A5 5 0 1 0 12 7z"/></svg>',
  };

  /** Speed slider 0..100 → steps per second (1 … 1000, logarithmic). */
  AV.speedFromSlider = (v) => Math.max(1, Math.round(Math.pow(10, (v * 3) / 100)));

  /** Build transport controls bound to a Player. */
  AV.mountPlayerUI = function (el, player, { speed = 42 } = {}) {
    const I = AV.ICONS;
    el.innerHTML = `
      <div class="transport">
        <button class="tbtn" data-a="first" title="First step (Home)" aria-label="First step">${I.first}</button>
        <button class="tbtn" data-a="prev" title="Step back (←)" aria-label="Step back">${I.prev}</button>
        <button class="tbtn play" data-a="play" title="Play / pause (Space)" aria-label="Play">${I.play}</button>
        <button class="tbtn" data-a="next" title="Step forward (→)" aria-label="Step forward">${I.next}</button>
        <button class="tbtn" data-a="last" title="Last step (End)" aria-label="Last step">${I.last}</button>
      </div>
      <div class="scrub-wrap">
        <input type="range" class="scrub" min="0" max="0" value="0" aria-label="Timeline">
        <div class="step-count"><span class="cur">0</span> / <span class="tot">0</span></div>
      </div>
      <label class="speed"><span>Speed</span><input type="range" min="0" max="100" value="${speed}" aria-label="Speed"><output></output></label>`;
    const playBtn = el.querySelector('[data-a="play"]');
    const scrub = el.querySelector('.scrub');
    const cur = el.querySelector('.cur'), tot = el.querySelector('.tot');
    const speedIn = el.querySelector('.speed input'), speedOut = el.querySelector('.speed output');

    el.querySelectorAll('.tbtn').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard shortcuts working
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'play') player.toggle();
        else if (a === 'prev') player.step(-1);
        else if (a === 'next') player.step(1);
        else if (a === 'first') { player.pause(false); player.seek(0); }
        else if (a === 'last') { player.pause(false); player.seek(player.last); }
      });
    });
    scrub.addEventListener('input', () => { player.pause(false); player.seek(+scrub.value); });
    const setSpeed = () => {
      player.sps = AV.speedFromSlider(+speedIn.value);
      speedOut.textContent = `${player.sps} step/s`;
    };
    speedIn.addEventListener('input', setSpeed);
    setSpeed();

    player.listeners.add((p) => {
      playBtn.innerHTML = p.playing ? I.pause : I.play;
      playBtn.setAttribute('aria-label', p.playing ? 'Pause' : 'Play');
      scrub.max = p.last;
      scrub.value = p.i;
      cur.textContent = AV.fmt(p.i);
      tot.textContent = AV.fmt(p.last);
    });
  };

  /** Render pseudocode lines into an <ol>. Returns a highlighter fn(line). */
  AV.mountCode = function (ol, lines) {
    ol.innerHTML = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
    const items = ol.children;
    let prev = -1;
    return (line) => {
      if (line === prev) return;
      if (prev >= 0 && items[prev]) items[prev].classList.remove('on');
      if (line >= 0 && items[line]) items[line].classList.add('on');
      prev = line;
    };
  };

  AV.renderInfo = function (el, a) {
    const cx = a.cx;
    const cells = cx.time
      ? [['Time', cx.time], ['Space', cx.space]]
      : [['Best', cx.best], ['Average', cx.avg], ['Worst', cx.worst], ['Space', cx.space]];
    el.innerHTML = `
      <div class="cx-grid" style="grid-template-columns:repeat(${cells.length},1fr)">
        ${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}
      </div>
      <div class="chips">${(a.tags || []).map(([t, c]) => `<span class="chip ${c || ''}">${t}</span>`).join('')}</div>
      <p class="desc">${a.desc}</p>`;
  };

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  AV.escapeHtml = escapeHtml;
})(window.AV);

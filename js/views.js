'use strict';
/* ============================================================
   Views: SVG graph renderer and canvas line chart
   ============================================================ */

(function (AV) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  /* ---------------- GraphView ---------------- */
  class GraphView {
    constructor(svg, handlers = {}) {
      this.svg = svg;
      this.h = handlers;
    }
    setGraph(g) {
      this.g = g;
      const svg = this.svg;
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${g.W} ${g.H}`);
      const ge = el('g'), gn = el('g');
      this.edgeEls = new Map();
      for (const [a, b] of g.edges) {
        const A = g.nodes[a], B = g.nodes[b];
        const line = el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'edge' });
        ge.append(line);
        this.edgeEls.set(AV.edgeKey(a, b), line);
      }
      this.nodeEls = g.nodes.map((nd) => {
        const grp = el('g', { class: 'node', transform: `translate(${nd.x.toFixed(1)},${nd.y.toFixed(1)})` });
        const ring = el('circle', { r: 26, class: 'ring' });
        const body = el('circle', { r: 20, class: 'body' });
        const lbl = el('text', { class: 'lbl' });
        lbl.textContent = nd.label;
        const badge = el('g', { class: 'badge', transform: 'translate(17,-17)' });
        const bc = el('circle', { r: 10 });
        const bt = el('text');
        badge.append(bc, bt);
        const tag = el('text', { class: 'tag', y: 42 });
        grp.append(ring, body, lbl, badge, tag);
        grp.addEventListener('click', (e) => this.h.onNodeClick && this.h.onNodeClick(nd.id, e));
        grp.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.h.onNodeContext && this.h.onNodeContext(nd.id, e);
        });
        gn.append(grp);
        return { grp, bt, tag };
      });
      svg.append(ge, gn);
    }
    render(f, start, target) {
      if (!this.g || !f) return;
      const tree = new Set(f.tree);
      const pathE = new Set(f.pathEdges || []);
      const pathN = new Set(f.path || []);
      const active = f.edge ? AV.edgeKey(f.edge[0], f.edge[1]) : null;
      for (const [k, line] of this.edgeEls) {
        let c = 'edge';
        if (pathE.has(k)) c += ' path';
        else if (k === active) c += ' active';
        else if (tree.has(k)) c += ' tree';
        line.setAttribute('class', c);
      }
      const ord = new Map();
      f.order.forEach((id, i) => ord.set(id, i + 1));
      this.nodeEls.forEach(({ grp, bt, tag }, id) => {
        let c = 'node';
        const st = f.state[id];
        if (pathN.has(id)) c += ' path';
        else if (id === f.cur) c += ' current';
        else if (st === 2) c += ' visited';
        else if (st === 1) c += ' frontier';
        if (id === start) c += ' start';
        if (id === target) c += ' target';
        if (ord.has(id)) { c += ' has-order'; bt.textContent = ord.get(id); }
        grp.setAttribute('class', c);
        tag.textContent = id === start ? 'start' : id === target ? 'target' : '';
      });
      // keep active edge on top for visibility
      if (active && this.edgeEls.has(active)) {
        const ln = this.edgeEls.get(active);
        ln.parentNode.appendChild(ln);
      }
    }
  }
  AV.GraphView = GraphView;

  /* ---------------- LineChart ---------------- */
  function niceStep(range, count) {
    const raw = range / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const err = raw / mag;
    return mag * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  }

  class LineChart {
    constructor(canvas, tooltip) {
      this.canvas = canvas;
      this.tip = tooltip;
      this.data = null;
      this.hover = -1;
      canvas.addEventListener('mousemove', (e) => this._onMove(e));
      canvas.addEventListener('mouseleave', () => { this.hover = -1; this.tip.hidden = true; this.draw(); });
    }
    set(data) { this.data = data; this.hover = -1; this.tip.hidden = true; this.draw(); }

    _scales(w, h) {
      const d = this.data;
      const pad = { l: 58, r: 18, t: 16, b: 38 };
      const xs = d.xs;
      const x0 = xs[0], x1 = xs[xs.length - 1];
      let yMax = 0, yMin = Infinity;
      for (const s of d.series) for (const y of s.ys) { if (y > yMax) yMax = y; if (y > 0 && y < yMin) yMin = y; }
      if (!isFinite(yMin)) yMin = 1;
      yMax = yMax > 0 ? yMax * 1.08 : 1;
      const lx = (v) => Math.log(v);
      const sx = d.logX
        ? (v) => pad.l + ((lx(v) - lx(x0)) / (lx(x1) - lx(x0))) * (w - pad.l - pad.r)
        : (v) => pad.l + ((v - x0) / (x1 - x0)) * (w - pad.l - pad.r);
      let sy, yLo = 0;
      if (d.logY) {
        yLo = Math.pow(10, Math.floor(Math.log10(yMin)));
        const yHi = Math.pow(10, Math.ceil(Math.log10(yMax)));
        yMax = yHi;
        sy = (v) => h - pad.b - ((Math.log10(Math.max(v, yLo * 1e-3)) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo))) * (h - pad.t - pad.b);
      } else {
        sy = (v) => h - pad.b - (v / yMax) * (h - pad.t - pad.b);
      }
      return { pad, sx, sy, x0, x1, yMax, yLo };
    }

    draw() {
      if (!this.canvas.clientWidth) return; // hidden — redrawn when shown
      const { ctx, w, h } = AV.fitCanvas(this.canvas);
      ctx.clearRect(0, 0, w, h);
      const d = this.data;
      if (!d) return;
      const C = AV.colors();
      const S = this._scales(w, h);
      const { pad, sx, sy } = S;
      const fmtY = d.fmtY || AV.compact;

      // grid + y ticks
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = C.text3;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const yt = [];
      if (d.logY) { for (let v = S.yLo; v <= S.yMax * 1.0001; v *= 10) yt.push(v); }
      else { const st = niceStep(S.yMax, 5); for (let v = 0; v <= S.yMax; v += st) yt.push(v); }
      for (const v of yt) {
        const y = Math.round(sy(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillText(fmtY(v), pad.l - 8, y);
      }
      // x ticks = sample sizes
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      let lastX = -1e9;
      for (const v of d.xs) {
        const x = sx(v);
        if (x - lastX < 34) continue;
        lastX = x;
        ctx.fillText(AV.compact(v), x, h - pad.b + 8);
      }
      ctx.fillText(d.xLabel || 'n', (pad.l + w - pad.r) / 2, h - 14);
      ctx.save();
      ctx.translate(13, (pad.t + h - pad.b) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(d.yLabel || '', 0, 0);
      ctx.restore();

      // clip plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.l, pad.t - 4, w - pad.l - pad.r, h - pad.t - pad.b + 4);
      ctx.clip();

      // reference curves
      for (const ref of d.refs || []) {
        ctx.strokeStyle = C.text3;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const N = 80;
        let lastPt = null;
        for (let k = 0; k <= N; k++) {
          const v = d.logX ? S.x0 * Math.pow(S.x1 / S.x0, k / N) : S.x0 + ((S.x1 - S.x0) * k) / N;
          const X = sx(v), Y = sy(ref.f(v));
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          if (Y >= pad.t) lastPt = [X, Y];
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (lastPt) {
          ctx.fillStyle = C.text3;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.font = 'italic 11px "JetBrains Mono", monospace';
          ctx.fillText(ref.name, Math.min(lastPt[0], w - pad.r - 2), Math.max(pad.t + 12, lastPt[1] - 3));
        }
      }

      // series
      for (const s of d.series) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        s.ys.forEach((y, i) => { const X = sx(d.xs[i]), Y = sy(y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke();
        ctx.fillStyle = s.color;
        s.ys.forEach((y, i) => { ctx.beginPath(); ctx.arc(sx(d.xs[i]), sy(y), this.hover === i ? 5 : 3, 0, Math.PI * 2); ctx.fill(); });
      }
      ctx.restore();

      // hover crosshair
      if (this.hover >= 0) {
        const X = Math.round(sx(d.xs[this.hover])) + 0.5;
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X, pad.t); ctx.lineTo(X, h - pad.b); ctx.stroke();
      }
    }

    _onMove(e) {
      const d = this.data;
      if (!d) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const S = this._scales(rect.width, rect.height);
      let best = -1, bd = Infinity;
      d.xs.forEach((v, i) => { const dd = Math.abs(S.sx(v) - mx); if (dd < bd) { bd = dd; best = i; } });
      if (best !== this.hover) { this.hover = best; this.draw(); }
      if (best < 0) return;
      const fmtY = d.fmtTip || d.fmtY || AV.fmt;
      const rows = d.series
        .map((s) => ({ s, y: s.ys[best] }))
        .sort((a, b) => b.y - a.y)
        .map(({ s, y }) => `<div class="t-row"><span><i class="sw" style="--c:${s.color}"></i>${s.name}</span><b>${fmtY(y)}</b></div>`)
        .join('');
      this.tip.innerHTML = `<div class="t-head">n = ${AV.fmt(d.xs[best])}</div>${rows}`;
      this.tip.hidden = false;
      const tx = S.sx(d.xs[best]);
      const tw = this.tip.offsetWidth;
      this.tip.style.left = (tx + 14 + tw > rect.width ? tx - tw - 14 : tx + 14) + 'px';
      this.tip.style.top = '16px';
    }
  }
  AV.LineChart = LineChart;
})(window.AV);

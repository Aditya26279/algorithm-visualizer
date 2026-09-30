'use strict';
/* ============================================================
   Tab controllers: Sorting, Searching, Graph traversal
   ============================================================ */

(function (AV) {
  const $ = (id) => document.getElementById(id);
  const options = (obj, label = (v) => v.name) =>
    Object.entries(obj).map(([k, v]) => `<option value="${k}">${label(v)}</option>`).join('');

  /* ======================= SORTING ======================= */
  AV.SortTab = function () {
    const algoSel = $('sort-algo'), nIn = $('sort-n'), presetSel = $('sort-preset');
    const canvas = $('sort-canvas'), note = $('sort-note');
    algoSel.innerHTML = options(AV.SORTS);
    presetSel.innerHTML = options(AV.PRESETS, (v) => v);

    let base = [], algo, hiCode, refs = { nlogn: 1, n2: 1 };
    const player = new AV.Player(render);
    AV.mountPlayerUI($('sort-player'), player, { speed: 45 });

    function build(fresh) {
      const n = +nIn.value;
      $('sort-n-val').textContent = n;
      if (fresh || base.length !== n) base = AV.genArray(n, presetSel.value);
      algo = AV.SORTS[algoSel.value];
      $('sort-title').textContent = algo.name;
      $('sort-sub').textContent = `${algo.cx.avg} average · ${algo.cx.worst} worst · n = ${n}`;
      hiCode = AV.mountCode($('sort-code'), algo.code);
      AV.renderInfo($('sort-info'), algo);
      refs = { nlogn: Math.max(1, n * AV.log2(n)), n2: Math.max(1, (n * (n - 1)) / 2) };
      $('sort-ref-nlogn').textContent = AV.fmt(refs.nlogn);
      $('sort-ref-n2').textContent = AV.fmt(refs.n2);
      const r = new AV.Recorder(base);
      algo.run(r);
      player.load(r.frames);
    }

    function meter(id, v, ref) {
      const pct = (v / ref) * 100;
      const m = $(id);
      m.firstElementChild.style.width = Math.min(100, pct) + '%';
      m.classList.toggle('over', pct > 100);
      m.title = `${pct.toFixed(0)}%`;
    }

    function narrate(f) {
      const h = f.hl;
      if (f.note) return f.note;
      if (h.start) return `Initial array of ${f.arr.length} values — press play (Space) or step (→).`;
      if (h.done) return `Sorted! ${AV.fmt(f.cmp)} comparisons and ${AV.fmt(f.wr)} writes.`;
      const sym = h.res < 0 ? '<' : h.res > 0 ? '>' : '=';
      if (h.compare) {
        const [i, j] = h.compare;
        if (h.aux) return `Merge: compare aux[${i}] = ${h.vals[0]}  ${sym}  aux[${j}] = ${h.vals[1]}`;
        return `Compare A[${i}] = ${f.arr[i]}  ${sym}  A[${j}] = ${f.arr[j]}`;
      }
      if (h.swap) return `Swap A[${h.swap[0]}] ↔ A[${h.swap[1]}]  →  ${f.arr[h.swap[0]]}, ${f.arr[h.swap[1]]}`;
      if (h.write) return `Write ${f.arr[h.write[0]]} into A[${h.write[0]}]`;
      return '';
    }

    function render(f) {
      if (!f) return;
      AV.drawBars(canvas, f, { mode: 'sort' });
      $('sort-cmp').textContent = AV.fmt(f.cmp);
      $('sort-wr').textContent = AV.fmt(f.wr);
      $('sort-step').textContent = AV.fmt(player.i);
      meter('sort-m-nlogn', f.cmp, refs.nlogn);
      meter('sort-m-n2', f.cmp, refs.n2);
      $('sort-pct-nlogn').textContent = ((f.cmp / refs.nlogn) * 100).toFixed(0) + '%';
      $('sort-pct-n2').textContent = ((f.cmp / refs.n2) * 100).toFixed(0) + '%';
      hiCode(f.line);
      note.textContent = narrate(f);
    }

    algoSel.addEventListener('change', () => build(false));
    presetSel.addEventListener('change', () => build(true));
    nIn.addEventListener('input', () => build(true));
    $('sort-new').addEventListener('click', () => build(true));
    build(true);

    return { player, redraw: () => render(player.frame), regenerate: () => build(true) };
  };

  /* ======================= SEARCHING ======================= */
  AV.SearchTab = function () {
    const algoSel = $('search-algo'), nIn = $('search-n'), tIn = $('search-target');
    const canvas = $('search-canvas'), note = $('search-note'), result = $('search-result');
    algoSel.innerHTML = options(AV.SEARCHES);
    algoSel.value = 'binary';

    let base = [], target = 0, algo, hiCode;
    const player = new AV.Player(render);
    AV.mountPlayerUI($('search-player'), player, { speed: 18 });

    const pickPresent = () => { target = base[AV.randInt(0, base.length - 1)]; tIn.value = target; };
    const pickMissing = () => {
      const set = new Set(base);
      let v;
      do { v = AV.randInt(1, base[base.length - 1] + 3); } while (set.has(v));
      target = v;
      tIn.value = target;
    };

    function build(fresh) {
      const n = +nIn.value;
      $('search-n-val').textContent = n;
      if (fresh || base.length !== n) { base = AV.genSorted(n); pickPresent(); }
      algo = AV.SEARCHES[algoSel.value];
      $('search-title').textContent = algo.name;
      $('search-sub').textContent = `${algo.cx.avg} average · ${algo.cx.worst} worst · n = ${n}`;
      hiCode = AV.mountCode($('search-code'), algo.code);
      AV.renderInfo($('search-info'), algo);
      $('search-ref-n').textContent = AV.fmt(n);
      $('search-ref-log').textContent = AV.fmt(Math.floor(AV.log2(n)) + 1);
      const r = new AV.Recorder(base);
      algo.run(r, target);
      player.load(r.frames);
    }

    function narrate(f) {
      const h = f.hl;
      if (h.start) return `Searching ${f.arr.length} sorted values for ${target}.`;
      if (h.found != null) return `Found ${target} at index ${h.found} after ${f.cmp} comparison${f.cmp === 1 ? '' : 's'}.`;
      if (h.missing) return `${target} is not in the array — gave up after ${f.cmp} comparison${f.cmp === 1 ? '' : 's'}.`;
      if (h.compare) {
        const i = h.compare[0], [x, t] = h.vals;
        const sym = h.res < 0 ? '<' : h.res > 0 ? '>' : '=';
        let tail = '';
        if (algoSel.value === 'binary' && h.res) tail = h.res < 0 ? '  → search right half' : '  → search left half';
        if (algoSel.value === 'jump' && f.line === 1) tail = h.res < 0 ? '  → jump ahead' : '  → scan this block';
        return `Probe A[${i}] = ${x}  ${sym}  target ${t}${tail}`;
      }
      return '';
    }

    function render(f) {
      if (!f) return;
      AV.drawBars(canvas, f, { mode: 'search', target });
      $('search-cmp').textContent = AV.fmt(f.cmp);
      $('search-step').textContent = AV.fmt(player.i);
      const r = f.ctx.range;
      $('search-left').textContent = f.hl.done ? (f.hl.found != null ? 1 : 0) : r ? AV.fmt(r[1] - r[0] + 1) : AV.fmt(f.arr.length);
      hiCode(f.line);
      note.textContent = narrate(f);
      result.className = 'result';
      if (f.hl.found != null) { result.classList.add('found'); result.textContent = `✓ Found at index ${f.hl.found}`; }
      else if (f.hl.missing) { result.classList.add('missing'); result.textContent = `✗ Not found`; }
      else result.textContent = player.i === 0 ? 'Ready — press play.' : 'Searching…';
    }

    algoSel.addEventListener('change', () => build(false));
    nIn.addEventListener('input', () => build(true));
    tIn.addEventListener('change', () => {
      // Number() (not parseInt) so "1e3" means 1000; clamp so the target line stays meaningful
      const v = Math.round(Number(tIn.value));
      if (tIn.value.trim() !== '' && Number.isFinite(v)) {
        target = Math.max(0, Math.min(9999, v));
        build(false);
      }
      tIn.value = target;
    });
    $('search-present').addEventListener('click', () => { pickPresent(); build(false); });
    $('search-missing').addEventListener('click', () => { pickMissing(); build(false); });
    $('search-new').addEventListener('click', () => build(true));
    build(true);

    return { player, redraw: () => render(player.frame), regenerate: () => build(true) };
  };

  /* ======================= GRAPH ======================= */
  const GRAPH_SIZES = { small: [5, 3], medium: [6, 4], large: [8, 5] };

  AV.GraphTab = function () {
    const algoSel = $('graph-algo'), sizeSel = $('graph-size'), densIn = $('graph-density');
    const note = $('graph-note');
    algoSel.innerHTML = options(AV.GRAPH_ALGOS);

    let g, start = 0, target = -1, algo, hiCode;
    const view = new AV.GraphView($('graph-svg'), {
      onNodeClick(id, e) {
        if (e.shiftKey || e.altKey) setTarget(id);
        else { start = id; if (target === id) target = -1; build(); }
      },
      onNodeContext(id) { setTarget(id); },
    });
    const setTarget = (id) => { target = target === id || id === start ? -1 : id; build(); };

    const player = new AV.Player(render);
    AV.mountPlayerUI($('graph-player'), player, { speed: 30 });

    function newGraph() {
      const [c, r] = GRAPH_SIZES[sizeSel.value];
      g = AV.genGraph(c, r, +densIn.value / 100);
      start = 0;
      target = -1;
      view.setGraph(g);
      build();
    }

    function build() {
      algo = AV.GRAPH_ALGOS[algoSel.value];
      $('graph-title').textContent = algo.name;
      $('graph-sub').textContent = `${g.nodes.length} nodes · ${g.edges.length} edges · ${algo.cx.time}`;
      $('graph-cont-name').textContent = algo.container;
      $('graph-cont-hint').textContent = algo.containerHint;
      $('graph-target-lbl').textContent = target >= 0 ? g.nodes[target].label : 'none';
      $('graph-start-lbl').textContent = g.nodes[start].label;
      hiCode = AV.mountCode($('graph-code'), algo.code);
      AV.renderInfo($('graph-info'), algo);
      player.load(algo.run(g, start, target));
    }

    const chips = (ids, cls = '') =>
      ids.length ? ids.slice(0, 40).map((id) => `<span class="n ${cls}">${g.nodes[id].label}</span>`).join('') + (ids.length > 40 ? '<span class="empty">…</span>' : '')
        : '<span class="empty">empty</span>';

    function render(f) {
      if (!f) return;
      view.render(f, start, target);
      $('graph-visited').textContent = f.order.length;
      $('graph-edges').textContent = f.examined;
      $('graph-peak').textContent = f.peak;
      $('graph-cont').innerHTML = chips(f.container);
      $('graph-order').innerHTML = f.order.length
        ? f.order.map((id, i) => `<span class="n"><small>${i + 1}</small>${g.nodes[id].label}</span>`).join('')
        : '<span class="empty">none yet</span>';
      hiCode(f.line);
      note.textContent = f.note || '';
    }

    algoSel.addEventListener('change', build);
    sizeSel.addEventListener('change', newGraph);
    densIn.addEventListener('change', newGraph);
    $('graph-new').addEventListener('click', newGraph);
    $('graph-clear-target').addEventListener('click', () => { target = -1; build(); });
    newGraph();

    return { player, redraw: () => render(player.frame), regenerate: newGraph };
  };
})(window.AV);

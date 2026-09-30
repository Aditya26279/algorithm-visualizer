'use strict';
/* ============================================================
   Race mode: algorithms run side by side on identical input,
   driven by one shared clock measured in operations
   (1 comparison or 1 array write = 1 op). Plus the Complexity
   Lab, which measures growth empirically across input sizes.
   ============================================================ */

(function (AV) {
  const $ = (id) => document.getElementById(id);
  const ordinal = (k) => k + (['th', 'st', 'nd', 'rd'][(k % 100 > 10 && k % 100 < 14) ? 0 : k % 10] || 'th');
  const opsRate = (v) => Math.round(Math.pow(10, 0.5 + (v * 3.5) / 100)); // slider 0..100 → ~3 … 10,000 ops/s

  const CAT = {
    sort: { algos: () => AV.SORTS, n: [10, 200, 50], speed: 58, label: 'Sorting' },
    search: { algos: () => AV.SEARCHES, n: [20, 1000, 300], speed: 32, label: 'Searching' },
  };

  /* Last frame whose cumulative op count ≤ t (ops is non-decreasing). */
  function lastLE(ops, t) {
    let lo = 0, hi = ops.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ops[mid] <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  AV.RaceTab = function () {
    const lanesEl = $('race-lanes'), picksEl = $('race-picks');
    const nIn = $('race-n'), presetSel = $('race-preset'), speedIn = $('race-speed');
    const scrub = $('race-scrub'), playBtn = $('race-play'), resultsEl = $('race-results');

    let cat = 'sort';
    const selected = { sort: new Set(['merge', 'quick', 'heap', 'insertion', 'bubble']), search: new Set(['linear', 'binary', 'jump']) };
    let lanes = [], base = [], target = 0;
    let T = 0, maxT = 0, rate = 300, playing = false, raf = 0, lastTs = 0, resultsShown = false;

    presetSel.innerHTML = Object.entries(AV.PRESETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    /* ---------------- setup UI ---------------- */
    function renderPicks() {
      picksEl.innerHTML = Object.entries(CAT[cat].algos())
        .map(([k, a]) => `<label class="pick ${selected[cat].has(k) ? 'on' : ''}" style="--lane:${AV.ALGO_COLORS[k]}">
            <input type="checkbox" value="${k}" ${selected[cat].has(k) ? 'checked' : ''}><i></i>${a.name}</label>`)
        .join('');
    }
    picksEl.addEventListener('change', (e) => {
      const box = e.target, k = box.value, set = selected[cat];
      if (box.checked) set.add(k);
      else if (set.size > 1) set.delete(k);
      else box.checked = true; // keep at least one contestant
      // update in place (re-rendering would drop keyboard focus)
      box.closest('.pick').classList.toggle('on', box.checked);
      build(false);
      scheduleLab();
    });
    picksEl.addEventListener('mousedown', (e) => { if (e.target.closest('.pick')) e.preventDefault(); });

    function setCategory(c) {
      cat = c;
      document.querySelectorAll('#race-cat button').forEach((b) => b.classList.toggle('on', b.dataset.cat === c));
      const [lo, hi, def] = CAT[c].n;
      nIn.min = lo; nIn.max = hi; nIn.value = def;
      speedIn.value = CAT[c].speed;
      $('race-preset-wrap').hidden = c !== 'sort';
      setRate();
      renderPicks();
      build(true);
      setupLabMetrics();
      scheduleLab();
    }
    document.querySelectorAll('#race-cat button').forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.cat)));

    function setRate() {
      rate = opsRate(+speedIn.value);
      $('race-speed-val').textContent = `${AV.fmt(rate)} ops/s`;
    }
    speedIn.addEventListener('input', setRate);

    /* ---------------- build a race ---------------- */
    function build(fresh) {
      pause();
      const n = +nIn.value;
      $('race-n-val').textContent = n;
      if (fresh || base.length !== n) {
        base = cat === 'sort' ? AV.genArray(n, presetSel.value) : AV.genSorted(n);
        if (cat === 'search') target = base[AV.randInt(Math.floor(n * 0.55), n - 1)];
      }
      const algos = CAT[cat].algos();
      lanes = Object.keys(algos).filter((k) => selected[cat].has(k)).map((k) => {
        const a = algos[k];
        const r = new AV.Recorder(base);
        cat === 'sort' ? a.run(r) : a.run(r, target);
        const ops = new Float64Array(r.frames.length);
        r.frames.forEach((f, i) => { ops[i] = f.cmp + f.wr; });
        return { key: k, algo: a, frames: r.frames, ops, total: ops[ops.length - 1], idx: -1 };
      });
      lanes.forEach((l) => { l.rank = 1 + lanes.filter((o) => o.total < l.total).length; });
      maxT = Math.max(...lanes.map((l) => l.total));
      T = 0;
      scrub.max = maxT;
      $('race-input-desc').textContent = cat === 'sort'
        ? `${n} values · ${AV.PRESETS[presetSel.value].toLowerCase()}`
        : `${n} sorted values · target ${target} (index ${base.indexOf(target)})`;

      lanesEl.innerHTML = '';
      for (const l of lanes) {
        const el = document.createElement('div');
        el.className = 'card lane';
        el.style.setProperty('--lane', AV.ALGO_COLORS[l.key]);
        el.innerHTML = `
          <div class="lane-head"><span class="lane-name">${l.algo.name}</span><span class="badge-cx">${l.algo.badge}</span><span class="lane-status">ready</span></div>
          <canvas></canvas>
          <div class="lane-stats"><span>cmp <b class="s-cmp">0</b></span>${cat === 'sort' ? '<span>writes <b class="s-wr">0</b></span>' : ''}<span>ops <b class="s-ops">0</b></span></div>
          <div class="lane-progress"><i></i></div>`;
        lanesEl.append(el);
        Object.assign(l, {
          el, canvas: el.querySelector('canvas'), status: el.querySelector('.lane-status'),
          sCmp: el.querySelector('.s-cmp'), sWr: el.querySelector('.s-wr'), sOps: el.querySelector('.s-ops'),
          bar: el.querySelector('.lane-progress i'),
        });
      }
      resultsShown = false;
      resultsEl.hidden = true;
      update(true);
      syncPlay(); // T was reset — the button must not still say "Replay"
    }

    /* ---------------- clock ---------------- */
    function update(force) {
      const mode = cat === 'sort' ? 'sort' : 'search';
      let allDone = true;
      for (const l of lanes) {
        const idx = lastLE(l.ops, T);
        if (idx !== l.idx || force) {
          l.idx = idx;
          const f = l.frames[idx];
          AV.drawBars(l.canvas, f, { mode, target: cat === 'search' ? target : null, compact: true });
          l.sCmp.textContent = AV.fmt(f.cmp);
          if (l.sWr) l.sWr.textContent = AV.fmt(f.wr);
          l.sOps.textContent = AV.fmt(f.cmp + f.wr);
          l.bar.style.width = (100 * (f.cmp + f.wr)) / l.total + '%';
        }
        const done = T >= l.total;
        if (!done) allDone = false;
        l.status.textContent = done ? `${ordinal(l.rank)} · ${AV.fmt(l.total)} ops` : T > 0 ? 'running…' : 'ready';
        l.status.classList.toggle('done', done);
        l.el.classList.toggle('winner', done && l.rank === 1);
      }
      $('race-clock').textContent = AV.fmt(Math.floor(T));
      scrub.value = T;
      if (allDone && !resultsShown) showResults();
      if (!allDone && resultsShown) { resultsShown = false; resultsEl.hidden = true; }
    }

    function tick(ts) {
      if (!playing) return;
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;
      T = Math.min(maxT, T + dt * rate);
      update(false);
      if (T >= maxT) { pause(); return; }
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (T >= maxT) { T = 0; update(true); }
      playing = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
      syncPlay();
    }
    function pause() {
      playing = false;
      cancelAnimationFrame(raf);
      syncPlay();
    }
    const toggle = () => (playing ? pause() : play());
    function syncPlay() {
      playBtn.innerHTML = (playing ? AV.ICONS.pause : AV.ICONS.play) + `<span>${playing ? 'Pause' : T >= maxT && maxT > 0 ? 'Replay' : T > 0 ? 'Resume' : 'Start race'}</span>`;
    }
    function seek(t) { pause(); T = Math.max(0, Math.min(maxT, t)); update(false); syncPlay(); }

    playBtn.addEventListener('click', toggle);
    $('race-step').addEventListener('click', () => seek(Math.floor(T) + 1));
    $('race-reset').addEventListener('click', () => seek(0));
    $('race-new').addEventListener('click', () => { build(true); scheduleLab(); });
    scrub.addEventListener('input', () => seek(+scrub.value));
    nIn.addEventListener('input', () => build(true));
    presetSel.addEventListener('change', () => { build(true); scheduleLab(); });
    [playBtn, $('race-step'), $('race-reset'), $('race-new')].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

    /* ---------------- results ---------------- */
    function showResults() {
      resultsShown = true;
      const byOps = [...lanes].sort((a, b) => a.total - b.total);
      const best = byOps[0].total, worst = byOps[byOps.length - 1].total;
      const rows = byOps.map((l) => {
        const f = l.frames[l.frames.length - 1];
        return `<tr style="--lane:${AV.ALGO_COLORS[l.key]}">
          <td><span class="rank ${l.rank === 1 ? 'r1' : ''}">${l.rank}</span></td>
          <td class="name"><i></i>${l.algo.name}</td>
          <td>${l.algo.badge}</td>
          <td>${AV.fmt(f.cmp)}</td>
          ${cat === 'sort' ? `<td>${AV.fmt(f.wr)}</td>` : ''}
          <td><b>${AV.fmt(l.total)}</b></td>
          <td>${(l.total / best).toFixed(l.total / best >= 10 ? 0 : 1)}×</td>
          <td class="rel"><div class="rel-bar" style="width:${(100 * l.total) / worst}%"></div></td>
        </tr>`;
      }).join('');
      const win = byOps[0], lose = byOps[byOps.length - 1];
      let insight = lanes.length > 1
        ? `<b>${win.algo.name}</b> finished first with ${AV.fmt(best)} operations; <b>${lose.algo.name}</b> needed <b>${(worst / best).toFixed(1)}×</b> as much work.`
        : `${win.algo.name} finished in ${AV.fmt(best)} operations.`;
      if (cat === 'sort' && selected.sort.has('quick') && ['sorted', 'reversed'].includes(presetSel.value))
        insight += ' Notice Quick Sort: a last-element pivot on ordered input makes every partition lopsided — its O(n²) worst case.';
      if (cat === 'sort' && selected.sort.has('insertion') && ['nearly', 'sorted'].includes(presetSel.value))
        insight += ' Insertion Sort shines here: on (nearly) sorted input it is close to O(n).';
      if (cat === 'search') insight += ` Linear search grows with n; binary search needs at most ⌊log₂n⌋ + 1 = ${Math.floor(AV.log2(base.length)) + 1} probes.`;
      resultsEl.innerHTML = `
        <h3>Race results</h3>
        <p class="desc" style="margin:0 0 12px">${insight}</p>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>#</th><th>Algorithm</th><th>Big-O</th><th>Comparisons</th>${cat === 'sort' ? '<th>Writes</th>' : ''}<th>Total ops</th><th>vs. winner</th><th class="rel"></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
      resultsEl.hidden = false;
    }

    /* ======================= Complexity Lab ======================= */
    const LAB_SIZES = {
      sort: [10, 25, 50, 100, 200, 400, 700, 1000],
      search: [16, 64, 256, 1024, 4096, 16384, 65536],
    };
    const METRICS = {
      sort: { cmp: 'Comparisons', ops: 'Total operations', wr: 'Writes', time: 'Wall time (ms)' },
      search: { cmp: 'Comparisons (avg per search)', time: 'Wall time (µs per search)' },
    };
    const metricSel = $('lab-metric'), logIn = $('lab-log'), statusEl = $('lab-status');
    const chart = new AV.LineChart($('lab-canvas'), $('lab-tip'));
    let lab = null, labToken = 0, labTimer = 0, labStarted = false;

    function setupLabMetrics() {
      const prev = metricSel.value;
      metricSel.innerHTML = Object.entries(METRICS[cat]).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
      if (METRICS[cat][prev]) metricSel.value = prev;
    }

    function scheduleLab() {
      if (!labStarted) return;
      clearTimeout(labTimer);
      labTimer = setTimeout(runLab, 250);
    }

    const nextTick = () => new Promise((r) => setTimeout(r, 0));

    function timeIt(fn, budgetMs = 4, maxReps = 400) {
      let reps = 0;
      const t0 = performance.now();
      let t = t0;
      do { fn(); reps++; t = performance.now(); } while (t - t0 < budgetMs && reps < maxReps);
      return (t - t0) / reps;
    }

    async function runLab() {
      const token = ++labToken;
      const c = cat, preset = presetSel.value;
      const algos = CAT[c].algos();
      const keys = Object.keys(algos).filter((k) => selected[c].has(k));
      const xs = LAB_SIZES[c];
      const runs = {};
      $('lab-run').disabled = true;
      for (const k of keys) {
        const a = algos[k];
        const R = (runs[k] = { cmp: [], wr: [], ops: [], time: [] });
        for (const n of xs) {
          statusEl.textContent = `measuring ${a.name}, n = ${AV.fmt(n)}…`;
          await nextTick();
          if (token !== labToken) return;
          if (c === 'sort') {
            const trials = preset === 'sorted' || preset === 'reversed' ? 1 : 3;
            let cmp = 0, wr = 0, arr;
            for (let t = 0; t < trials; t++) {
              arr = AV.genArray(n, preset);
              const r = new AV.Recorder(arr, { record: false });
              a.run(r);
              cmp += r.cmp; wr += r.wr;
            }
            R.cmp.push(cmp / trials); R.wr.push(wr / trials); R.ops.push((cmp + wr) / trials);
            R.time.push(timeIt(() => a.run(new AV.Recorder(arr, { record: false })), 6, 60));
          } else {
            const arr = AV.genSorted(n);
            const targets = Array.from({ length: 64 }, () => arr[AV.randInt(0, n - 1)]);
            let cmp = 0;
            for (const t of targets) { const r = new AV.Recorder(arr, { record: false, copy: false }); a.run(r, t); cmp += r.cmp; }
            R.cmp.push(cmp / targets.length);
            let ti = 0;
            const per = timeIt(() => { const r = new AV.Recorder(arr, { record: false, copy: false }); a.run(r, targets[ti++ & 63]); }, 6, 20000);
            R.time.push(per * 1000); // µs
          }
        }
      }
      lab = { cat: c, xs, runs, keys, preset };
      $('lab-run').disabled = false;
      statusEl.textContent = `${keys.length} algorithms × ${xs.length} sizes` + (c === 'sort' ? ` · ${AV.PRESETS[preset].toLowerCase()} input` : ' · 64 random targets each');
      drawLab();
    }

    function fitExponent(xs, ys) {
      const from = Math.floor(xs.length / 2) - 1;
      const pts = xs.map((x, i) => [Math.log(x), Math.log(ys[i])]).slice(Math.max(0, from)).filter(([, y]) => isFinite(y));
      if (pts.length < 2) return NaN;
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      let num = 0, den = 0;
      for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
      return num / den;
    }
    function describe(e) {
      if (!isFinite(e)) return '—';
      if (e < 0.3) return 'logarithmic';
      if (e < 0.7) return '≈ √n';
      if (e < 1.08) return 'linear';
      if (e < 1.4) return '≈ n log n';
      if (e < 1.75) return 'super-linear';
      return 'quadratic';
    }

    function drawLab() {
      if (!lab) return;
      $('lab-empty').hidden = true;
      $('lab-chart').hidden = false;
      const m = METRICS[lab.cat][metricSel.value] ? metricSel.value : 'cmp';
      const algos = CAT[lab.cat].algos();
      const series = lab.keys.map((k) => ({ key: k, name: algos[k].name, color: AV.ALGO_COLORS[k], ys: lab.runs[k][m] }));
      let refs = [];
      if (m !== 'time') {
        refs = lab.cat === 'sort'
          ? [{ name: 'n log₂n', f: (n) => n * AV.log2(n) }, { name: 'n²/2', f: (n) => (n * n) / 2 }]
          : [{ name: 'n', f: (n) => n }, { name: '√n', f: (n) => Math.sqrt(n) }, { name: 'log₂n', f: (n) => AV.log2(n) }];
      }
      const unit = m === 'time' ? (lab.cat === 'sort' ? ' ms' : ' µs') : '';
      const fmtTime = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(2)) + unit;
      chart.set({
        xs: lab.xs, series, refs,
        logX: logIn.checked,
        logY: logIn.checked,
        xLabel: 'input size n',
        yLabel: METRICS[lab.cat][m],
        fmtY: m === 'time' ? fmtTime : AV.compact,
        fmtTip: m === 'time' ? fmtTime : AV.fmt,
      });
      $('lab-legend').innerHTML = series.map((s) => {
        const e = fitExponent(lab.xs, s.ys);
        return `<div class="item" style="--lane:${s.color}"><i></i><span>${s.name}</span>
          <span class="fit">grows like n<sup><b>${isFinite(e) ? e.toFixed(2) : '—'}</b></sup> · ${describe(e)}</span></div>`;
      }).join('') + (refs.length ? `<div class="item ref"><i></i><span class="fit">dashed = reference curves ${refs.map((r) => r.name).join(', ')}</span></div>` : '');
    }

    metricSel.addEventListener('change', drawLab);
    logIn.addEventListener('change', drawLab);
    $('lab-run').addEventListener('click', runLab);

    /* ---------------- init ---------------- */
    setRate();
    setCategory('sort');

    return {
      toggle,
      pause,
      step: (d) => seek(Math.floor(T) + d),
      first: () => seek(0),
      last: () => seek(maxT),
      regenerate: () => { build(true); scheduleLab(); },
      onShow() {
        if (!labStarted) { labStarted = true; runLab(); }
        update(true);
        drawLab();
      },
      redraw() { update(true); if (lab) chart.draw(); },
    };
  };
})(window.AV);

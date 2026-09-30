'use strict';
/* ============================================================
   Algorithms: sorting, searching, graph traversal.
   Sorting/searching run against an AV.Recorder; graph traversal
   builds its own frame list.
   ============================================================ */

(function (AV) {
  /* Lane / series colors shared by race mode and the lab chart */
  AV.ALGO_COLORS = {
    merge: '#60a5fa', quick: '#f472b6', heap: '#34d399',
    insertion: '#fbbf24', selection: '#fb923c', bubble: '#a78bfa',
    linear: '#fb923c', binary: '#60a5fa', jump: '#34d399',
  };

  /* ======================= SORTING ======================= */
  AV.SORTS = {
    merge: {
      name: 'Merge Sort',
      cx: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
      badge: 'O(n log n)',
      tags: [['Stable', 'good'], ['Divide & conquer'], ['Not in-place', 'bad']],
      desc: 'Recursively splits the array in half, sorts each half, then merges the two sorted halves using an auxiliary buffer. Performance is the same regardless of input order.',
      code: [
        'mergeSort(lo, hi):',
        '  if lo ≥ hi: return',
        '  mid ← ⌊(lo + hi) / 2⌋',
        '  mergeSort(lo, mid);  mergeSort(mid + 1, hi)',
        '  aux[lo..hi] ← A[lo..hi]',
        '  i ← lo;  j ← mid + 1',
        '  for k ← lo to hi:',
        '    if j > hi or (i ≤ mid and aux[i] ≤ aux[j]):',
        '      A[k] ← aux[i];  i ← i + 1',
        '    else:  A[k] ← aux[j];  j ← j + 1',
      ],
      run(r) {
        const aux = new Array(r.n);
        const sort = (lo, hi) => {
          if (hi <= lo) return;
          const mid = (lo + hi) >> 1;
          r.ctx = { range: [lo, hi] };
          r.line = 3;
          sort(lo, mid);
          sort(mid + 1, hi);
          r.ctx = { range: [lo, hi], split: mid };
          for (let k = lo; k <= hi; k++) aux[k] = r.a[k];
          let i = lo, j = mid + 1;
          for (let k = lo; k <= hi; k++) {
            if (i > mid) break; // remaining right-half items are already in place
            if (j > hi) { r.line = 8; r.write(k, aux[i++]); continue; }
            r.line = 7;
            if (r.cmpv([i, j], aux[i], aux[j]) <= 0) { r.line = 8; r.write(k, aux[i++]); }
            else { r.line = 9; r.write(k, aux[j++]); }
          }
        };
        sort(0, r.n - 1);
        r.finish();
      },
    },

    quick: {
      name: 'Quick Sort',
      cx: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)' },
      badge: 'O(n log n)*',
      tags: [['Unstable', 'bad'], ['In-place', 'good'], ['Lomuto partition']],
      desc: 'Picks the last element as a pivot, partitions smaller values to its left, then recurses on both sides. Try the “Already sorted” input: a last-element pivot degrades to O(n²).',
      code: [
        'quickSort(lo, hi):',
        '  if lo ≥ hi: return',
        '  pivot ← A[hi];  i ← lo',
        '  for j ← lo to hi − 1:',
        '    if A[j] < pivot:',
        '      swap(A[i], A[j]);  i ← i + 1',
        '  swap(A[i], A[hi])        ▹ pivot lands in final spot',
        '  quickSort(lo, i − 1);  quickSort(i + 1, hi)',
      ],
      run(r) {
        const qs = (lo, hi) => {
          if (lo > hi) return;
          if (lo === hi) { r.markSorted(lo); return; }
          r.ctx = { range: [lo, hi], pivot: hi };
          let i = lo;
          for (let j = lo; j < hi; j++) {
            r.line = 4;
            if (r.compare(j, hi) < 0) {
              r.line = 5;
              if (i !== j) r.swap(i, j);
              i++;
            }
          }
          r.line = 6;
          if (i !== hi) r.swap(i, hi);
          r.markSorted(i);
          r.line = 7;
          qs(lo, i - 1);
          qs(i + 1, hi);
        };
        qs(0, r.n - 1);
        r.finish();
      },
    },

    heap: {
      name: 'Heap Sort',
      cx: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
      badge: 'O(n log n)',
      tags: [['Unstable', 'bad'], ['In-place', 'good'], ['Binary heap']],
      desc: 'Builds a max-heap inside the array, then repeatedly swaps the largest element (the root) to the end and restores the heap on the shrinking prefix.',
      code: [
        'for i ← ⌊n/2⌋ − 1 down to 0:  siftDown(i, n)   ▹ build heap',
        'for end ← n − 1 down to 1:',
        '  swap(A[0], A[end])        ▹ max goes to its final spot',
        '  siftDown(0, end)',
        'siftDown(i, size):',
        '  largest ← i;  l ← 2i + 1;  r ← 2i + 2',
        '  if l < size and A[l] > A[largest]: largest ← l',
        '  if r < size and A[r] > A[largest]: largest ← r',
        '  if largest ≠ i: swap(A[i], A[largest]); siftDown(largest, size)',
      ],
      run(r) {
        const n = r.n;
        const sift = (i, size) => {
          for (;;) {
            r.ctx = { range: [0, size - 1], pivot: i };
            let big = i;
            const l = 2 * i + 1, rt = 2 * i + 2;
            if (l < size) { r.line = 6; if (r.compare(l, big) > 0) big = l; }
            if (rt < size) { r.line = 7; if (r.compare(rt, big) > 0) big = rt; }
            if (big === i) return;
            r.line = 8;
            r.swap(i, big);
            i = big;
          }
        };
        for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
        for (let end = n - 1; end > 0; end--) {
          r.ctx = { range: [0, end] };
          r.line = 2;
          r.swap(0, end);
          r.markSorted(end);
          sift(0, end);
        }
        r.finish();
      },
    },

    insertion: {
      name: 'Insertion Sort',
      cx: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
      badge: 'O(n²)',
      tags: [['Stable', 'good'], ['In-place', 'good'], ['Adaptive']],
      desc: 'Grows a sorted prefix one element at a time, sliding each new element left until it fits. Very fast on nearly-sorted data (O(n)), slow on reversed data.',
      code: [
        'for i ← 1 to n − 1:',
        '  j ← i',
        '  while j > 0 and A[j − 1] > A[j]:',
        '    swap(A[j − 1], A[j])',
        '    j ← j − 1',
      ],
      run(r) {
        for (let i = 1; i < r.n; i++) {
          r.ctx = { range: [0, i] };
          let j = i;
          while (j > 0) {
            r.line = 2;
            if (r.compare(j - 1, j) <= 0) break;
            r.line = 3;
            r.swap(j - 1, j);
            j--;
          }
        }
        r.finish();
      },
    },

    selection: {
      name: 'Selection Sort',
      cx: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
      badge: 'O(n²)',
      tags: [['Unstable', 'bad'], ['In-place', 'good'], ['Few writes']],
      desc: 'Scans the unsorted suffix for the minimum and swaps it into place. Always does ~n²/2 comparisons, but at most n − 1 swaps.',
      code: [
        'for i ← 0 to n − 2:',
        '  min ← i',
        '  for j ← i + 1 to n − 1:',
        '    if A[j] < A[min]: min ← j',
        '  swap(A[i], A[min])',
      ],
      run(r) {
        const n = r.n;
        for (let i = 0; i < n - 1; i++) {
          let min = i;
          r.ctx = { range: [i, n - 1], pivot: min };
          for (let j = i + 1; j < n; j++) {
            r.line = 3;
            if (r.compare(j, min) < 0) { min = j; r.ctx.pivot = min; }
          }
          r.line = 4;
          if (min !== i) r.swap(i, min);
          r.markSorted(i);
        }
        r.finish();
      },
    },

    bubble: {
      name: 'Bubble Sort',
      cx: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
      badge: 'O(n²)',
      tags: [['Stable', 'good'], ['In-place', 'good'], ['Early exit']],
      desc: 'Repeatedly walks the array swapping adjacent out-of-order pairs; the largest remaining value “bubbles” to the end each pass. Stops early if a pass makes no swaps.',
      code: [
        'for i ← 0 to n − 2:',
        '  swapped ← false',
        '  for j ← 0 to n − 2 − i:',
        '    if A[j] > A[j + 1]:',
        '      swap(A[j], A[j + 1]);  swapped ← true',
        '  if not swapped: break',
      ],
      run(r) {
        const n = r.n;
        for (let i = 0; i < n - 1; i++) {
          let swapped = false;
          r.ctx = { range: [0, n - 1 - i] };
          for (let j = 0; j < n - 1 - i; j++) {
            r.line = 3;
            if (r.compare(j, j + 1) > 0) { r.line = 4; r.swap(j, j + 1); swapped = true; }
          }
          r.markSorted(n - 1 - i);
          if (!swapped) break;
        }
        r.finish();
      },
    },
  };

  /* ======================= SEARCHING ======================= */
  AV.SEARCHES = {
    linear: {
      name: 'Linear Search',
      cx: { best: 'O(1)', avg: 'O(n)', worst: 'O(n)', space: 'O(1)' },
      badge: 'O(n)',
      tags: [['Any order', 'good'], ['Sequential']],
      desc: 'Checks every element from left to right until it finds the target. Works on unsorted data but touches every element in the worst case.',
      code: [
        'for i ← 0 to n − 1:',
        '  if A[i] = target: return i',
        'return −1   ▹ not found',
      ],
      run(r, t) {
        for (let i = 0; i < r.n; i++) {
          r.ctx = { range: [i, r.n - 1] };
          r.line = 1;
          if (r.compareVal(i, t) === 0) return r.endSearch(i);
        }
        r.line = 2;
        return r.endSearch(-1);
      },
    },

    binary: {
      name: 'Binary Search',
      cx: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(1)' },
      badge: 'O(log n)',
      tags: [['Needs sorted input', 'bad'], ['Divide & conquer']],
      desc: 'Compares the target with the middle element and discards the half that cannot contain it. Each probe halves the search space: 1,000,000 items need at most 20 probes.',
      code: [
        'lo ← 0;  hi ← n − 1',
        'while lo ≤ hi:',
        '  mid ← ⌊(lo + hi) / 2⌋',
        '  if A[mid] = target: return mid',
        '  if A[mid] < target: lo ← mid + 1',
        '  else: hi ← mid − 1',
        'return −1',
      ],
      run(r, t) {
        let lo = 0, hi = r.n - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          r.ctx = { range: [lo, hi] };
          r.line = 3;
          const d = r.compareVal(mid, t);
          if (d === 0) return r.endSearch(mid);
          if (d < 0) lo = mid + 1; else hi = mid - 1;
        }
        r.line = 6;
        return r.endSearch(-1);
      },
    },

    jump: {
      name: 'Jump Search',
      cx: { best: 'O(1)', avg: 'O(√n)', worst: 'O(√n)', space: 'O(1)' },
      badge: 'O(√n)',
      tags: [['Needs sorted input', 'bad'], ['Block scan']],
      desc: 'Jumps ahead in blocks of √n until it overshoots the target, then scans linearly inside the last block. A middle ground between linear and binary search.',
      code: [
        'step ← ⌊√n⌋;  prev ← 0',
        'while A[min(step, n) − 1] < target:',
        '  prev ← step;  step ← step + ⌊√n⌋',
        '  if prev ≥ n: return −1',
        'for i ← prev to min(step, n) − 1:',
        '  if A[i] = target: return i   ▹ stop once A[i] > target',
        'return −1',
      ],
      run(r, t) {
        const n = r.n, b = Math.max(1, Math.floor(Math.sqrt(n)));
        let prev = 0, step = b;
        for (;;) {
          r.ctx = { range: [prev, n - 1] };
          r.line = 1;
          if (r.compareVal(Math.min(step, n) - 1, t) >= 0) break;
          prev = step;
          step += b;
          if (prev >= n) { r.line = 3; return r.endSearch(-1); }
        }
        const end = Math.min(step, n);
        for (let i = prev; i < end; i++) {
          r.ctx = { range: [i, end - 1] };
          r.line = 5;
          const d = r.compareVal(i, t);
          if (d === 0) return r.endSearch(i);
          if (d > 0) break;
        }
        r.line = 6;
        return r.endSearch(-1);
      },
    },
  };

  /* ======================= GRAPHS ======================= */
  AV.nodeLabel = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + (i % 26)) + Math.floor(i / 26));
  AV.edgeKey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

  /** Random connected, planar-looking graph on a jittered grid. */
  AV.genGraph = function (cols = 6, rows = 4, density = 0.55) {
    const W = 900, H = 520, padX = 70, padY = 60;
    const dx = (W - 2 * padX) / (cols - 1), dy = (H - 2 * padY) / (rows - 1);
    const nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        nodes.push({
          id, label: AV.nodeLabel(id),
          x: padX + c * dx + (Math.random() - 0.5) * dx * 0.45,
          y: padY + r * dy + (Math.random() - 0.5) * dy * 0.4,
        });
      }
    }
    const id = (r, c) => r * cols + c;
    const grid = [], diag = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) grid.push([id(r, c), id(r, c + 1)]);
        if (r + 1 < rows) grid.push([id(r, c), id(r + 1, c)]);
        if (c + 1 < cols && r + 1 < rows) {
          // at most one diagonal per cell so edges never cross
          diag.push(Math.random() < 0.5 ? [id(r, c), id(r + 1, c + 1)] : [id(r, c + 1), id(r + 1, c)]);
        }
      }
    }
    const parent = nodes.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const chosen = new Map();
    const add = ([a, b]) => { chosen.set(AV.edgeKey(a, b), [Math.min(a, b), Math.max(a, b)]); parent[find(a)] = find(b); };
    for (const e of grid) if (Math.random() < density) add(e);
    for (const e of diag) if (Math.random() < density * 0.35) add(e);
    // guarantee connectivity using leftover grid edges
    for (const e of AV.shuffle(grid.slice())) if (find(e[0]) !== find(e[1])) add(e);

    const edges = [...chosen.values()];
    const adj = nodes.map(() => []);
    for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    adj.forEach((l) => l.sort((x, y) => x - y));
    return { W, H, nodes, edges, adj };
  };

  function traverse(g, s, t, kind) {
    const n = g.nodes.length, L = (i) => g.nodes[i].label;
    const bfs = kind === 'bfs';
    const state = new Int8Array(n); // 0 = unseen, 1 = frontier, 2 = visited
    const parent = new Int32Array(n).fill(-1);
    const tree = [], order = [], frames = [];
    const cont = [];
    let cur = -1, examined = 0, peak = 0;

    const push = (line, note, extra) => {
      peak = Math.max(peak, cont.length);
      frames.push({
        state: state.slice(), tree: tree.slice(), order: order.slice(),
        container: bfs ? cont.slice() : cont.map((c) => c[0]).reverse(),
        cur, examined, peak, line, note, ...extra,
      });
    };
    const found = (u, line) => {
      const path = [];
      for (let x = u; x !== -1; x = parent[x]) path.unshift(x);
      const pathEdges = [];
      for (let k = 1; k < path.length; k++) pathEdges.push(AV.edgeKey(path[k - 1], path[k]));
      cur = -1;
      push(line, `Found ${L(t)}! Path ${path.map(L).join(' → ')} (${path.length - 1} edges). ` +
        (bfs ? 'BFS guarantees this is a shortest path.' : 'DFS paths are not necessarily shortest.'),
        { done: true, path, pathEdges });
      return frames;
    };

    if (bfs) {
      cont.push(s); state[s] = 1;
      push(0, `Start at ${L(s)}: enqueue it and mark it discovered.`);
      while (cont.length) {
        const u = cont.shift();
        cur = u; state[u] = 2; order.push(u);
        push(2, `Dequeue ${L(u)} and visit it (#${order.length}).`);
        if (u === t) return found(u, 3);
        for (const v of g.adj[u]) {
          examined++;
          if (state[v] === 0) {
            state[v] = 1; parent[v] = u; tree.push(AV.edgeKey(u, v)); cont.push(v);
            push(7, `Edge ${L(u)}–${L(v)}: ${L(v)} is new → mark discovered and enqueue.`, { edge: [u, v] });
          } else {
            push(5, `Edge ${L(u)}–${L(v)}: ${L(v)} already ${state[v] === 2 ? 'visited' : 'in the queue'} — skip.`, { edge: [u, v] });
          }
        }
      }
    } else {
      cont.push([s, -1]); state[s] = 1;
      push(0, `Push ${L(s)} onto the stack.`);
      while (cont.length) {
        const [u, p] = cont.pop();
        if (state[u] === 2) { push(3, `Pop ${L(u)} — already visited, skip.`); continue; }
        cur = u; state[u] = 2; order.push(u); parent[u] = p;
        if (p >= 0) tree.push(AV.edgeKey(p, u));
        push(4, `Pop ${L(u)} and visit it (#${order.length})${p >= 0 ? ` — reached from ${L(p)}` : ''}.`);
        if (u === t) return found(u, 5);
        const nb = g.adj[u];
        for (let k = nb.length - 1; k >= 0; k--) {
          const v = nb[k];
          examined++;
          if (state[v] !== 2) {
            state[v] = 1; cont.push([v, u]);
            push(8, `Edge ${L(u)}–${L(v)}: ${L(v)} not visited → push it.`, { edge: [u, v] });
          } else {
            push(7, `Edge ${L(u)}–${L(v)}: ${L(v)} already visited — skip.`, { edge: [u, v] });
          }
        }
      }
    }
    cur = -1;
    push(1, `${bfs ? 'Queue' : 'Stack'} empty — traversal complete: ${order.length} nodes visited, ${examined} edge checks.` +
      (t >= 0 ? ` ${L(t)} is unreachable.` : ''), { done: true });
    return frames;
  }

  AV.GRAPH_ALGOS = {
    bfs: {
      name: 'Breadth-First Search',
      short: 'BFS',
      container: 'Queue',
      containerHint: 'front → back',
      cx: { time: 'O(V + E)', space: 'O(V)' },
      tags: [['Shortest path (unweighted)', 'good'], ['Level by level'], ['FIFO queue']],
      desc: 'Explores the graph in waves: all nodes one edge away, then two edges away, and so on. The first time BFS reaches a node, it has found a shortest path to it.',
      code: [
        'queue ← [start];  mark start discovered',
        'while queue is not empty:',
        '  u ← queue.dequeue();  visit(u)',
        '  if u = target: return path   ▹ shortest!',
        '  for each neighbor v of u:',
        '    if v is discovered: skip',
        '    mark v discovered;  parent[v] ← u',
        '    queue.enqueue(v)',
      ],
      run: (g, s, t) => traverse(g, s, t, 'bfs'),
    },
    dfs: {
      name: 'Depth-First Search',
      short: 'DFS',
      container: 'Stack',
      containerHint: 'top → bottom',
      cx: { time: 'O(V + E)', space: 'O(V)' },
      tags: [['Goes deep first'], ['LIFO stack'], ['Paths not shortest', 'bad']],
      desc: 'Follows one branch as deep as possible before backtracking. Uses an explicit stack (neighbors pushed in reverse so the alphabetically-first is explored first).',
      code: [
        'stack ← [start]',
        'while stack is not empty:',
        '  u ← stack.pop()',
        '  if u is visited: continue',
        '  visit(u)',
        '  if u = target: return path',
        '  for each neighbor v of u (reverse order):',
        '    if v is visited: skip',
        '    parent[v] ← u;  stack.push(v)',
      ],
      run: (g, s, t) => traverse(g, s, t, 'dfs'),
    },
  };
})(window.AV);

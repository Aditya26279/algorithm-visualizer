# Algorithm Visualizer

An interactive, animated visualizer for **sorting**, **searching** and **graph traversal** algorithms, with step-through controls, live operation counters, highlighted pseudocode, and a side-by-side **Race Mode** that shows how time complexity plays out in practice.

Plain HTML, CSS and JavaScript: **no dependencies, no build step, no framework.**

---

## Table of contents

- [Quick start](#quick-start)
- [Features](#features)
- [Using the app](#using-the-app)
- [Algorithms and complexity](#algorithms-and-complexity)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Adding a new algorithm](#adding-a-new-algorithm)
- [Browser support](#browser-support)

---

## Quick start

**Option 1: open the file.** Double-click `index.html`. Everything runs from the local file system.

**Option 2: serve it locally** (recommended while developing, since some browsers restrict `file://` pages):

```bash
python -m http.server 5173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:5173>.

Node users can use any static server instead, e.g. `npx serve .`.

---

## Features

| Section | Algorithms | Highlights |
|---|---|---|
| **Sorting** | Merge, Quick, Heap, Insertion, Selection, Bubble | 5 input shapes; live comparison and write counters with meters against *n log₂n* and *n²/2* |
| **Searching** | Linear, Binary, Jump | Choose a target that is present or missing; eliminated regions dim as the search space shrinks |
| **Graph Traversal** | BFS, DFS | Random connected graphs; live queue/stack, visit order, BFS/DFS tree, and the path to a target |
| **Race Mode** | Any mix of sorting *or* searching algorithms | Identical input, one shared operation clock, finish ranks, and a results table |
| **Complexity Lab** | (inside Race Mode) | Measures cost across growing *n*, fits the empirical growth exponent, optional log–log axes |

Every visualizer also has:

- ▶️ play / pause, ⏮ ⏭ jump to start or end, and **single-step forward and backward**
- a timeline scrubber and adjustable speed (1–1000 steps/s)
- **highlighted pseudocode** following the current step
- a **narration line** explaining each step (e.g. `Compare A[3] = 42 > A[4] = 17`)
- light and dark themes (follows your OS until you pick one)
- a responsive layout that works down to phone width

---

## Using the app

### Sorting
Pick an algorithm, an array size (5–150), and an **input shape**:

| Shape | Why it's interesting |
|---|---|
| Random | The typical, average case |
| Nearly sorted | Insertion Sort becomes almost O(n) |
| Reversed | The worst case for Insertion and Bubble Sort |
| Few unique | Many equal keys |
| Already sorted | Quick Sort's last-element pivot degrades to **O(n²)** |

Bar colors: **amber** = comparing, **red** = swap/write, **violet** = pivot/focus, **green** = in final position. The shaded band marks the sub-array currently being worked on; merge sort also shows a dashed split line.

### Searching
Works on a sorted array. Use **In array** or **Missing** to pick a target (or type one, 0–9999). The dashed line marks the target value; bars that can no longer contain it are dimmed.

### Graph Traversal
- **Click** a node to make it the start.
- **Shift+click** or **right-click** a node to set a target. The traversal stops there and highlights the path found.
- Compare BFS and DFS on the same graph: BFS always finds a shortest path (fewest edges), while DFS usually doesn't.

The side panel shows the live **queue** (BFS) or **stack** (DFS), its peak size, the visit order, and the number of edge checks.

### Race Mode
1. Choose **Sorting** or **Searching**, then pick the contestants.
2. Set the input size and shape and press **Start race**.
3. All lanes share one clock measured in **operations** (1 comparison or 1 array write = 1 op), so an algorithm that needs more work visibly falls behind.
4. When all lanes finish, a results table ranks them and shows how many times more work each needed than the winner.

### Complexity Lab
Below the race, the lab runs each selected algorithm at many input sizes (up to *n* = 1,000 for sorting and 65,536 for searching), counting only with no animation, and plots the result:

- **Metrics:** comparisons, writes, total operations, or measured wall time
- **Reference curves:** *n log₂n* and *n²/2* for sorting; *n*, *√n* and *log₂n* for searching
- **Fitted exponent:** a least-squares fit on log–log data. For example, Bubble Sort fits about `n^1.98` (quadratic) and Merge Sort about `n^1.2` (n log n over this range)
- **log–log toggle:** on log–log axes a straight line with slope *k* means O(nᵏ)

---

## Algorithms and complexity

### Sorting

| Algorithm | Best | Average | Worst | Space | Stable |
|---|---|---|---|---|---|
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | ✅ |
| Quick Sort (Lomuto, last pivot) | O(n log n) | O(n log n) | O(n²) | O(log n) | ❌ |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | ❌ |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| Selection Sort | O(n²) | O(n²) | O(n²) | O(1) | ❌ |
| Bubble Sort (early exit) | O(n) | O(n²) | O(n²) | O(1) | ✅ |

### Searching (sorted input)

| Algorithm | Best | Average | Worst | Space |
|---|---|---|---|---|
| Linear Search | O(1) | O(n) | O(n) | O(1) |
| Binary Search | O(1) | O(log n) | O(log n) | O(1) |
| Jump Search | O(1) | O(√n) | O(√n) | O(1) |

### Graph traversal

| Algorithm | Time | Space | Data structure | Shortest path? |
|---|---|---|---|---|
| Breadth-First Search | O(V + E) | O(V) | FIFO queue | ✅ (unweighted) |
| Depth-First Search | O(V + E) | O(V) | LIFO stack | ❌ |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause (starts the race in Race Mode) |
| `←` / `→` | Step back / forward (`Shift` = ×10) |
| `Home` / `End` | Jump to the first / last step |
| `R` | New random input |
| `1` – `4` | Switch section |
| `?` | Show the shortcuts help |

Shortcuts are ignored while a form field (input, select, checkbox) has focus.

---

## Project structure

```
Algorithm Visualizer/
├── index.html          # Page markup for all four sections
├── css/
│   └── styles.css      # Theme tokens (light/dark), layout, components
├── js/
│   ├── core.js         # Utilities, Recorder, Player, bar renderer, shared UI helpers
│   ├── algorithms.js   # Sorting, searching and graph algorithms + metadata
│   ├── views.js        # SVG graph view and canvas line chart
│   ├── tabs.js         # Sorting / Searching / Graph tab controllers
│   ├── race.js         # Race Mode and Complexity Lab
│   └── app.js          # Tab routing, theme, keyboard shortcuts, resize handling
└── .claude/
    └── launch.json     # Local dev-server config for Claude Code's preview
```

Scripts are plain classic `<script>` files sharing one `window.AV` namespace, which lets the app run straight from `file://` without a bundler or ES-module loader.

---

## How it works

### Record, then replay
Algorithms don't animate directly. They run to completion against a **`Recorder`** (`js/core.js`), which wraps the array and exposes:

| Method | Cost | Purpose |
|---|---|---|
| `compare(i, j)` | 1 comparison | Compare two array slots |
| `compareVal(i, v)` | 1 comparison | Compare a slot with a value (e.g. a search target) |
| `cmpv(idx, x, y)` | 1 comparison | Compare values held elsewhere (e.g. merge sort's buffer) |
| `swap(i, j)` | 2 writes | Swap two slots |
| `write(i, v)` | 1 write | Overwrite a slot |
| `markSorted(...i)` | free | Mark indices as in their final position |

Each operation emits an immutable **frame** (array snapshot, highlights, current pseudocode line, counters). Snapshots that didn't change are shared between frames, so memory stays small. Because the whole run is precomputed, **stepping backward and scrubbing are instant**.

A generic **`Player`** then walks the frame list with `requestAnimationFrame`, at any speed and in either direction.

### Counting mode
`new Recorder(arr, { record: false })` runs the *same* algorithm code but only counts operations, with no frames or snapshots. The Complexity Lab uses this to measure large inputs quickly.

### Fair racing
In Race Mode every lane precomputes its frames and cumulative op counts. A single global clock `T` advances at the chosen ops/second, and each lane shows the **last frame whose `comparisons + writes ≤ T`** (found by binary search). Every algorithm gets exactly the same work budget per tick, so the finishing order reflects how much work each needed, not how fast its JavaScript happens to run.

### Graphs
`AV.genGraph` places nodes on a jittered grid, adds random grid and diagonal edges (at most one diagonal per cell, so no edges cross), then uses union-find to add edges until the graph is connected. BFS and DFS record their own frames: node states, tree edges, container contents and visit order.

---

## Adding a new algorithm

Add an entry to `AV.SORTS` (or `AV.SEARCHES`) in `js/algorithms.js`, and give it a color in `AV.ALGO_COLORS`. It then appears automatically in the Sorting tab, Race Mode and the Complexity Lab.

```js
AV.SORTS.shell = {
  name: 'Shell Sort',
  cx: { best: 'O(n log n)', avg: 'O(n^1.25)', worst: 'O(n²)', space: 'O(1)' },
  badge: 'O(n^1.25)',
  tags: [['Unstable', 'bad'], ['In-place', 'good']],
  desc: 'Insertion sort over shrinking gaps.',
  code: [
    'gap ← ⌊n/2⌋',
    'while gap > 0:',
    '  for i ← gap to n − 1:',
    '    j ← i',
    '    while j ≥ gap and A[j − gap] > A[j]:',
    '      swap(A[j − gap], A[j]);  j ← j − gap',
    '  gap ← ⌊gap/2⌋',
  ],
  run(r) {
    for (let gap = r.n >> 1; gap > 0; gap >>= 1) {
      for (let i = gap; i < r.n; i++) {
        r.ctx = { range: [0, i] };
        for (let j = i; j >= gap; j -= gap) {
          r.line = 4;                         // highlights pseudocode line 5
          if (r.compare(j - gap, j) <= 0) break;
          r.line = 5;
          r.swap(j - gap, j);
        }
      }
    }
    r.finish();                               // marks everything sorted
  },
};
AV.ALGO_COLORS.shell = '#22d3ee';
```

Rules of thumb:

- Read and modify the array **only** through the recorder (`r.a[i]` is fine for reads that shouldn't count as a comparison).
- Set `r.line` (0-based index into `code`) *before* an operation so the right pseudocode line lights up.
- Use `r.ctx = { range: [lo, hi], pivot: i }` to shade the active sub-array or mark a focus bar.
- Searches take a target: `run(r, t)`, and must end with `return r.endSearch(index /* or -1 */)`.

---

## Browser support

Any current evergreen browser (Chrome, Edge, Firefox, Safari). It relies on Canvas 2D, inline SVG, `<dialog>`, CSS custom properties and `color-mix()`.

The Inter and JetBrains Mono fonts load from Google Fonts. Offline, the app falls back to system fonts and works the same.

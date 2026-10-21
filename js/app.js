/* ===== INTERFAZ ===== */
(() => {
  const W = 1000, H = 620, R = 22;
  const $ = id => document.getElementById(id);
  const svg = $('board'), gE = $('gEdges'), gN = $('gNodes'), gH = $('gHint');
  const NS = 'http://www.w3.org/2000/svg';
  const S = { nodes: [], edges: [], directed: false, name: 'Grafo', algo: 'prim', start: null, src: null, dst: null, result: null, step: 0,
    proj: '', projName: 'Proyecto', deadline: null, prob: null, vw: 1000, vh: 620 };
  const sel = { node: null, edge: null };
  let nextN = 1, nextE = 1, playTimer = null, zoom = 1;
  const fmt = n => (Math.round(n * 1000) / 1000).toString();
  const lab = id => (S.nodes.find(n => n.id === id) || {}).label;
  const ALGO_NAME = { prim: 'Prim', kruskal: 'Kruskal', dijkstra: 'Dijkstra', maxflow: 'Ford-Fulkerson', cpm: 'CPM', pert: 'PERT' };
  const isMST = () => S.algo === 'prim' || S.algo === 'kruskal';
  const isProj = () => S.algo === 'cpm' || S.algo === 'pert';

  /* ---------- persistencia (solo comodidad local) ---------- */
  function save() {
    try { localStorage.setItem('redes-io-v1', JSON.stringify({ nodes: S.nodes, edges: S.edges, vw: S.vw, vh: S.vh, name: S.name, algo: S.algo, start: S.start, src: S.src, dst: S.dst, proj: S.proj, projName: S.projName, deadline: S.deadline, prob: S.prob })); } catch (e) {}
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem('redes-io-v1') || 'null');
      if (!d || !Array.isArray(d.nodes) || !d.nodes.length) return false;
      Object.assign(S, d);
      S.edges.forEach(e => { if (e.dir == null) e.dir = !!d.directed; }); // datos guardados por la versión anterior
      nextN = 1 + Math.max(0, ...S.nodes.map(n => +String(n.id).slice(1) || 0));
      nextE = 1 + Math.max(0, ...S.edges.map(e => +String(e.id).slice(1) || 0));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- carga de grafos ---------- */
  // edgeList: [[u, v, w, dir]] con u, v como etiquetas; dir true = dirigida u→v
  function setGraph(labels, pos, edgeList, name, view) {
    nextN = 1; nextE = 1;
    const map = {};
    S.nodes = labels.map(l => { const n = { id: 'n' + (nextN++), label: String(l), x: pos[l][0], y: pos[l][1] }; map[l] = n.id; return n; });
    S.edges = edgeList.map(([u, v, w, dir]) => ({ id: 'e' + (nextE++), u: map[u], v: map[v], w, dir: !!dir }));
    S.name = name;
    if (view) { S.vw = view.vw; S.vh = view.vh; }
    sel.node = sel.edge = null;
    S.start = S.src = S.nodes[0]?.id ?? null;
    S.dst = S.nodes[S.nodes.length - 1]?.id ?? null;
  }
  // Tamaño del lienzo según la cantidad de nodos (los nodos mantienen su tamaño; el lienzo crece)
  const viewFor = n => { const k = Math.max(1, Math.sqrt(n / 24)); return { vw: Math.round(1000 * k), vh: Math.round(620 * k) }; };
  // Generador pseudoaleatorio con semilla: el mismo texto siempre da el mismo dibujo
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  // Acomodo automático por "estrés" (stress majorization): cada par de nodos intenta quedar a una distancia
  // proporcional a la cantidad de aristas que los separan. Da dibujos parejos incluso con 200 nodos.
  // fixed: posiciones que se conservan (al editar un grafo existente solo se ubican los nodos nuevos, junto a sus vecinos).
  function autoLayout(labels, links, fixed = {}, view = null) {
    const n = labels.length, V = view || viewFor(n), M = 60, minD = 2 * R + 14;
    const idx = {}; labels.forEach((l, i) => idx[l] = i);
    const rnd = seeded(labels.join(',') + '|' + links.map(x => x.join('-')).join(','));
    const adj = labels.map(() => []);
    links.forEach(([u, v]) => { adj[idx[u]].push(idx[v]); adj[idx[v]].push(idx[u]); });
    const P = labels.map(l => fixed[l] ? [...fixed[l]] : null);
    const nFixed = P.filter(Boolean).length;
    if (nFixed === 0 && n > 1) {
      // distancias en saltos (BFS desde cada nodo); pares desconectados: un poco más que el máximo
      const D = labels.map((_, s) => {
        const d = new Array(n).fill(-1); d[s] = 0; const q = [s];
        for (let h = 0; h < q.length; h++) for (const t of adj[q[h]]) if (d[t] < 0) { d[t] = d[q[h]] + 1; q.push(t); }
        return d;
      });
      let maxd = 1; D.forEach(r => r.forEach(x => { if (x > maxd) maxd = x; }));
      D.forEach(r => r.forEach((x, j) => { if (x < 0) r[j] = maxd + 1; }));
      const X = labels.map(() => [rnd() * maxd, rnd() * maxd]);
      for (let it = 0; it < 160; it++) {
        for (let i = 0; i < n; i++) {
          let sx = 0, sy = 0, sw = 0;
          for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const dij = D[i][j], w = 1 / (dij * dij);
            let dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], dist = Math.hypot(dx, dy);
            if (dist < 1e-6) { dx = rnd() - 0.5; dy = rnd() - 0.5; dist = Math.hypot(dx, dy); }
            sx += w * (X[j][0] + dij * dx / dist); sy += w * (X[j][1] + dij * dy / dist); sw += w;
          }
          X[i] = [sx / sw, sy / sw];
        }
      }
      // encajar en el lienzo
      const xs = X.map(p => p[0]), ys = X.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      // el dibujo más ancho que alto va horizontal (el lienzo es apaisado)
      const rot = (y1 - y0) > (x1 - x0);
      X.forEach((p, i) => {
        const a = rot ? p[1] : p[0], b = rot ? p[0] : p[1];
        const [a0, a1, b0, b1] = rot ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
        P[i] = [M + (a1 > a0 ? (a - a0) / (a1 - a0) : 0.5) * (V.vw - 2 * M), M - 10 + (b1 > b0 ? (b - b0) / (b1 - b0) : 0.5) * (V.vh - 2 * M)];
      });
    } else if (n === 1 && !P[0]) P[0] = [V.vw / 2, V.vh / 2];
    else {
      // edición: cada nodo nuevo va cerca del promedio de sus vecinos ya ubicados (o al centro si no tiene)
      let pending = labels.map((_, i) => i).filter(i => !P[i]);
      while (pending.length) {
        const next = [];
        for (const i of pending) {
          const nb = adj[i].filter(j => P[j]);
          if (!nb.length && next.length < pending.length - 1) { next.push(i); continue; }
          const c = nb.length ? [nb.reduce((s, j) => s + P[j][0], 0) / nb.length, nb.reduce((s, j) => s + P[j][1], 0) / nb.length] : [V.vw / 2, V.vh / 2];
          const a = rnd() * 2 * Math.PI; P[i] = [c[0] + Math.cos(a) * minD * 1.6, c[1] + Math.sin(a) * minD * 1.6];
        }
        if (next.length === pending.length) break;
        pending = next;
      }
    }
    // separar nodos encimados (los fijos no se mueven)
    const movable = labels.map(l => !fixed[l]);
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 1e-6) { dx = rnd() - 0.5; dy = rnd() - 0.5; d = Math.hypot(dx, dy); }
        const push = (minD - d) / 2, ux = dx / d * push, uy = dy / d * push;
        const mi = movable[i], mj = movable[j];
        if (!mi && !mj) continue;
        const fi = mi && mj ? 1 : (mi ? 2 : 0), fj = mi && mj ? 1 : (mj ? 2 : 0);
        P[i][0] -= ux * fi; P[i][1] -= uy * fi; P[j][0] += ux * fj; P[j][1] += uy * fj; moved = true;
      }
      P.forEach((p, i) => { if (movable[i]) { p[0] = Math.max(R + 4, Math.min(V.vw - R - 4, p[0])); p[1] = Math.max(R + 4, Math.min(V.vh - R - 20, p[1])); } });
      if (!moved) break;
    }
    const pos = {};
    labels.forEach((l, i) => pos[l] = [P[i][0], P[i][1]]);
    return { pos, view: V };
  }
  function relayout() {
    if (!S.nodes.length) return;
    const L = {}; S.nodes.forEach(n => L[n.id] = n.label);
    const { pos, view } = autoLayout(S.nodes.map(n => n.label), S.edges.map(e => [L[e.u], L[e.v]]));
    S.nodes.forEach(n => { [n.x, n.y] = pos[n.label]; });
    S.vw = view.vw; S.vh = view.vh;
    save(); renderGraph();
  }
  function loadProject(key) {
    const p = PROJECTS[key]; if (!p) return;
    S.proj = p.text; S.projName = p.name; S.algo = p.algo;
    if (p.deadline != null) S.deadline = p.deadline;
    if (p.prob != null) S.prob = p.prob;
    $('txtProj').value = S.proj;
    refreshSelects(); save(); compute();
  }
  function loadPreset(key) {
    if (PROJECTS[key]) return loadProject(key);
    const p = PRESETS[key]; if (!p) return;
    const labels = Object.keys(p.pos);
    const pos = {}; labels.forEach(l => pos[l] = [60 + p.pos[l][0] * 880, 50 + p.pos[l][1] * 520]);
    const edges = p.edges.split('|').map(s => { const [u, v, w] = s.split(' '); return [u, v, +w, !!p.directed]; });
    setGraph(labels, pos, edges, p.name, { vw: 1000, vh: 620 });
    if (p.algo && (p.algo === 'maxflow' || S.algo === 'maxflow' || isProj())) S.algo = p.algo;
    else if (key === 'FLUJO') S.algo = 'maxflow';
    else if (isProj()) S.algo = 'prim';
    changed(true);
  }
  // Grafo aleatorio de hasta 200 nodos: puntos repartidos en el lienzo, unidos con vecinos cercanos (siempre conexo).
  // Para flujo máximo las aristas van de izquierda a derecha, con fuente a la izquierda y sumidero a la derecha.
  function randomGraph(n) {
    n = Math.max(3, Math.min(200, n | 0));
    const V = viewFor(n), dmin = Math.min(110, 0.72 * Math.sqrt((V.vw - 140) * (V.vh - 120) / n));
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 40000) {
      tries++;
      const p = [70 + Math.random() * (V.vw - 140), 60 + Math.random() * (V.vh - 120)];
      if (pts.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > dmin)) pts.push(p);
    }
    while (pts.length < n) pts.push([70 + Math.random() * (V.vw - 140), 60 + Math.random() * (V.vh - 120)]);
    const flow = S.algo === 'maxflow';
    if (flow) pts.sort((a, b) => a[0] - b[0]);
    const labels = pts.map((_, i) => String(i + 1));
    const pos = {}; labels.forEach((l, i) => pos[l] = pts[i]);
    const d = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    const w = () => 1 + Math.floor(Math.random() * 20);
    const key = new Set(), edges = [];
    const add = (i, j) => {
      const k = i < j ? i + '-' + j : j + '-' + i; if (i === j || key.has(k)) return; key.add(k);
      const [a, b] = flow && pts[i][0] > pts[j][0] ? [j, i] : [i, j];
      edges.push([labels[a], labels[b], w(), flow]);
    };
    // árbol con vecinos cercanos (garantiza conexidad) + aristas extra cortas
    const inT = [0];
    for (let i = 1; i < n; i++) { let best = 0; inT.forEach(j => { if (d(i, j) < d(i, best)) best = j; }); add(i, best); inT.push(i); }
    for (let i = 0; i < n; i++) {
      const near = [...Array(n).keys()].filter(j => j !== i).sort((a, b) => d(i, a) - d(i, b)).slice(0, 3);
      near.forEach(j => { if (Math.random() < 0.45) add(i, j); });
    }
    setGraph(labels, pos, edges, `Grafo aleatorio (${n} nodos)`, V);
    changed(true);
  }

  // Proyecto aleatorio por capas: ~√n capas de ~√n actividades; cada una depende de 1 o 2 de la capa anterior (sin ciclos)
  function randomProject(n) {
    n = Math.max(3, Math.min(200, n | 0));
    const name = i => n <= 26 ? String.fromCharCode(65 + i) : 'A' + (i + 1);
    const w = Math.max(2, Math.round(Math.sqrt(n))), layer = i => Math.floor(i / w);
    const lines = [];
    for (let i = 0; i < n; i++) {
      const L = layer(i), prev = [...Array(i).keys()].filter(j => layer(j) === L - 1);
      const pred = new Set();
      if (prev.length) { const k = 1 + (Math.random() < 0.45 ? 1 : 0); while (pred.size < Math.min(k, prev.length)) pred.add(prev[Math.floor(Math.random() * prev.length)]); }
      const ps = [...pred].sort((x, y) => x - y).map(name).join(',') || '-';
      if (S.algo === 'pert') { const m = 2 + Math.floor(Math.random() * 9), a = Math.max(1, m - 1 - Math.floor(Math.random() * 3)), b = m + 1 + Math.floor(Math.random() * 6); lines.push(`${name(i)} ${ps} ${a} ${m} ${b}`); }
      else lines.push(`${name(i)} ${ps} ${1 + Math.floor(Math.random() * 12)}`);
    }
    S.proj = lines.join('\n'); S.projName = `Proyecto aleatorio (${n} actividades)`;
    $('txtProj').value = S.proj; save(); compute();
  }

  /* ---------- cálculo ---------- */
  function graph() { return { nodes: S.nodes, edges: S.edges }; }
  function compute() {
    stopPlay();
    if (isProj()) {
      const P = ALGO.parseProject(S.proj);
      const opts = { deadline: S.deadline, prob: S.prob != null ? S.prob / 100 : null };
      S.result = S.algo === 'cpm' ? ALGO.cpm(P) : ALGO.pert(P, opts);
      S.step = S.result.steps ? S.result.steps.length - 1 : 0;
      renderAll(); return;
    }
    if (!S.nodes.length) { S.result = null; renderAll(); return; }
    const G = graph();
    let r;
    if (S.algo === 'prim') r = ALGO.prim(G, S.start);
    else if (S.algo === 'kruskal') r = ALGO.kruskal(G);
    else if (S.algo === 'dijkstra') r = ALGO.dijkstra(G, S.src, S.dst);
    else r = ALGO.maxflow(G, S.src, S.dst);
    S.result = r;
    S.step = r.steps ? r.steps.length - 1 : 0;
    renderAll();
  }
  function changed(structural) {
    refreshSelects();
    if (structural) syncText();
    save();
    compute();
  }

  /* ---------- selects ---------- */
  function refreshSelects() {
    const ids = new Set(S.nodes.map(n => n.id));
    if (!ids.has(S.start)) S.start = S.nodes[0]?.id ?? null;
    if (!ids.has(S.src)) S.src = S.nodes[0]?.id ?? null;
    if (!ids.has(S.dst) || S.dst === S.src) S.dst = [...S.nodes].reverse().find(n => n.id !== S.src)?.id ?? null;
    const sorted = [...S.nodes].sort((a, b) => ALGO.cmpLabel(a.label, b.label));
    [['selStart', 'start'], ['selSrc', 'src'], ['selDst', 'dst']].forEach(([id, k]) => {
      const el = $(id); el.innerHTML = '';
      sorted.forEach(n => { const o = document.createElement('option'); o.value = n.id; o.textContent = n.label; el.appendChild(o); });
      el.value = S[k] ?? '';
    });
    const flow = S.algo === 'maxflow', proj = isProj();
    $('fStart').hidden = S.algo !== 'prim';
    $('fSrc').hidden = $('fDst').hidden = isMST() || proj;
    $('fDeadline').hidden = $('fProb').hidden = S.algo !== 'pert';
    if (document.activeElement !== $('numDeadline')) $('numDeadline').value = S.deadline ?? '';
    if (document.activeElement !== $('numProb')) $('numProb').value = S.prob ?? '';
    $('projBlock').hidden = !proj; $('edgeBlock').hidden = proj;
    $('listTitle').textContent = proj ? 'Lista de actividades' : 'Lista de aristas';
    if (proj && document.activeElement !== $('txtProj')) $('txtProj').value = S.proj;
    $('btnDel').hidden = $('btnLayout').hidden = proj;
    $('numRand').max = proj ? 200 : 20;
    $('lblSrc').textContent = flow ? 'Fuente' : 'Origen';
    $('lblDst').textContent = flow ? 'Sumidero' : 'Destino';
    document.querySelectorAll('#algoPick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.algo === S.algo)));
  }

  /* ---------- dibujo del grafo ---------- */
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function currentStep() { return S.result && S.result.steps ? S.result.steps[S.step] : null; }
  const MARK = { tree: 'ar-tree', saturated: 'ar-tree', current: 'ar-cur', candidate: 'ar-cur', path: 'ar-path', flow: 'ar-path', rejected: 'ar-rej', cut: 'ar-rej' };

  function setView(w, h) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.aspectRatio = `${w} / ${h}`;
  }
  function renderGraph() {
    gE.innerHTML = ''; gN.innerHTML = ''; gH.innerHTML = '';
    if (isProj()) return renderProject();
    setView(S.vw, S.vh);
    const st = currentStep();
    svg.classList.toggle('dim', !!st);
    const N = {}; S.nodes.forEach(n => N[n.id] = n);
    const arcs = new Set(S.edges.filter(e => e.dir).map(e => e.u + '>' + e.v));
    let nDir = 0;
    for (const e of S.edges) {
      const a = N[e.u], b = N[e.v]; if (!a || !b) continue;
      if (e.dir) nDir++;
      const showDir = e.dir && !isMST();
      const state = st && st.edges[e.id];
      let dir = (st && st.arrows && st.arrows[e.id]) || (showDir ? 'uv' : null);
      const g = el('g', { class: 'edge' + (state ? ' st-' + state : '') + (sel.edge === e.id ? ' sel' : ''), 'data-edge': e.id }, gE);
      let p = dir === 'vu' ? [b, a] : [a, b];
      const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // curva si existe el arco opuesto (A > B y B > A)
      const twin = showDir && arcs.has(e.v + '>' + e.u);
      const bend = twin ? 34 * (dir === 'vu' ? -1 : 1) : 0;
      const nx = -uy, ny = ux;
      const x1 = p[0].x + ux * R, y1 = p[0].y + uy * R;
      const end = dir ? R + 3 : R;
      const x2 = p[1].x - ux * end, y2 = p[1].y - uy * end;
      const cx = (x1 + x2) / 2 + nx * bend, cy = (y1 + y2) / 2 + ny * bend;
      const d = bend ? `M${x1},${y1} Q${cx},${cy} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
      el('path', { d, class: 'e-hit' }, g);
      const line = el('path', { d, class: 'e-line' }, g);
      if (dir) line.setAttribute('marker-end', `url(#${sel.edge === e.id ? 'ar-ink' : (MARK[state] || 'ar-base')})`);
      const txt = st && st.labels ? st.labels[e.id] : fmt(e.w);
      const lx = bend ? (x1 + x2) / 4 + cx / 2 : (a.x + b.x) / 2, ly = bend ? (y1 + y2) / 4 + cy / 2 : (a.y + b.y) / 2;
      const w = String(txt).length * 9.4 + 12;
      const lg = el('g', { class: 'e-lbl' }, g);
      el('rect', { x: lx - w / 2, y: ly - 12, width: w, height: 24, rx: 5 }, lg);
      el('text', { x: lx, y: ly + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, lg).textContent = txt;
    }
    const roles = {};
    if (S.algo === 'prim' && S.start) roles[S.start] = 'inicio';
    if (!isMST()) { if (S.src) roles[S.src] = S.algo === 'maxflow' ? 'fuente' : 'origen'; if (S.dst) roles[S.dst] = S.algo === 'maxflow' ? 'sumidero' : 'destino'; }
    for (const n of S.nodes) {
      const state = st && st.nodes[n.id];
      const g = el('g', { class: 'node' + (state ? ' st-' + state : '') + (sel.node === n.id ? ' sel' : ''), 'data-node': n.id, transform: `translate(${n.x},${n.y})` }, gN);
      el('circle', { r: R + 9, class: 'halo' }, g);
      el('circle', { r: R }, g);
      el('text', { y: 1 }, g).textContent = n.label;
      if (roles[n.id]) el('text', { y: R + 16, class: 'role' }, g).textContent = roles[n.id];
    }
    if (!S.nodes.length) el('text', { x: S.vw / 2, y: S.vh / 2, class: 'empty-hint' }, gH).textContent = 'Doble click para agregar el primer nodo, o cargá un grafo de la guía';
    $('graphName').textContent = S.name;
    const status = sel.node ? `Nodo ${lab(sel.node)} seleccionado: tocá otro nodo para unirlos, o Supr para borrarlo`
      : sel.edge ? (() => { const e = S.edges.find(x => x.id === sel.edge); return `Arista ${lab(e.u)} ${e.dir ? '>' : '-'} ${lab(e.v)} seleccionada: doble click para cambiar peso o sentido, Supr para borrarla`; })()
      : `${S.nodes.length} nodos · ${S.edges.length} aristas` + (nDir ? ` (${nDir} dirigidas)` : '') + (isMST() && nDir ? ' · el árbol mínimo ignora el sentido' : '');
    $('status').textContent = status;
    $('btnDel').disabled = !(sel.node || sel.edge);
  }

  /* ---------- dibujo de la red de proyecto (AON) ---------- */
  const BW = 146, BH = 72, CW = 196, RH = 96;
  function projectLayout(net) {
    const nLev = 1 + Math.max(0, ...net.order.map(id => net.level[id]));
    const cols = Array.from({ length: nLev }, () => []);
    const byId = {}; net.acts.forEach(a => byId[a.id] = a);
    const rowOf = {};
    // orden dentro de cada nivel por baricentro de las predecesoras (reduce cruces)
    net.order.forEach(id => cols[net.level[id]].push(id));
    cols.forEach(col => {
      col.forEach(id => { const p = byId[id].pred; byId[id]._bc = p.length ? p.reduce((s, q) => s + rowOf[q], 0) / p.length : 0; });
      col.sort((x, y) => byId[x]._bc - byId[y]._bc);
      const off = 0; col.forEach((id, i) => rowOf[id] = i + off);
    });
    const maxRows = Math.max(...cols.map(c => c.length));
    const w = (nLev + 2) * CW + 40, h = Math.max(380, maxRows * RH + 80);
    const x0 = (w - (nLev + 2) * CW) / 2 + CW / 2;
    const pos = {};
    cols.forEach((col, l) => col.forEach((id, i) => { pos[id] = { x: x0 + (l + 1) * CW, y: h / 2 + (i - (col.length - 1) / 2) * RH }; }));
    pos.__ini = { x: x0, y: h / 2 }; pos.__fin = { x: x0 + (nLev + 1) * CW, y: h / 2 };
    return { pos, w, h, byId };
  }
  function renderProject() {
    $('graphName').textContent = S.projName;
    const r = S.result, net = r && r.net;
    if (!net) {
      setView(W, H);
      el('text', { x: W / 2, y: H / 2, class: 'empty-hint' }, gH).textContent = r && r.error ? 'Revisá la lista de actividades (ver mensaje a la derecha)' : 'Cargá las actividades en la lista de abajo';
      $('status').textContent = '';
      return;
    }
    const { pos, w, h, byId } = projectLayout(net);
    setView(w, h);
    const st = currentStep();
    svg.classList.toggle('dim', !!st);
    const succ = {}; net.acts.forEach(a => succ[a.id] = []);
    net.acts.forEach(a => a.pred.forEach(p => succ[p].push(a.id)));
    const link = (a, b, cls, mark) => {
      const x1 = a.x + (a.virt ? 16 : BW / 2), x2 = b.x - (b.virt ? 19 : BW / 2 + 3), mx = (x1 + x2) / 2;
      const g = el('g', { class: 'edge ' + cls }, gE);
      el('path', { d: `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`, class: 'e-line', 'marker-end': `url(#${mark})` }, g);
    };
    const ini = { ...pos.__ini, virt: true }, fin = { ...pos.__fin, virt: true };
    net.acts.forEach(a => {
      if (!a.pred.length) link(ini, pos[a.id], 'virt', 'ar-base');
      if (!succ[a.id].length) link(pos[a.id], fin, 'virt', 'ar-base');
      a.pred.forEach(p => { const state = st && st.edges[`${p}>${a.id}`]; link(pos[p], pos[a.id], state ? 'st-' + state : '', MARK[state] || 'ar-base'); });
    });
    [['__ini', 'Inicio'], ['__fin', 'Fin']].forEach(([k, t]) => {
      const g = el('g', { class: 'node pnode', transform: `translate(${pos[k].x},${pos[k].y})` }, gN);
      el('circle', { r: 16 }, g); el('text', { y: 30, class: 'role' }, g).textContent = t;
    });
    const v = (st && st.vals) || {};
    const show = x => x == null ? '--' : String(Math.round(x * 100) / 100);
    for (const a of net.acts) {
      const p = pos[a.id], state = st && st.nodes[a.id], val = v[a.id] || {};
      const g = el('g', { class: 'pbox' + (state ? ' st-' + state : ''), transform: `translate(${p.x - BW / 2},${p.y - BH / 2})` }, gN);
      el('rect', { width: BW, height: BH, rx: 6 }, g);
      el('line', { x1: 0, x2: BW, y1: BH / 3, y2: BH / 3 }, g);
      el('line', { x1: 0, x2: BW, y1: 2 * BH / 3, y2: 2 * BH / 3 }, g);
      el('text', { x: BW / 2, y: BH / 6, class: 'pv' }, g).textContent = `[${show(val.ic)} | ${show(val.tc)}]`;
      el('text', { x: BW / 2, y: BH / 2, class: 'pid' }, g).textContent = `${a.id} | t=${Math.round(net.dur[a.id] * 100) / 100}`;
      el('text', { x: BW / 2, y: 5 * BH / 6, class: 'pv' }, g).textContent = `[${show(val.il)} | ${show(val.tl)}]`;
    }
    const nPrec = net.acts.reduce((s, a) => s + a.pred.length, 0);
    $('status').textContent = `${net.acts.length} actividades · ${nPrec} precedencias · arriba [IC | TC], abajo [IL | TL]`;
    $('btnDel').disabled = true;
  }

  /* ---------- panel de resultado ---------- */
  const LEGEND = {
    prim: [['var(--accent)', 'en el árbol'], ['var(--cand)', 'arista elegida / candidatas']],
    kruskal: [['var(--accent)', 'aceptada'], ['var(--cand)', 'evaluando'], ['var(--reject)', 'rechazada (ciclo)']],
    dijkstra: [['var(--accent)', 'árbol de rutas'], ['var(--cand)', 'etiquetas actualizadas'], ['var(--path)', 'ruta más corta']],
    maxflow: [['var(--path)', 'con flujo'], ['var(--accent)', 'saturada'], ['var(--cand)', 'camino aumentante'], ['var(--reject)', 'corte mínimo']],
    cpm: [['var(--accent)', 'ya calculada'], ['var(--cand)', 'actividad actual / precedencia que define'], ['var(--path)', 'ruta crítica']],
    pert: [['var(--accent)', 'ya calculada'], ['var(--cand)', 'actividad actual / precedencia que define'], ['var(--path)', 'ruta crítica']]
  };
  function renderResult() {
    const box = $('result'); box.innerHTML = '';
    $('resAlgo').textContent = ALGO_NAME[S.algo];
    const r = S.result;
    if (!r) { box.innerHTML = '<div class="placeholder">Armá un grafo y presioná <b>Calcular</b>.</div>'; return; }
    if (r.error) { const w = document.createElement('div'); w.className = 'warn'; w.textContent = r.error; box.appendChild(w); return; }
    const k = document.createElement('div'); k.className = 'kpi';
    k.innerHTML = `<div class="lbl"></div><div class="value"></div><div class="detail"></div>`;
    k.children[0].textContent = r.summary.label; k.children[1].textContent = r.summary.value; k.children[2].textContent = r.summary.detail;
    box.appendChild(k);
    if (r.warning) { const w = document.createElement('div'); w.className = 'warn'; w.textContent = r.warning; box.appendChild(w); }
    const st = currentStep(), n = r.steps.length;
    const sp = document.createElement('div'); sp.className = 'stepper';
    sp.innerHTML = `<div class="stepper-controls">
        <button class="btn" type="button" id="stFirst" aria-label="Primer paso">⏮</button>
        <button class="btn" type="button" id="stPrev" aria-label="Paso anterior">◀</button>
        <button class="btn" type="button" id="stPlay">${playTimer ? 'Pausa' : 'Reproducir'}</button>
        <button class="btn" type="button" id="stNext" aria-label="Paso siguiente">▶</button>
        <input type="range" id="stRange" min="0" max="${n - 1}" value="${S.step}" aria-label="Paso">
        <span class="step-count">${S.step + 1}/${n}</span></div>
      <h3 class="step-title"></h3><p class="step-desc"></p>`;
    sp.querySelector('.step-title').textContent = st.title;
    sp.querySelector('.step-desc').textContent = st.desc;
    box.appendChild(sp);
    sp.querySelector('#stFirst').onclick = () => goStep(0);
    sp.querySelector('#stPrev').onclick = () => goStep(S.step - 1);
    sp.querySelector('#stNext').onclick = () => goStep(S.step + 1);
    sp.querySelector('#stPlay').onclick = togglePlay;
    sp.querySelector('#stRange').oninput = ev => goStep(+ev.target.value);
    const lg = document.createElement('div'); lg.className = 'legend';
    LEGEND[S.algo].forEach(([c, t]) => { const s = document.createElement('span'); s.innerHTML = `<i style="border-color:${c}"></i>`; s.append(t); lg.appendChild(s); });
    box.appendChild(lg);
  }
  function tableHTML(t, stepRow, clickable) {
    const tbl = document.createElement('table');
    const thead = tbl.createTHead().insertRow();
    t.cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; thead.appendChild(th); });
    const tb = tbl.createTBody();
    t.rows.forEach((row, i) => {
      const tr = tb.insertRow();
      if (stepRow != null) {
        if (i >= stepRow) tr.classList.add('future');
        else if (i === stepRow - 1) tr.classList.add('now');
      }
      if (S.algo === 'kruskal' && clickable) tr.classList.add(String(row[3]).startsWith('Rech') ? 'rej' : 'acc');
      row.forEach((c, j) => { const td = tr.insertCell(); td.textContent = c; if (j > 0 && /[\[\(→–{]/.test(String(c))) td.className = 'mono'; });
      if (clickable) tr.onclick = () => { const k = S.result.steps.findIndex(s => s.row === i + 1); if (k >= 0) goStep(k); };
    });
    if (!t.rows.length) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = t.cols.length; td.textContent = 'Sin filas.'; }
    return tbl;
  }
  function renderTables() {
    const r = S.result, main = $('tblMain'), extra = $('tblExtra');
    main.innerHTML = ''; extra.innerHTML = '';
    $('tblTitle').textContent = `Tabla detalle paso a paso · ${ALGO_NAME[S.algo]}`;
    if (!r || r.error) { main.innerHTML = '<div class="placeholder">La tabla aparece al calcular.</div>'; $('extraCard').hidden = true; return; }
    main.appendChild(tableHTML(r.table, currentStep().row, true));
    $('extraCard').hidden = !r.extra;
    if (r.extra) {
      $('extraTitle').textContent = S.algo === 'dijkstra' ? `Distancias mínimas desde ${lab(S.src)}` : isProj() ? 'Tabla de actividades' : 'Flujo por arista';
      extra.appendChild(tableHTML(r.extra, null, false));
    }
  }
  function renderAll() { renderGraph(); renderResult(); renderTables(); }
  function goStep(k) {
    if (!S.result || !S.result.steps) return;
    S.step = Math.max(0, Math.min(S.result.steps.length - 1, k));
    if (S.step === S.result.steps.length - 1) stopPlay();
    renderAll();
  }
  function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } }
  function togglePlay() {
    if (playTimer) { stopPlay(); renderResult(); return; }
    if (S.step >= S.result.steps.length - 1) S.step = 0;
    playTimer = setInterval(() => goStep(S.step + 1), 1100);
    renderAll();
  }

  /* ---------- lista de aristas ---------- */
  function syncText() {
    if (document.activeElement === $('txtEdges')) return;
    $('txtEdges').value = ALGO.edgesToText(graph());
    edgeMsg(null);
  }
  // Mensaje fijo debajo de la lista: errores con número de línea, o resumen de lo que se va a cargar
  function edgeMsg(P, applied) {
    const box = $('edgeMsg');
    if (!P) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '';
    if (P.errors.length) {
      box.className = 'msg warn';
      const h = document.createElement('b'); h.textContent = `${P.errors.length} línea(s) con error — no se aplicó nada:`; box.appendChild(h);
      const ul = document.createElement('ul');
      P.errors.slice(0, 12).forEach(er => { const li = document.createElement('li'); li.textContent = `Línea ${er.line}: ${er.msg}`; ul.appendChild(li); });
      if (P.errors.length > 12) { const li = document.createElement('li'); li.textContent = `… y ${P.errors.length - 12} más.`; ul.appendChild(li); }
      box.appendChild(ul);
    } else {
      box.className = 'msg info';
      const nd = P.edges.filter(e => e.dir).length, used = new Set(P.edges.flatMap(e => [e.u, e.v]));
      const iso = P.nodes.filter(l => !used.has(l));
      box.textContent = (applied ? 'Cargado: ' : 'Listo para aplicar: ') + `${P.nodes.length} nodos · ${P.edges.length} aristas` +
        (P.edges.length ? ` (${nd} dirigidas, ${P.edges.length - nd} sin sentido)` : '') + (iso.length ? ` · sin aristas: ${iso.slice(0, 8).join(', ')}${iso.length > 8 ? '…' : ''}` : '');
    }
  }
  function applyText() {
    clearTimeout(msgT);
    const P = ALGO.parseEdges($('txtEdges').value);
    if (P.errors.length) return edgeMsg(P);
    if (!P.nodes.length) return toast('La lista está vacía.');
    const old = {}; S.nodes.forEach(n => old[n.label] = [n.x, n.y]);
    const oldPairs = new Set(S.edges.map(e => [lab(e.u), lab(e.v)].sort().join('~')));
    const fresh = P.nodes.filter(l => !old[l]);
    const kept = P.edges.filter(e => oldPairs.has([e.u, e.v].sort().join('~'))).length;
    // Si es una edición del grafo actual se conservan las posiciones; si es un grafo nuevo se acomoda todo
    const isEdit = S.nodes.length && fresh.length <= Math.max(2, 0.3 * P.nodes.length) && kept >= 0.5 * P.edges.length;
    const links = P.edges.map(e => [e.u, e.v]);
    let lay;
    if (isEdit) { const fixed = {}; P.nodes.forEach(l => { if (old[l]) fixed[l] = old[l]; }); lay = autoLayout(P.nodes, links, fixed, { vw: S.vw, vh: S.vh }); }
    else lay = autoLayout(P.nodes, links);
    const keep = { start: lab(S.start), src: lab(S.src), dst: lab(S.dst) };
    const name = isEdit ? (S.name.endsWith('(editado)') ? S.name : S.name + ' (editado)') : 'Grafo cargado desde lista';
    setGraph(P.nodes, lay.pos, P.edges.map(e => [e.u, e.v, e.w, e.dir]), name, lay.view);
    const byL = l => S.nodes.find(n => n.label === l)?.id;
    S.start = byL(keep.start) ?? S.start; S.src = byL(keep.src) ?? S.src; S.dst = byL(keep.dst) ?? S.dst;
    changed(false);
    edgeMsg(P, true);
  }

  /* ---------- edición con puntero ---------- */
  function toSvg(ev) { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  let down = null, lastTap = null;
  function isDouble(kind, id, p) {
    const now = Date.now();
    const d = lastTap && lastTap.kind === kind && lastTap.id === id && now - lastTap.t < 400 && (kind !== 'empty' || Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30);
    lastTap = d ? null : { kind, id, t: now, x: p.x, y: p.y };
    return d;
  }
  svg.addEventListener('pointerdown', ev => {
    if (isProj()) return; // la red de proyecto se edita desde la lista de actividades
    if (!$('pop').hidden) { closePop(); return; }
    const p = toSvg(ev);
    const nEl = ev.target.closest('[data-node]'), eEl = ev.target.closest('[data-edge]');
    if (nEl) {
      const n = S.nodes.find(x => x.id === nEl.dataset.node);
      down = { kind: 'node', id: n.id, x: p.x, y: p.y, ox: n.x - p.x, oy: n.y - p.y, moved: false };
      svg.setPointerCapture(ev.pointerId);
    } else if (eEl) down = { kind: 'edge', id: eEl.dataset.edge, x: p.x, y: p.y };
    else down = { kind: 'empty', x: p.x, y: p.y };
    ev.preventDefault();
  });
  svg.addEventListener('pointermove', ev => {
    if (!down || down.kind !== 'node') return;
    const p = toSvg(ev);
    if (!down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 5) down.moved = true;
    if (down.moved) {
      const n = S.nodes.find(x => x.id === down.id);
      n.x = Math.max(R + 4, Math.min(S.vw - R - 4, p.x + down.ox));
      n.y = Math.max(R + 4, Math.min(S.vh - R - 20, p.y + down.oy));
      renderGraph();
    }
  });
  svg.addEventListener('pointerup', ev => {
    if (!down) return;
    const d = down; down = null;
    const p = toSvg(ev);
    if (d.kind === 'node') { if (d.moved) { save(); lastTap = null; } else nodeTap(d.id, p); }
    else if (d.kind === 'edge') edgeTap(d.id, p);
    else emptyTap(p);
  });
  svg.addEventListener('pointercancel', () => { down = null; });

  function nodeTap(id, p) {
    if (isDouble('node', id, p)) {
      sel.node = null; renderGraph();
      const n = S.nodes.find(x => x.id === id);
      openPop(n.x, n.y - 48, 'Nombre', n.label, v => {
        v = v.trim();
        if (!v || /\s/.test(v)) return 'Usá un nombre sin espacios.';
        if (S.nodes.some(x => x !== n && x.label === v)) return `Ya existe un nodo «${v}».`;
        n.label = v; changed(true);
      });
      return;
    }
    if (sel.node && sel.node !== id) { const u = sel.node; sel.node = null; lastTap = null; startEdge(u, id); }
    else if (sel.node === id) sel.node = null;
    else { sel.node = id; sel.edge = null; }
    renderGraph();
  }
  function edgeTap(id, p) {
    if (isDouble('edge', id, p)) {
      const e = S.edges.find(x => x.id === id);
      const a = S.nodes.find(n => n.id === e.u), b = S.nodes.find(n => n.id === e.v);
      openPop((a.x + b.x) / 2, (a.y + b.y) / 2, `${a.label} · ${b.label}`, fmt(e.w), (v, op) => {
        const w = Number(String(v).replace(',', '.'));
        if (v === '' || !isFinite(w)) return 'Ingresá un número.';
        S.edges = S.edges.filter(x => x !== e); sel.edge = null; putEdge(e.u, e.v, w, op); changed(true);
      }, e.dir ? '>' : '-');
      return;
    }
    sel.edge = sel.edge === id ? null : id; sel.node = null; renderGraph();
  }
  function emptyTap(p) {
    if (isDouble('empty', null, p)) {
      let k = 1; const used = new Set(S.nodes.map(n => n.label));
      while (used.has(String(k))) k++;
      const n = { id: 'n' + (nextN++), label: String(k), x: Math.max(R + 4, Math.min(S.vw - R - 4, p.x)), y: Math.max(R + 4, Math.min(S.vh - R - 20, p.y)) };
      S.nodes.push(n);
      if (S.name.startsWith('Guía') || S.name.startsWith('Ejemplo')) S.name = S.name + ' (editado)';
      sel.node = null; sel.edge = null;
      changed(true);
      return;
    }
    if (sel.node || sel.edge) { sel.node = sel.edge = null; renderGraph(); }
  }
  // Crea o reemplaza la arista entre u y v respetando las mismas reglas que la lista de texto:
  // «-» reemplaza todo lo que haya entre el par; «>» reemplaza u>v y una «-» previa, pero conserva el arco opuesto v>u.
  function putEdge(u, v, w, op) {
    if (op === '<') [u, v] = [v, u];
    const dir = op !== '-';
    const same = e => (e.u === u && e.v === v) || (e.u === v && e.v === u);
    const old = S.edges.find(e => same(e) && (dir ? (e.u === u && e.dir) || !e.dir : true));
    S.edges = S.edges.filter(e => !(same(e) && (!dir || !e.dir || e.u === u)));
    S.edges.push({ id: old ? old.id : 'e' + (nextE++), u, v, w, dir });
  }
  function startEdge(u, v) {
    const ex = S.edges.find(e => e.u === u && e.v === v) || S.edges.find(e => e.u === v && e.v === u && !e.dir);
    const a = S.nodes.find(n => n.id === u), b = S.nodes.find(n => n.id === v);
    const op0 = ex ? (ex.dir ? '>' : '-') : (S.algo === 'maxflow' ? '>' : '-');
    openPop((a.x + b.x) / 2, (a.y + b.y) / 2, `${a.label} · ${b.label}`, ex ? fmt(ex.w) : '', (val, op) => {
      const w = Number(String(val).replace(',', '.'));
      if (val === '' || !isFinite(w)) return 'Ingresá un número.';
      putEdge(u, v, w, op); changed(true);
    }, op0);
  }
  function deleteSelection() {
    if (sel.node) { const id = sel.node; S.nodes = S.nodes.filter(n => n.id !== id); S.edges = S.edges.filter(e => e.u !== id && e.v !== id); }
    else if (sel.edge) S.edges = S.edges.filter(e => e.id !== sel.edge);
    else return;
    sel.node = sel.edge = null; changed(true);
  }

  /* ---------- popover de edición ---------- */
  let popOk = null;
  function openPop(x, y, label, value, onOk, op) {
    const pop = $('pop'), r = svg.getBoundingClientRect();
    const px = Math.max(150, Math.min(r.width - 150, x / S.vw * r.width)), py = Math.max(28, Math.min(r.height - 28, y / S.vh * r.height));
    pop.style.left = px + 'px'; pop.style.top = py + 'px';
    $('popLbl').textContent = label; $('popInput').value = value;
    $('popDir').hidden = op == null; if (op != null) $('popDir').value = op;
    pop.hidden = false; popOk = onOk;
    setTimeout(() => { $('popInput').focus(); $('popInput').select(); }, 0);
  }
  function closePop() { $('pop').hidden = true; popOk = null; }
  function confirmPop() { if (!popOk) return; const err = popOk($('popInput').value, $('popDir').value); if (err) { toast(err); $('popInput').focus(); } else closePop(); }
  $('popOk').onclick = confirmPop;
  $('popCancel').onclick = closePop;
  $('popInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmPop(); } if (ev.key === 'Escape') closePop(); });

  /* ---------- controles ---------- */
  document.querySelectorAll('#algoPick button').forEach(b => b.onclick = () => {
    const was = isProj();
    S.algo = b.dataset.algo;
    if (isProj() && !S.proj.trim()) return loadProject(S.algo === 'pert' ? 'PERT_SERV' : 'CPM_SERV');
    sel.node = sel.edge = null; closePop();
    if (was !== isProj()) stopPlay();
    refreshSelects(); save(); compute();
  });
  const numOrNull = v => { const n = Number(String(v).replace(',', '.')); return v === '' || !isFinite(n) ? null : n; };
  $('numDeadline').onchange = ev => { S.deadline = numOrNull(ev.target.value); save(); compute(); };
  $('numProb').onchange = ev => {
    const n = numOrNull(ev.target.value);
    if (n != null && !(n > 0 && n < 100)) { toast('La confianza tiene que estar entre 0 y 100 %.'); return; }
    S.prob = n; save(); compute();
  };
  $('btnApplyProj').onclick = () => {
    const P = ALGO.parseProject($('txtProj').value);
    S.proj = $('txtProj').value;
    S.projName = (Object.values(PROJECTS).find(p => p.text.trim() === S.proj.trim()) || { name: 'Proyecto cargado desde lista' }).name;
    save(); compute();
    if (!P.errors.length && S.result && S.result.ok) toast(`Proyecto cargado: ${P.acts.length} actividades.`);
  };
  $('btnCopyProj').onclick = () => copy($('txtProj').value, 'Lista de actividades copiada.');
  $('selStart').onchange = ev => { S.start = ev.target.value; changed(false); };
  $('selSrc').onchange = ev => { S.src = ev.target.value; changed(false); };
  $('selDst').onchange = ev => { S.dst = ev.target.value; changed(false); };
  $('btnCalc').onclick = compute;
  $('selPreset').onchange = ev => { if (ev.target.value) loadPreset(ev.target.value); ev.target.value = ''; };
  $('btnRand').onclick = () => isProj() ? randomProject(+$('numRand').value || 8) : randomGraph(+$('numRand').value || 8);
  $('btnDel').onclick = deleteSelection;
  $('btnClear').onclick = () => {
    if (isProj()) { S.proj = ''; S.projName = 'Proyecto nuevo'; $('txtProj').value = ''; save(); compute(); return; }
    S.nodes = []; S.edges = []; S.name = 'Grafo nuevo'; sel.node = sel.edge = null; changed(true);
  };
  $('btnApply').onclick = applyText;
  $('btnLayout').onclick = relayout;
  let msgT;
  $('txtEdges').addEventListener('input', () => { clearTimeout(msgT); msgT = setTimeout(() => edgeMsg(ALGO.parseEdges($('txtEdges').value)), 300); });
  const setZoom = z => { zoom = Math.max(1, Math.min(4, z)); svg.style.width = zoom * 100 + '%'; $('zoomLbl').textContent = Math.round(zoom * 100) + '%'; };
  $('btnZoomIn').onclick = () => setZoom(zoom * 1.5);
  $('btnZoomOut').onclick = () => setZoom(zoom / 1.5);
  $('btnZoomFit').onclick = () => setZoom(1);
  const toTSV = t => [t.cols, ...t.rows].map(r => r.join('\t')).join('\n');
  function copy(text, okMsg) {
    const fallback = () => { const ta = $('txtEdges'); const prev = ta.value; ta.value = text; ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.value = prev; toast(ok ? okMsg : 'No se pudo copiar automáticamente.'); };
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback); } catch (e) { fallback(); }
  }
  $('btnCopyTbl').onclick = () => { if (S.result && S.result.table) copy(toTSV(S.result.table), 'Tabla copiada: pegala en Word o Excel.'); };
  $('btnCopyExtra').onclick = () => { if (S.result && S.result.extra) copy(toTSV(S.result.extra), 'Tabla copiada.'); };
  $('btnCopyEdges').onclick = () => copy($('txtEdges').value, 'Lista de aristas copiada.');
  document.addEventListener('keydown', ev => {
    const t = ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { if (sel.node || sel.edge) { ev.preventDefault(); deleteSelection(); } }
    else if (ev.key === 'Enter' && t !== 'BUTTON') { ev.preventDefault(); compute(); }
    else if (ev.key === 'Escape') { sel.node = sel.edge = null; closePop(); renderGraph(); }
    else if (ev.key === 'ArrowRight' && S.result) goStep(S.step + 1);
    else if (ev.key === 'ArrowLeft' && S.result) goStep(S.step - 1);
  });
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

  /* ---------- inicio ---------- */
  if (restore()) { refreshSelects(); syncText(); compute(); }
  else loadPreset('A');
})();

/* ===== INTERFAZ ===== */
(() => {
  const W = 1000, H = 620, R = 22;
  const $ = id => document.getElementById(id);
  const svg = $('board'), gE = $('gEdges'), gN = $('gNodes'), gH = $('gHint');
  const NS = 'http://www.w3.org/2000/svg';
  const S = { nodes: [], edges: [], directed: false, name: 'Grafo', algo: 'prim', start: null, src: null, dst: null, result: null, step: 0 };
  const sel = { node: null, edge: null };
  let nextN = 1, nextE = 1, playTimer = null;
  const fmt = n => (Math.round(n * 1000) / 1000).toString();
  const lab = id => (S.nodes.find(n => n.id === id) || {}).label;
  const ALGO_NAME = { prim: 'Prim', kruskal: 'Kruskal', dijkstra: 'Dijkstra', maxflow: 'Ford-Fulkerson' };
  const isMST = () => S.algo === 'prim' || S.algo === 'kruskal';

  /* ---------- persistencia (solo comodidad local) ---------- */
  function save() {
    try { localStorage.setItem('redes-io-v1', JSON.stringify({ nodes: S.nodes, edges: S.edges, directed: S.directed, name: S.name, algo: S.algo, start: S.start, src: S.src, dst: S.dst })); } catch (e) {}
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem('redes-io-v1') || 'null');
      if (!d || !Array.isArray(d.nodes) || !d.nodes.length) return false;
      Object.assign(S, d);
      nextN = 1 + Math.max(0, ...S.nodes.map(n => +String(n.id).slice(1) || 0));
      nextE = 1 + Math.max(0, ...S.edges.map(e => +String(e.id).slice(1) || 0));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- carga de grafos ---------- */
  function setGraph(labels, pos, edgeList, directed, name) {
    nextN = 1; nextE = 1;
    const map = {};
    S.nodes = labels.map(l => { const n = { id: 'n' + (nextN++), label: String(l), x: pos[l][0], y: pos[l][1] }; map[l] = n.id; return n; });
    S.edges = edgeList.map(([u, v, w]) => ({ id: 'e' + (nextE++), u: map[u], v: map[v], w }));
    S.directed = directed; S.name = name;
    sel.node = sel.edge = null;
    S.start = S.src = S.nodes[0]?.id ?? null;
    S.dst = S.nodes[S.nodes.length - 1]?.id ?? null;
  }
  function loadPreset(key) {
    const p = PRESETS[key]; if (!p) return;
    const labels = Object.keys(p.pos);
    const pos = {}; labels.forEach(l => pos[l] = [60 + p.pos[l][0] * 880, 50 + p.pos[l][1] * 520]);
    const edges = p.edges.split('|').map(s => { const [u, v, w] = s.split(' '); return [u, v, +w]; });
    setGraph(labels, pos, edges, p.directed, p.name);
    if (key === 'FLUJO') S.algo = 'maxflow';
    else if (S.algo === 'maxflow' && !p.directed) { /* se mantiene: flujo en red no dirigida */ }
    changed(true);
  }
  function randomGraph(n) {
    n = Math.max(3, Math.min(20, n | 0));
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 5000) {
      tries++;
      const p = [70 + Math.random() * 860, 60 + Math.random() * 500];
      if (pts.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > Math.max(95, 260 - n * 9))) pts.push(p);
    }
    while (pts.length < n) pts.push([70 + Math.random() * 860, 60 + Math.random() * 500]);
    const labels = pts.map((_, i) => String(i + 1));
    const pos = {}; labels.forEach((l, i) => pos[l] = pts[i]);
    const d = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    const w = () => 1 + Math.floor(Math.random() * 20);
    const key = new Set(), edges = [];
    const add = (i, j) => { const k = i < j ? i + '-' + j : j + '-' + i; if (i === j || key.has(k)) return; key.add(k); edges.push([labels[i], labels[j], w()]); };
    // árbol aleatorio con vecinos cercanos (garantiza conexidad) + aristas extra cortas
    const inT = [0];
    for (let i = 1; i < n; i++) { let best = 0; inT.forEach(j => { if (d(i, j) < d(i, best)) best = j; }); add(i, best); inT.push(i); }
    for (let i = 0; i < n; i++) {
      const near = [...Array(n).keys()].filter(j => j !== i).sort((a, b) => d(i, a) - d(i, b)).slice(0, 3);
      near.forEach(j => { if (Math.random() < 0.45) add(i, j); });
    }
    setGraph(labels, pos, edges, S.directed, `Grafo aleatorio (${n} nodos)`);
    changed(true);
  }

  /* ---------- cálculo ---------- */
  function graph() { return { nodes: S.nodes, edges: S.edges, directed: S.directed }; }
  function compute() {
    stopPlay();
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
    const flow = S.algo === 'maxflow';
    $('fStart').hidden = S.algo !== 'prim';
    $('fSrc').hidden = $('fDst').hidden = isMST();
    $('fDir').hidden = isMST();
    $('lblSrc').textContent = flow ? 'Fuente' : 'Origen';
    $('lblDst').textContent = flow ? 'Sumidero' : 'Destino';
    $('chkDir').checked = S.directed;
    document.querySelectorAll('#algoPick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.algo === S.algo)));
  }

  /* ---------- dibujo del grafo ---------- */
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function currentStep() { return S.result && S.result.steps ? S.result.steps[S.step] : null; }
  const MARK = { tree: 'ar-tree', saturated: 'ar-tree', current: 'ar-cur', candidate: 'ar-cur', path: 'ar-path', flow: 'ar-path', rejected: 'ar-rej', cut: 'ar-rej' };

  function renderGraph() {
    gE.innerHTML = ''; gN.innerHTML = ''; gH.innerHTML = '';
    const st = currentStep();
    svg.classList.toggle('dim', !!st);
    const N = {}; S.nodes.forEach(n => N[n.id] = n);
    const showDir = S.directed && !isMST();
    for (const e of S.edges) {
      const a = N[e.u], b = N[e.v]; if (!a || !b) continue;
      const state = st && st.edges[e.id];
      let dir = (st && st.arrows && st.arrows[e.id]) || (showDir ? 'uv' : null);
      const g = el('g', { class: 'edge' + (state ? ' st-' + state : '') + (sel.edge === e.id ? ' sel' : ''), 'data-edge': e.id }, gE);
      let p = dir === 'vu' ? [b, a] : [a, b];
      const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // curva si existe la arista opuesta en un grafo dirigido
      const twin = showDir && S.edges.some(o => o !== e && o.u === e.v && o.v === e.u);
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
    if (!S.nodes.length) el('text', { x: W / 2, y: H / 2, class: 'empty-hint' }, gH).textContent = 'Doble click para agregar el primer nodo, o cargá un grafo de la guía';
    $('graphName').textContent = S.name;
    const status = sel.node ? `Nodo ${lab(sel.node)} seleccionado: tocá otro nodo para unirlos, o Supr para borrarlo`
      : sel.edge ? (() => { const e = S.edges.find(x => x.id === sel.edge); return `Arista ${lab(e.u)}–${lab(e.v)} seleccionada: doble click para cambiar el peso, Supr para borrarla`; })()
      : `${S.nodes.length} nodos · ${S.edges.length} aristas` + (S.directed && !isMST() ? ' · dirigido' : '') + (isMST() && S.directed ? ' · el árbol mínimo ignora el sentido' : '');
    $('status').textContent = status;
    $('btnDel').disabled = !(sel.node || sel.edge);
  }

  /* ---------- panel de resultado ---------- */
  const LEGEND = {
    prim: [['var(--accent)', 'en el árbol'], ['var(--cand)', 'arista elegida / candidatas']],
    kruskal: [['var(--accent)', 'aceptada'], ['var(--cand)', 'evaluando'], ['var(--reject)', 'rechazada (ciclo)']],
    dijkstra: [['var(--accent)', 'árbol de rutas'], ['var(--cand)', 'etiquetas actualizadas'], ['var(--path)', 'ruta más corta']],
    maxflow: [['var(--path)', 'con flujo'], ['var(--accent)', 'saturada'], ['var(--cand)', 'camino aumentante'], ['var(--reject)', 'corte mínimo']]
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
      $('extraTitle').textContent = S.algo === 'dijkstra' ? `Distancias mínimas desde ${lab(S.src)}` : 'Flujo por arista';
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
    const used = new Set();
    const lines = S.edges.map(e => { used.add(e.u); used.add(e.v); return `${lab(e.u)} ${lab(e.v)} ${fmt(e.w)}`; });
    S.nodes.filter(n => !used.has(n.id)).forEach(n => lines.push(n.label));
    $('txtEdges').value = lines.join('\n');
  }
  function applyText() {
    const lines = $('txtEdges').value.split(/\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    const order = [], seen = new Set(), list = [];
    const touch = l => { if (!seen.has(l)) { seen.add(l); order.push(l); } };
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].split(/[\s,;]+/).filter(Boolean);
      if (t.length === 1) { touch(t[0]); continue; }
      const w = Number(String(t[2]).replace(',', '.'));
      if (t.length < 3 || !isFinite(w)) return toast(`Línea ${i + 1}: usá el formato «origen destino peso».`);
      if (t[0] === t[1]) return toast(`Línea ${i + 1}: una arista no puede unir un nodo consigo mismo.`);
      touch(t[0]); touch(t[1]); list.push([t[0], t[1], w]);
    }
    if (!order.length) return toast('La lista está vacía.');
    const old = {}; S.nodes.forEach(n => old[n.label] = [n.x, n.y]);
    const fresh = order.filter(l => !old[l]);
    const pos = {};
    order.forEach((l, i) => {
      if (old[l]) pos[l] = old[l];
      else { const k = fresh.indexOf(l), m = fresh.length, a = -Math.PI / 2 + 2 * Math.PI * k / m; pos[l] = [W / 2 + Math.cos(a) * 250 * (m > 1 ? 1 : 0), H / 2 + Math.sin(a) * 230 * (m > 1 ? 1 : 0)]; }
    });
    const keep = { start: lab(S.start), src: lab(S.src), dst: lab(S.dst) };
    // quitar duplicados (la última gana)
    const dedup = new Map();
    list.forEach(([u, v, w]) => dedup.set(S.directed ? u + '>' + v : [u, v].sort().join('~'), [u, v, w]));
    setGraph(order, pos, [...dedup.values()], S.directed, 'Grafo cargado desde lista');
    const byL = l => S.nodes.find(n => n.label === l)?.id;
    S.start = byL(keep.start) ?? S.start; S.src = byL(keep.src) ?? S.src; S.dst = byL(keep.dst) ?? S.dst;
    changed(false);
    toast(`Grafo cargado: ${S.nodes.length} nodos, ${S.edges.length} aristas.`);
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
      n.x = Math.max(R + 4, Math.min(W - R - 4, p.x + down.ox));
      n.y = Math.max(R + 4, Math.min(H - R - 20, p.y + down.oy));
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
      openPop((a.x + b.x) / 2, (a.y + b.y) / 2, `Peso ${a.label}–${b.label}`, fmt(e.w), v => {
        const w = Number(String(v).replace(',', '.'));
        if (v === '' || !isFinite(w)) return 'Ingresá un número.';
        e.w = w; changed(true);
      });
      return;
    }
    sel.edge = sel.edge === id ? null : id; sel.node = null; renderGraph();
  }
  function emptyTap(p) {
    if (isDouble('empty', null, p)) {
      let k = 1; const used = new Set(S.nodes.map(n => n.label));
      while (used.has(String(k))) k++;
      const n = { id: 'n' + (nextN++), label: String(k), x: Math.max(R + 4, Math.min(W - R - 4, p.x)), y: Math.max(R + 4, Math.min(H - R - 20, p.y)) };
      S.nodes.push(n);
      if (S.name.startsWith('Guía') || S.name.startsWith('Ejemplo')) S.name = S.name + ' (editado)';
      sel.node = null; sel.edge = null;
      changed(true);
      return;
    }
    if (sel.node || sel.edge) { sel.node = sel.edge = null; renderGraph(); }
  }
  function startEdge(u, v) {
    const ex = S.edges.find(e => (e.u === u && e.v === v) || (!S.directed && e.u === v && e.v === u));
    const a = S.nodes.find(n => n.id === u), b = S.nodes.find(n => n.id === v);
    openPop((a.x + b.x) / 2, (a.y + b.y) / 2, `Peso ${a.label}${S.directed ? '→' : '–'}${b.label}`, ex ? fmt(ex.w) : '', val => {
      const w = Number(String(val).replace(',', '.'));
      if (val === '' || !isFinite(w)) return 'Ingresá un número.';
      if (ex) ex.w = w; else S.edges.push({ id: 'e' + (nextE++), u, v, w });
      changed(true);
    });
  }
  function deleteSelection() {
    if (sel.node) { const id = sel.node; S.nodes = S.nodes.filter(n => n.id !== id); S.edges = S.edges.filter(e => e.u !== id && e.v !== id); }
    else if (sel.edge) S.edges = S.edges.filter(e => e.id !== sel.edge);
    else return;
    sel.node = sel.edge = null; changed(true);
  }

  /* ---------- popover de edición ---------- */
  let popOk = null;
  function openPop(x, y, label, value, onOk) {
    const pop = $('pop'), r = svg.getBoundingClientRect();
    const px = Math.max(110, Math.min(r.width - 110, x / W * r.width)), py = Math.max(28, Math.min(r.height - 28, y / H * r.height));
    pop.style.left = px + 'px'; pop.style.top = py + 'px';
    $('popLbl').textContent = label; $('popInput').value = value;
    pop.hidden = false; popOk = onOk;
    setTimeout(() => { $('popInput').focus(); $('popInput').select(); }, 0);
  }
  function closePop() { $('pop').hidden = true; popOk = null; }
  function confirmPop() { if (!popOk) return; const err = popOk($('popInput').value); if (err) { toast(err); $('popInput').focus(); } else closePop(); }
  $('popOk').onclick = confirmPop;
  $('popCancel').onclick = closePop;
  $('popInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmPop(); } if (ev.key === 'Escape') closePop(); });

  /* ---------- controles ---------- */
  document.querySelectorAll('#algoPick button').forEach(b => b.onclick = () => { S.algo = b.dataset.algo; refreshSelects(); save(); compute(); });
  $('selStart').onchange = ev => { S.start = ev.target.value; changed(false); };
  $('selSrc').onchange = ev => { S.src = ev.target.value; changed(false); };
  $('selDst').onchange = ev => { S.dst = ev.target.value; changed(false); };
  $('chkDir').onchange = ev => { S.directed = ev.target.checked; changed(false); };
  $('btnCalc').onclick = compute;
  $('selPreset').onchange = ev => { if (ev.target.value) loadPreset(ev.target.value); ev.target.value = ''; };
  $('btnRand').onclick = () => randomGraph(+$('numRand').value || 8);
  $('btnDel').onclick = deleteSelection;
  $('btnClear').onclick = () => { S.nodes = []; S.edges = []; S.name = 'Grafo nuevo'; sel.node = sel.edge = null; changed(true); };
  $('btnApply').onclick = applyText;
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

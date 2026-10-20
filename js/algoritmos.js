/* ===== ALGORITMOS (funciones puras) =====
   Grafo: { nodes:[{id,label,x,y}], edges:[{id,u,v,w,dir?}], directed?:bool }
   dir de cada arista: true = dirigida u→v, false = sin sentido (bidireccional). Si falta, se usa G.directed.
   Cada algoritmo devuelve { ok, error?, summary, table:{cols,rows}, steps:[...] }
   step: { title, desc, row (filas visibles), nodes:{id:estado}, edges:{id:estado}, labels?:{id:texto}, arrows?:{id:'uv'|'vu'} }
*/
const ALGO = (() => {
  const fmt = n => (Math.round(n * 1000) / 1000).toString();
  const byLabel = (G) => { const m = {}; G.nodes.forEach(n => m[n.id] = n.label); return m; };
  const isDir = (G, e) => e.dir != null ? !!e.dir : !!G.directed;
  const dirNote = G => G.edges.some(e => isDir(G, e)) ? 'El árbol de expansión mínima no usa el sentido: las aristas dirigidas se toman como bidireccionales.' : null;
  const cmpLabel = (a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), 'es', { numeric: true });
  };

  function prim(G, start) {
    const L = byLabel(G), n = G.nodes.length;
    if (!n) return { ok: false, error: 'El grafo no tiene nodos.' };
    if (start == null || !(start in L)) start = G.nodes[0].id;
    const inTree = new Set([start]);
    const treeEdges = [];
    let total = 0;
    const rows = [], steps = [];
    const eName = e => `${L[e.u]}–${L[e.v]}`;
    const snap = (extra) => {
      const nodes = {}, edges = {};
      inTree.forEach(id => nodes[id] = 'in');
      treeEdges.forEach(e => edges[e.id] = 'tree');
      Object.assign(edges, extra.edges || {});
      if (extra.node) nodes[extra.node] = 'current';
      return { nodes, edges };
    };
    steps.push({ title: 'Inicio', desc: `Se planta la semilla en el nodo ${L[start]}. Frontera = {${L[start]}}.`, row: 0, ...snap({ node: start }) });
    while (inTree.size < n) {
      const cand = G.edges.filter(e => inTree.has(e.u) !== inTree.has(e.v));
      if (!cand.length) {
        return finish(`El grafo no es conexo: ${n - inTree.size} nodo(s) quedan sin conectar desde ${L[start]}.`);
      }
      cand.sort((a, b) => a.w - b.w || cmpLabel(L[a.u], L[b.u]) || cmpLabel(L[a.v], L[b.v]));
      const best = cand[0];
      const ties = cand.filter(e => e.w === best.w).length;
      const newNode = inTree.has(best.u) ? best.v : best.u;
      const from = inTree.has(best.u) ? best.u : best.v;
      const frontier = '{' + [...inTree].map(id => L[id]).sort(cmpLabel).join(', ') + '}';
      const candEdges = {};
      cand.forEach(e => candEdges[e.id] = 'candidate');
      candEdges[best.id] = 'current';
      inTree.add(newNode); treeEdges.push(best); total += best.w;
      rows.push([rows.length + 1, frontier, cand.map(e => `${eName(e)} (${fmt(e.w)})`).join(', '),
        `${L[from]}–${L[newNode]}` + (ties > 1 ? ` · empate ×${ties}` : ''), fmt(best.w), fmt(total)]);
      steps.push({
        title: `Paso ${rows.length}: ${L[from]}–${L[newNode]} (${fmt(best.w)})`,
        desc: `Desde la frontera ${frontier} se miran ${cand.length} arista(s) hacia nodos sin conectar. La más barata es ${L[from]}–${L[newNode]} con peso ${fmt(best.w)}` +
          (ties > 1 ? ` (hay ${ties} empatadas; se toma la primera, cualquier elección da el mismo costo).` : '.') + ` Se incorpora ${L[newNode]}. Acumulado: ${fmt(total)}.`,
        row: rows.length, ...snap({ edges: candEdges, node: newNode })
      });
    }
    return finish(null);
    function finish(err) {
      const s = snap({});
      steps.push({ title: err ? 'Resultado parcial' : 'Árbol mínimo encontrado', desc: err || `Todos los nodos conectados con ${treeEdges.length} aristas (n − 1) y sin ciclos. Costo total: ${fmt(total)}.`, row: rows.length, ...s });
      return {
        ok: !err, warning: [err, dirNote(G)].filter(Boolean).join(' ') || null,
        summary: { label: 'Costo total del árbol', value: fmt(total), detail: treeEdges.map(e => `${eName(e)} (${fmt(e.w)})`).join(' · ') },
        table: { cols: ['Paso', 'Nodos conectados', 'Aristas candidatas (peso)', 'Arista elegida', 'Peso', 'Acumulado'], rows },
        steps
      };
    }
  }

  function kruskal(G) {
    const L = byLabel(G), n = G.nodes.length;
    if (!n) return { ok: false, error: 'El grafo no tiene nodos.' };
    const parent = {}; G.nodes.forEach(x => parent[x.id] = x.id);
    const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const sorted = [...G.edges].sort((a, b) => a.w - b.w || cmpLabel(L[a.u], L[b.u]) || cmpLabel(L[a.v], L[b.v]));
    const eName = e => `${L[e.u]}–${L[e.v]}`;
    const accepted = [], rejected = [];
    let total = 0;
    const rows = [], steps = [];
    const comps = () => {
      const g = {};
      G.nodes.forEach(x => { const r = find(x.id); (g[r] = g[r] || []).push(L[x.id]); });
      return Object.values(g).filter(c => c.length > 1).map(c => '{' + c.sort(cmpLabel).join(',') + '}').join(' ') || '—';
    };
    const snap = (cur, state) => {
      const nodes = {}, edges = {};
      accepted.forEach(e => { edges[e.id] = 'tree'; nodes[e.u] = 'in'; nodes[e.v] = 'in'; });
      rejected.forEach(e => edges[e.id] = 'rejected');
      if (cur) edges[cur.id] = state;
      return { nodes, edges };
    };
    steps.push({ title: 'Ordenar aristas', desc: 'Se ordenan todas las aristas de menor a mayor peso: ' + sorted.map(e => `${eName(e)} (${fmt(e.w)})`).join(', ') + '.', row: 0, ...snap() });
    for (const e of sorted) {
      if (accepted.length === n - 1) break;
      const ru = find(e.u), rv = find(e.v);
      if (ru !== rv) {
        parent[ru] = rv; accepted.push(e); total += e.w;
        rows.push([rows.length + 1, eName(e), fmt(e.w), 'Aceptada', comps(), fmt(total)]);
        steps.push({ title: `${eName(e)} (${fmt(e.w)}) aceptada`, desc: `${L[e.u]} y ${L[e.v]} estaban en componentes distintas, así que la arista no forma ciclo. Componentes: ${comps()}. Acumulado: ${fmt(total)}.`, row: rows.length, ...snap(e, 'current') });
      } else {
        rejected.push(e);
        rows.push([rows.length + 1, eName(e), fmt(e.w), 'Rechazada (forma ciclo)', comps(), fmt(total)]);
        steps.push({ title: `${eName(e)} (${fmt(e.w)}) rechazada`, desc: `${L[e.u]} y ${L[e.v]} ya están conectados en la misma componente: agregarla cerraría un ciclo.`, row: rows.length, ...snap(e, 'rejected') });
      }
    }
    const pending = sorted.length - rows.length;
    const err = accepted.length < n - 1 ? `El grafo no es conexo: se obtuvo un bosque de ${n - accepted.length} componentes.` : null;
    steps.push({
      title: err ? 'Bosque de expansión mínima' : 'Árbol mínimo encontrado',
      desc: err || `Se aceptaron ${accepted.length} aristas (n − 1). ` + (pending ? `Las ${pending} aristas restantes no se evalúan porque el árbol ya está completo. ` : '') + `Costo total: ${fmt(total)}.`,
      row: rows.length, ...snap()
    });
    return {
      ok: !err, warning: [err, dirNote(G)].filter(Boolean).join(' ') || null,
      summary: { label: 'Costo total del árbol', value: fmt(total), detail: accepted.map(e => `${eName(e)} (${fmt(e.w)})`).join(' · ') },
      table: { cols: ['Paso', 'Arista', 'Peso', 'Decisión', 'Componentes formadas', 'Acumulado'], rows },
      steps
    };
  }

  function dijkstra(G, src, dst) {
    const L = byLabel(G);
    if (!G.nodes.length) return { ok: false, error: 'El grafo no tiene nodos.' };
    if (!(src in L)) return { ok: false, error: 'Elegí un nodo de origen.' };
    if (G.edges.some(e => e.w < 0)) return { ok: false, error: 'Dijkstra no admite pesos negativos. Revisá las aristas con peso < 0.' };
    const adj = {}; G.nodes.forEach(x => adj[x.id] = []);
    G.edges.forEach(e => { adj[e.u].push({ to: e.v, e }); if (!isDir(G, e)) adj[e.v].push({ to: e.u, e }); });
    const dist = {}, pred = {}, predE = {}, perm = new Set();
    G.nodes.forEach(x => dist[x.id] = Infinity);
    dist[src] = 0; pred[src] = null;
    const lab = id => `[${fmt(dist[id])}, ${pred[id] == null ? '–' : L[pred[id]]}]`;
    const rows = [], steps = [];
    const snap = (cur, upd) => {
      const nodes = {}, edges = {};
      perm.forEach(id => { nodes[id] = 'in'; if (predE[id]) edges[predE[id].id] = 'tree'; });
      (upd || []).forEach(e => edges[e.id] = 'candidate');
      if (cur != null) nodes[cur] = 'current';
      return { nodes, edges };
    };
    while (true) {
      let u = null;
      for (const x of G.nodes) if (!perm.has(x.id) && dist[x.id] < Infinity && (u == null || dist[x.id] < dist[u] || (dist[x.id] === dist[u] && cmpLabel(L[x.id], L[u]) < 0))) u = x.id;
      if (u == null) break;
      perm.add(u);
      const upd = [], updTxt = [];
      for (const { to, e } of adj[u]) {
        if (perm.has(to)) continue;
        if (dist[u] + e.w < dist[to]) {
          dist[to] = dist[u] + e.w; pred[to] = u; predE[to] = e;
          upd.push(e); updTxt.push(`${L[to]} ${lab(to)}`);
        }
      }
      const temps = G.nodes.filter(x => !perm.has(x.id) && dist[x.id] < Infinity).map(x => `${L[x.id]} ${lab(x.id)}`);
      rows.push([rows.length, L[u], lab(u), updTxt.join(', ') || '—', temps.join(', ') || '—']);
      steps.push({
        title: rows.length === 1 ? `Origen ${L[u]} con etiqueta ${lab(u)}` : `${L[u]} pasa a permanente ${lab(u)}`,
        desc: (rows.length === 1 ? `El origen recibe la etiqueta permanente [0, –]. ` : `${L[u]} tiene la menor etiqueta temporal (${fmt(dist[u])}), así que su distancia ya es definitiva. `) +
          (updTxt.length ? `Se actualizan sus vecinos: ${updTxt.join(', ')}.` : 'Ningún vecino mejora su etiqueta.'),
        row: rows.length, ...snap(u, upd)
      });
    }
    const reach = dist[dst] < Infinity;
    const path = [], pathE = [];
    if (dst in L && reach) { let c = dst; while (c != null) { path.unshift(c); if (predE[c]) pathE.unshift(predE[c]); c = pred[c]; } }
    const fin = snap();
    pathE.forEach(e => fin.edges[e.id] = 'path');
    path.forEach(id => fin.nodes[id] = 'path');
    const unreachable = G.nodes.filter(x => dist[x.id] === Infinity).map(x => L[x.id]);
    steps.push({
      title: reach ? `Ruta más corta ${L[src]} → ${L[dst]}` : 'Sin ruta',
      desc: reach ? `Se reconstruye el camino siguiendo los predecesores desde ${L[dst]}: ${path.map(id => L[id]).join(' → ')}. Distancia total: ${fmt(dist[dst])}.` +
        (unreachable.length ? ` Nodos inalcanzables: ${unreachable.join(', ')}.` : '')
        : `No existe camino de ${L[src]} a ${L[dst] ?? '?'}.`,
      row: rows.length, ...fin
    });
    return {
      ok: reach, warning: reach ? null : `No existe camino de ${L[src]} a ${L[dst] ?? '?'}.`,
      summary: { label: `Distancia mínima ${L[src]} → ${L[dst] ?? '?'}`, value: reach ? fmt(dist[dst]) : '∞', detail: reach ? path.map(id => L[id]).join(' → ') : 'Sin camino' },
      table: { cols: ['Iteración', 'Nodo permanente', 'Etiqueta [dist, pred]', 'Etiquetas actualizadas', 'Etiquetas temporales'], rows },
      extra: { cols: ['Nodo', 'Distancia desde ' + L[src], 'Predecesor', 'Ruta'], rows: G.nodes.slice().sort((a, b) => cmpLabel(a.label, b.label)).map(x => {
        if (dist[x.id] === Infinity) return [x.label, '∞', '–', 'inalcanzable'];
        const p = []; let c = x.id; while (c != null) { p.unshift(L[c]); c = pred[c]; }
        return [x.label, fmt(dist[x.id]), pred[x.id] == null ? '–' : L[pred[x.id]], p.join(' → ')];
      }) },
      steps
    };
  }

  function maxflow(G, s, t) {
    const L = byLabel(G);
    if (!(s in L) || !(t in L)) return { ok: false, error: 'Elegí la fuente y el sumidero.' };
    if (s === t) return { ok: false, error: 'La fuente y el sumidero tienen que ser nodos distintos.' };
    if (G.edges.some(e => e.w < 0)) return { ok: false, error: 'Las capacidades no pueden ser negativas.' };
    // Red residual: cada arista genera arco directo + reverso (cap 0 si es dirigida, cap w si es no dirigida)
    const out = {}; G.nodes.forEach(x => out[x.id] = []);
    const arcs = [], fwdArc = new Map();
    G.edges.forEach(e => {
      const a = { from: e.u, to: e.v, res: e.w, e, fwd: true };
      const b = { from: e.v, to: e.u, res: isDir(G, e) ? 0 : e.w, e, fwd: false };
      a.rev = b; b.rev = a; arcs.push(a, b); out[e.u].push(a); out[e.v].push(b); fwdArc.set(e, a);
    });
    const netFlow = e => e.w - fwdArc.get(e).res; // >0: u→v, <0: v→u
    const flowView = () => {
      const labels = {}, arrows = {}, edges = {};
      G.edges.forEach(e => {
        const f = netFlow(e);
        labels[e.id] = `${fmt(Math.abs(f))}/${fmt(e.w)}`;
        if (f !== 0) { edges[e.id] = Math.abs(f) === e.w ? 'saturated' : 'flow'; arrows[e.id] = f > 0 ? 'uv' : 'vu'; }
      });
      return { labels, arrows, edges };
    };
    const rows = [], steps = [];
    let total = 0;
    steps.push({ title: 'Flujo inicial = 0', desc: `Todas las aristas arrancan con flujo 0. Fuente: ${L[s]}, sumidero: ${L[t]}. Cada iteración busca un camino aumentante con capacidad residual > 0 (búsqueda en anchura, Edmonds-Karp).`, row: 0, nodes: { [s]: 'current', [t]: 'current' }, ...flowView() });
    for (let it = 0; it < 10000; it++) {
      const prev = { [s]: null }; const q = [s];
      while (q.length && !(t in prev)) {
        const u = q.shift();
        for (const a of out[u]) if (a.res > 1e-12 && !(a.to in prev)) { prev[a.to] = a; q.push(a.to); }
      }
      if (!(t in prev)) break;
      const path = []; let c = t;
      while (c !== s) { path.unshift(prev[c]); c = prev[c].from; }
      const bott = Math.min(...path.map(a => a.res));
      path.forEach(a => { a.res -= bott; a.rev.res += bott; });
      total += bott;
      const route = [L[s], ...path.map(a => L[a.to])].join(' → ');
      const back = path.filter(a => !a.fwd && isDir(G, a.e));
      rows.push([rows.length + 1, route, `min(${path.map(a => fmt(a.res + bott)).join(', ')}) = ${fmt(bott)}`, fmt(bott), fmt(total)]);
      const v = flowView();
      const edges = { ...v.edges }; path.forEach(a => edges[a.e.id] = 'current');
      const nodes = {}; nodes[s] = 'in'; nodes[t] = 'in'; path.forEach(a => nodes[a.to] = 'in');
      steps.push({
        title: `Camino ${rows.length}: +${fmt(bott)}`,
        desc: `Camino aumentante ${route}. Capacidades residuales: ${path.map(a => fmt(a.res + bott)).join(', ')}; el cuello de botella es ${fmt(bott)}. ` +
          (back.length ? `Usa ${back.length} arco(s) en sentido inverso, lo que cancela flujo enviado antes. ` : '') + `Flujo acumulado: ${fmt(total)}.`,
        row: rows.length, nodes, edges, labels: v.labels, arrows: v.arrows
      });
    }
    // Corte mínimo: nodos alcanzables desde s en la residual
    const S = new Set([s]); const q = [s];
    while (q.length) { const u = q.shift(); for (const a of out[u]) if (a.res > 1e-12 && !S.has(a.to)) { S.add(a.to); q.push(a.to); } }
    const cut = G.edges.filter(e => (S.has(e.u) && !S.has(e.v)) || (!isDir(G, e) && S.has(e.v) && !S.has(e.u)));
    const v = flowView();
    const nodes = {}; G.nodes.forEach(x => nodes[x.id] = S.has(x.id) ? 'in' : '');
    const edges = { ...v.edges }; cut.forEach(e => edges[e.id] = 'cut');
    steps.push({
      title: `Flujo máximo = ${fmt(total)}`,
      desc: `No quedan caminos aumentantes. Corte mínimo: S = {${[...S].map(id => L[id]).sort(cmpLabel).join(', ')}}; aristas del corte ${cut.map(e => `${L[e.u]}–${L[e.v]} (${fmt(e.w)})`).join(', ') || '—'}, capacidad ${fmt(cut.reduce((a, e) => a + e.w, 0))} = flujo máximo.`,
      row: rows.length, nodes, edges, labels: v.labels, arrows: v.arrows
    });
    return {
      ok: true,
      summary: { label: `Flujo máximo ${L[s]} → ${L[t]}`, value: fmt(total), detail: `Corte mínimo: ${cut.map(e => `${L[e.u]}–${L[e.v]}`).join(', ') || '—'}` },
      table: { cols: ['Iteración', 'Camino aumentante', 'Cuello de botella', 'Flujo enviado', 'Flujo acumulado'], rows },
      extra: { cols: ['Arista', 'Capacidad', 'Flujo', 'Sentido', 'Estado'], rows: G.edges.map(e => {
        const f = netFlow(e);
        return [`${L[e.u]}–${L[e.v]}`, fmt(e.w), fmt(Math.abs(f)), f === 0 ? '–' : (f > 0 ? `${L[e.u]} → ${L[e.v]}` : `${L[e.v]} → ${L[e.u]}`), Math.abs(f) === e.w && e.w > 0 ? 'Saturada' : (f === 0 ? 'Sin uso' : 'Holgura ' + fmt(e.w - Math.abs(f)))];
      }) },
      steps
    };
  }

  /* ===== CARGA DE GRAFOS EN TEXTO =====
     Una arista por línea:  A - B 5  (sin sentido)   A > B 5  (de A hacia B)   A < B 5  (de B hacia A)
     «A B 5» (sin símbolo) equivale a «A - B 5». Una línea con un solo nombre agrega un nodo aislado.
     Nombres: letras, números, _ y punto (sin espacios ni - < >). Lo que sigue a # es comentario. */
  const NAME = '[\\p{L}\\p{N}_.]+', NUM = '[+-]?\\d+(?:[.,]\\d+)?';
  const RE_OP = new RegExp(`^(${NAME})\\s*([<>-])\\s*(${NAME})(?:[\\s,;]+(${NUM}))?$`, 'u');
  const RE_PLAIN = new RegExp(`^(${NAME})[\\s,;]+(${NAME})(?:[\\s,;]+(${NUM}))?$`, 'u');
  const RE_NODE = new RegExp(`^(${NAME})$`, 'u');
  function parseEdges(text) {
    const nodes = [], seenN = new Set(), edges = [], errors = [], seenE = new Map();
    const touch = l => { if (!seenN.has(l)) { seenN.add(l); nodes.push(l); } };
    String(text || '').split(/\n/).forEach((raw, i) => {
      const line = raw.replace(/#.*/, '').trim(), n = i + 1;
      if (!line) return;
      let m, u, v, op, w;
      if ((m = line.match(RE_OP))) [, u, op, v, w] = m;
      else if ((m = line.match(RE_PLAIN))) { [, u, v, w] = m; op = '-'; }
      else if ((m = line.match(RE_NODE))) { touch(m[1]); return; }
      else return errors.push({ line: n, msg: `no se entiende «${line}». Usá «A - B 5», «A > B 5» o «A < B 5».` });
      if (w == null) return errors.push({ line: n, msg: `falta el peso de ${u} ${op} ${v}.` });
      w = Number(w.replace(',', '.'));
      if (op === '<') [u, v] = [v, u];
      if (u === v) return errors.push({ line: n, msg: `la arista ${u}–${v} une un nodo consigo mismo.` });
      const dir = op !== '-';
      const pair = [u, v].sort().join('~'), key = dir ? `${u}>${v}` : pair;
      // choques: misma arista repetida, o una sin sentido y otra dirigida entre el mismo par
      const prev = seenE.get(key) || (dir ? seenE.get(pair) : (seenE.get(`${u}>${v}`) || seenE.get(`${v}>${u}`)));
      if (prev) return errors.push({ line: n, msg: `la arista de esta línea choca con la de la línea ${prev.line} (mismo par de nodos).` });
      const e = { u, v, w, dir, line: n };
      seenE.set(key, e); touch(u); touch(v); edges.push(e);
    });
    return { nodes, edges, errors };
  }
  // Grafo → texto en el mismo formato (las dirigidas siempre con >)
  function edgesToText(G) {
    const L = byLabel(G), used = new Set();
    const lines = G.edges.map(e => { used.add(e.u); used.add(e.v); return `${L[e.u]} ${isDir(G, e) ? '>' : '-'} ${L[e.v]} ${fmt(e.w)}`; });
    G.nodes.filter(n => !used.has(n.id)).forEach(n => lines.push(n.label));
    return lines.join('\n');
  }

  /* ===== PROYECTOS: CPM y PERT (red AON: nodo = actividad, arco = precedencia inmediata) =====
     Proyecto: { acts:[{id, pred:[ids], t?, a?, m?, b?}] }
     Notación de la cátedra: IC/TC (inicio/terminación cercana), IL/TL (inicio/terminación lejana), Holgura = TL − TC. */
  const EPS = 1e-9;

  // Texto → proyecto. Una actividad por línea: «ID predecesoras duración» (CPM) o «ID predecesoras a m b» (PERT).
  // Predecesoras separadas por coma; «-» si no tiene. Líneas vacías o que empiezan con # se ignoran.
  function parseProject(text) {
    const acts = [], seen = new Set(), errors = [];
    String(text || '').split(/\n/).forEach((raw, i) => {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;
      const t = line.replace(/\s*,\s*/g, ',').split(/[\s;|]+/).filter(Boolean);
      const n = i + 1;
      if (t.length < 3) return errors.push(`Línea ${n}: usá «ID predecesoras duración» o «ID predecesoras a m b».`);
      const id = t[0];
      if (seen.has(id)) return errors.push(`Línea ${n}: la actividad «${id}» está repetida.`);
      const pred = (t[1] === '-' || t[1] === '—' || t[1] === '–') ? [] : t[1].split(',').filter(Boolean);
      const nums = t.slice(2).map(x => Number(x.replace(',', '.')));
      if (nums.some(x => !isFinite(x))) return errors.push(`Línea ${n}: las duraciones tienen que ser números.`);
      if (nums.some(x => x < 0)) return errors.push(`Línea ${n}: las duraciones no pueden ser negativas.`);
      const act = { id, pred };
      if (nums.length === 1) act.t = nums[0];
      else if (nums.length === 3) {
        [act.a, act.m, act.b] = nums;
        if (!(act.a <= act.m && act.m <= act.b)) return errors.push(`Línea ${n}: en «${id}» tiene que cumplirse a ≤ m ≤ b.`);
      } else return errors.push(`Línea ${n}: «${id}» tiene ${nums.length} números; poné 1 (duración) o 3 (a m b).`);
      seen.add(id); acts.push(act);
    });
    return { acts, errors };
  }

  // Valida referencias y ciclos; devuelve orden topológico (estable respecto del orden de carga) y sucesores.
  function topology(acts) {
    const byId = {}; acts.forEach(a => byId[a.id] = a);
    const errs = [];
    acts.forEach(a => a.pred.forEach(p => {
      if (p === a.id) errs.push(`«${a.id}» no puede ser predecesora de sí misma.`);
      else if (!(p in byId)) errs.push(`«${a.id}» tiene como predecesora a «${p}», que no existe.`);
    }));
    if (errs.length) return { errors: errs };
    const succ = {}, indeg = {};
    acts.forEach(a => { succ[a.id] = []; indeg[a.id] = 0; });
    acts.forEach(a => [...new Set(a.pred)].forEach(p => { succ[p].push(a.id); indeg[a.id]++; }));
    const order = [], done = new Set();
    while (order.length < acts.length) {
      const nx = acts.find(a => !done.has(a.id) && indeg[a.id] === 0);
      if (!nx) {
        const left = acts.filter(a => !done.has(a.id)).map(a => a.id);
        return { errors: [`Hay un ciclo en las precedencias entre: ${left.join(', ')}. Un proyecto no puede tener ciclos.`] };
      }
      done.add(nx.id); order.push(nx.id);
      succ[nx.id].forEach(s => indeg[s]--);
    }
    const level = {};
    order.forEach(id => { level[id] = byId[id].pred.length ? 1 + Math.max(...byId[id].pred.map(p => level[p])) : 0; });
    return { order, succ, byId, level };
  }

  // Φ(z) de la normal estándar (Zelen & Severo 26.2.17, error < 7.5e-8)
  function normCdf(z) {
    if (z < -10) return 0; if (z > 10) return 1;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }
  function normInv(p) { // por bisección: alcanza y sobra para 2-4 decimales
    let lo = -10, hi = 10;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (normCdf(mid) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  // Algoritmo de dos pasadas común a CPM y PERT. dur: id → duración.
  function twoPass(acts, topo, dur, rows, steps, rowOffset) {
    const { order, succ, byId } = topo;
    const IC = {}, TC = {}, IL = {}, TL = {};
    const eid = (p, a) => `${p}>${a}`;
    const vals = () => { const v = {}; acts.forEach(a => v[a.id] = { ic: IC[a.id], tc: TC[a.id], il: IL[a.id], tl: TL[a.id] }); return v; };
    const nodesWith = (cur, f) => { const n = {}; acts.forEach(a => { if (f(a.id)) n[a.id] = 'in'; }); if (cur) n[cur] = 'current'; return n; };
    // Fase 1: pasada hacia adelante
    for (const id of order) {
      const a = byId[id], d = dur[id];
      const edges = {};
      if (!a.pred.length) {
        IC[id] = 0;
        rows.push([rows.length + 1, 'Adelante', id, `Sin predecesoras → IC = 0 · TC = 0 + ${fmt(d)}`, '']);
      } else {
        const best = Math.max(...a.pred.map(p => TC[p]));
        IC[id] = best;
        a.pred.forEach(p => edges[eid(p, id)] = Math.abs(TC[p] - best) < EPS ? 'current' : 'candidate');
        rows.push([rows.length + 1, 'Adelante', id, `IC = máx(${a.pred.map(p => `TC ${p}=${fmt(TC[p])}`).join(', ')}) = ${fmt(best)} · TC = ${fmt(best)} + ${fmt(d)}`, '']);
      }
      TC[id] = IC[id] + d;
      rows[rows.length - 1][4] = `IC=${fmt(IC[id])} · TC=${fmt(TC[id])}`;
      steps.push({
        title: `Adelante · ${id}: [${fmt(IC[id])} | ${fmt(TC[id])}]`,
        desc: (a.pred.length > 1 ? `Convergen ${a.pred.length} predecesoras: ${id} espera a la más lenta. ` : '') + rows[rows.length - 1][3] + ` = ${fmt(TC[id])}.`,
        row: rows.length + rowOffset, nodes: nodesWith(id, x => x in TC), edges, vals: vals()
      });
    }
    const T = Math.max(0, ...acts.map(a => TC[a.id]));
    // Fase 2: pasada hacia atrás
    for (const id of [...order].reverse()) {
      const d = dur[id], ss = succ[id];
      const edges = {};
      if (!ss.length) {
        TL[id] = T;
        rows.push([rows.length + 1, 'Atrás', id, `Sin sucesoras → TL = duración del proyecto = ${fmt(T)} · IL = ${fmt(T)} − ${fmt(d)}`, '']);
      } else {
        const best = Math.min(...ss.map(s => IL[s]));
        TL[id] = best;
        ss.forEach(s => edges[eid(id, s)] = Math.abs(IL[s] - best) < EPS ? 'current' : 'candidate');
        rows.push([rows.length + 1, 'Atrás', id, `TL = mín(${ss.map(s => `IL ${s}=${fmt(IL[s])}`).join(', ')}) = ${fmt(best)} · IL = ${fmt(best)} − ${fmt(d)}`, '']);
      }
      IL[id] = TL[id] - d;
      rows[rows.length - 1][4] = `IL=${fmt(IL[id])} · TL=${fmt(TL[id])}`;
      steps.push({
        title: `Atrás · ${id}: [${fmt(IL[id])} | ${fmt(TL[id])}]`,
        desc: (ss.length > 1 ? `${id} se ramifica en ${ss.length} sucesoras: manda la restricción más estricta. ` : '') + rows[rows.length - 1][3] + ` = ${fmt(IL[id])}.`,
        row: rows.length + rowOffset, nodes: nodesWith(id, x => x in TL), edges, vals: vals()
      });
    }
    const HT = {}, HL = {}, crit = new Set();
    acts.forEach(a => {
      HT[a.id] = TL[a.id] - TC[a.id];
      HL[a.id] = (succ[a.id].length ? Math.min(...succ[a.id].map(s => IC[s])) : T) - TC[a.id];
      if (Math.abs(HT[a.id]) < EPS) { HT[a.id] = 0; crit.add(a.id); }
      if (Math.abs(HL[a.id]) < EPS) HL[a.id] = 0;
    });
    // Rutas críticas: cadenas de actividades críticas "pegadas" (TC pred = IC suc), de IC=0 a TC=T
    const paths = [];
    const dfs = (id, acc) => {
      if (paths.length >= 20) return;
      const nx = succ[id].filter(s => crit.has(s) && Math.abs(IC[s] - TC[id]) < EPS);
      if (!nx.length) { if (Math.abs(TC[id] - T) < EPS) paths.push([...acc, id]); return; }
      nx.forEach(s => dfs(s, [...acc, id]));
    };
    acts.filter(a => crit.has(a.id) && !a.pred.length).forEach(a => dfs(a.id, []));
    acts.filter(a => crit.has(a.id) && a.pred.length && Math.abs(IC[a.id]) < EPS).forEach(a => dfs(a.id, []));
    const critEdges = {};
    paths.forEach(p => p.slice(1).forEach((id, i) => critEdges[eid(p[i], id)] = 'path'));
    const critNodes = {}; crit.forEach(id => critNodes[id] = 'path');
    return { IC, TC, IL, TL, HT, HL, T, crit, paths, critEdges, critNodes, vals: vals() };
  }

  function projectBase(P) {
    if (P && P.errors && P.errors.length) return { error: P.errors.join(' ') };
    if (!P || !P.acts || !P.acts.length) return { error: 'Cargá al menos una actividad.' };
    const topo = topology(P.acts);
    if (topo.errors) return { error: topo.errors.join(' ') };
    return { topo };
  }
  const predTxt = a => a.pred.length ? a.pred.join(', ') : '–';

  function cpm(P) {
    const base = projectBase(P); if (base.error) return { ok: false, error: base.error };
    const { topo } = base, acts = P.acts;
    const dur = {}; let fromPert = false;
    acts.forEach(a => { if (a.t != null) dur[a.id] = a.t; else { dur[a.id] = (a.a + 4 * a.m + a.b) / 6; fromPert = true; } });
    const rows = [], steps = [];
    steps.push({ title: 'Red AON', desc: `${acts.length} actividades. Cada nodo es una actividad con su duración; cada flecha, una precedencia inmediata. Se recorre en orden topológico: ${topo.order.join(' → ')}.`, row: 0, nodes: {}, edges: {}, vals: {} });
    const R = twoPass(acts, topo, dur, rows, steps, 0);
    const routes = R.paths.map(p => p.join(' → '));
    steps.push({
      title: `Ruta crítica: ${routes[0] || '—'}`,
      desc: `Duración del proyecto: ${fmt(R.T)}. Holgura = TL − TC; las actividades con holgura 0 son críticas: ${[...R.crit].join(', ')}.` +
        (routes.length > 1 ? ` Hay ${routes.length} rutas críticas: ${routes.join(' | ')}.` : '') +
        (acts.some(a => !R.crit.has(a.id)) ? ' No críticas: ' + acts.filter(a => !R.crit.has(a.id)).map(a => `${a.id} (holgura ${fmt(R.HT[a.id])})`).join(', ') + '.' : ''),
      row: rows.length, nodes: R.critNodes, edges: R.critEdges, vals: R.vals
    });
    return {
      ok: true, warning: fromPert ? 'Algunas actividades tienen 3 estimaciones: CPM usa su tiempo esperado te = (a + 4m + b) / 6.' : null,
      summary: { label: 'Duración del proyecto', value: fmt(R.T), detail: 'Ruta crítica: ' + (routes.join(' | ') || '—') },
      table: { cols: ['Paso', 'Pasada', 'Actividad', 'Cálculo', 'Resultado'], rows },
      extra: { cols: ['Actividad', 'Predecesoras', 't', 'IC', 'TC', 'IL', 'TL', 'Holgura total', 'Holgura libre', 'Crítica'],
        rows: topo.order.map(id => { const a = topo.byId[id]; return [id, predTxt(a), fmt(dur[id]), fmt(R.IC[id]), fmt(R.TC[id]), fmt(R.IL[id]), fmt(R.TL[id]), fmt(R.HT[id]), fmt(R.HL[id]), R.crit.has(id) ? 'Sí' : 'No']; }) },
      net: { acts, order: topo.order, level: topo.level, dur },
      result: { T: R.T, crit: [...R.crit], paths: R.paths, IC: R.IC, TC: R.TC, IL: R.IL, TL: R.TL, HT: R.HT, HL: R.HL },
      steps
    };
  }

  // opts: { deadline?: número, prob?: 0..1 }
  function pert(P, opts = {}) {
    const base = projectBase(P); if (base.error) return { ok: false, error: base.error };
    const { topo } = base, acts = P.acts;
    const te = {}, v = {}, dur = {}, rows = [], steps = [];
    let single = 0;
    acts.forEach(a => {
      if (a.a == null) { a = { ...a, a: a.t, m: a.t, b: a.t }; single++; }
      te[a.id] = (a.a + 4 * a.m + a.b) / 6; v[a.id] = ((a.b - a.a) / 6) ** 2; dur[a.id] = te[a.id];
    });
    const est = id => { const a = topo.byId[id]; return a.a == null ? { a: a.t, m: a.t, b: a.t } : a; };
    steps.push({ title: 'Tres estimaciones por tarea', desc: 'Para cada actividad: tiempo esperado te = (a + 4m + b) / 6 y varianza σ² = ((b − a) / 6)².', row: 0, nodes: {}, edges: {}, vals: {} });
    topo.order.forEach(id => {
      const e = est(id);
      rows.push([rows.length + 1, 'Estimación', id, `te = (${fmt(e.a)} + 4·${fmt(e.m)} + ${fmt(e.b)}) / 6 · σ² = ((${fmt(e.b)} − ${fmt(e.a)}) / 6)²`, `te=${fmt(te[id])} · σ²=${fmt(v[id])}`]);
      steps.push({ title: `Estimación · ${id}: te = ${fmt(te[id])}`, desc: rows[rows.length - 1][3] + ` → te = ${fmt(te[id])}, σ² = ${fmt(v[id])}.`, row: rows.length, nodes: { [id]: 'current' }, edges: {}, vals: {} });
    });
    const R = twoPass(acts, topo, dur, rows, steps, 0);
    // Varianza del proyecto: suma de varianzas de la ruta crítica (si hay varias, la de mayor varianza)
    const pv = R.paths.map(p => p.reduce((s, id) => s + v[id], 0));
    let k = 0; pv.forEach((x, i) => { if (x > pv[k]) k = i; });
    const path = R.paths[k] || [], varP = pv[k] || 0, sd = Math.sqrt(varP);
    rows.push([rows.length + 1, 'Riesgo', path.join('-'), `σ²p = ${path.map(id => fmt(v[id])).join(' + ')} · σp = √${fmt(varP)}`, `σ²p=${fmt(varP)} · σp=${fmt(sd)}`]);
    steps.push({
      title: `Riesgo del proyecto: σp = ${fmt(sd)}`,
      desc: `Te = ${fmt(R.T)} (ruta crítica ${path.join(' → ')}). Solo se suman las varianzas de las actividades críticas: σ²p = ${path.map(id => fmt(v[id])).join(' + ')} = ${fmt(varP)}; σp = ${fmt(sd)}.` +
        (R.paths.length > 1 ? ` Hay ${R.paths.length} rutas críticas; se toma la de mayor varianza (escenario más conservador).` : ''),
      row: rows.length, nodes: R.critNodes, edges: R.critEdges, vals: R.vals
    });
    const prob = {};
    if (opts.deadline != null && isFinite(opts.deadline)) {
      const T = +opts.deadline;
      if (sd > EPS) {
        prob.z = (T - R.T) / sd; prob.p = normCdf(prob.z);
        rows.push([rows.length + 1, 'Probabilidad', `T=${fmt(T)}`, `Z = (${fmt(T)} − ${fmt(R.T)}) / ${fmt(sd)} = ${prob.z.toFixed(2)}`, `P(terminar ≤ ${fmt(T)}) = ${prob.p.toFixed(4)} (${(prob.p * 100).toFixed(2)}%)`]);
      } else {
        prob.p = T + EPS >= R.T ? 1 : 0;
        rows.push([rows.length + 1, 'Probabilidad', `T=${fmt(T)}`, 'σp = 0: la duración es determinística', `P = ${prob.p * 100}%`]);
      }
      prob.T = T;
      steps.push({ title: `P(terminar en ≤ ${fmt(T)}) = ${(prob.p * 100).toFixed(2)}%`, desc: rows[rows.length - 1][3] + '. ' + rows[rows.length - 1][4] + ' (área a la izquierda de Z bajo la normal estándar).', row: rows.length, nodes: R.critNodes, edges: R.critEdges, vals: R.vals });
    }
    if (opts.prob != null && opts.prob > 0 && opts.prob < 1) {
      const z = normInv(opts.prob), Tq = R.T + z * sd;
      prob.target = { p: opts.prob, z, T: Tq };
      rows.push([rows.length + 1, 'Plazo', `${fmt(opts.prob * 100)}%`, `Z(${fmt(opts.prob * 100)}%) = ${z.toFixed(2)} · T = ${fmt(R.T)} + ${z.toFixed(2)}·${fmt(sd)}`, `T = ${fmt(Tq)}`]);
      steps.push({ title: `Plazo con ${fmt(opts.prob * 100)}% de confianza: ${fmt(Tq)}`, desc: rows[rows.length - 1][3] + ` = ${fmt(Tq)}.`, row: rows.length, nodes: R.critNodes, edges: R.critEdges, vals: R.vals });
    }
    const detail = [`Ruta crítica ${path.join(' → ')}`, `σp = ${fmt(sd)}`];
    if (prob.p != null) detail.push(`P(T ≤ ${fmt(prob.T)}) = ${(prob.p * 100).toFixed(2)}%`);
    if (prob.target) detail.push(`${fmt(prob.target.p * 100)}% → ${fmt(prob.target.T)}`);
    return {
      ok: true, warning: single ? `${single} actividad(es) tienen una sola duración: se toman como a = m = b (varianza 0).` : null,
      summary: { label: 'Tiempo esperado del proyecto (Te)', value: fmt(R.T), detail: detail.join(' · ') },
      table: { cols: ['Paso', 'Etapa', 'Actividad', 'Cálculo', 'Resultado'], rows },
      extra: { cols: ['Actividad', 'Predecesoras', 'a', 'm', 'b', 'te', 'σ²', 'IC', 'TC', 'IL', 'TL', 'Holgura', 'Crítica'],
        rows: topo.order.map(id => { const e = est(id); return [id, predTxt(topo.byId[id]), fmt(e.a), fmt(e.m), fmt(e.b), fmt(te[id]), fmt(v[id]), fmt(R.IC[id]), fmt(R.TC[id]), fmt(R.IL[id]), fmt(R.TL[id]), fmt(R.HT[id]), R.crit.has(id) ? 'Sí' : 'No']; }) },
      net: { acts, order: topo.order, level: topo.level, dur },
      result: { Te: R.T, varP, sd, path, paths: R.paths, crit: [...R.crit], te, v, ...prob },
      steps
    };
  }

  return { prim, kruskal, dijkstra, maxflow, cpm, pert, parseEdges, edgesToText, parseProject, normCdf, normInv, cmpLabel, isDir };
})();
if (typeof module !== 'undefined') module.exports = ALGO; // permite testear con Node

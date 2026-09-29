/* ===== ALGORITMOS (funciones puras) =====
   Grafo: { nodes:[{id,label,x,y}], edges:[{id,u,v,w}], directed:bool }
   Cada algoritmo devuelve { ok, error?, summary, table:{cols,rows}, steps:[...] }
   step: { title, desc, row (filas visibles), nodes:{id:estado}, edges:{id:estado}, labels?:{id:texto}, arrows?:{id:'uv'|'vu'} }
*/
const ALGO = (() => {
  const fmt = n => (Math.round(n * 1000) / 1000).toString();
  const byLabel = (G) => { const m = {}; G.nodes.forEach(n => m[n.id] = n.label); return m; };
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
        ok: !err, warning: err,
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
      ok: !err, warning: err,
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
    G.edges.forEach(e => { adj[e.u].push({ to: e.v, e }); if (!G.directed) adj[e.v].push({ to: e.u, e }); });
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
    const arcs = [];
    G.edges.forEach(e => {
      const a = { from: e.u, to: e.v, res: e.w, e, fwd: true };
      const b = { from: e.v, to: e.u, res: G.directed ? 0 : e.w, e, fwd: false };
      a.rev = b; b.rev = a; arcs.push(a, b); out[e.u].push(a); out[e.v].push(b);
    });
    const netFlow = e => { const a = arcs.find(x => x.e === e && x.fwd); return e.w - a.res; }; // >0: u→v, <0: v→u
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
      const back = path.filter(a => !a.fwd && G.directed);
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
    const cut = G.edges.filter(e => (S.has(e.u) && !S.has(e.v)) || (!G.directed && S.has(e.v) && !S.has(e.u)));
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

  return { prim, kruskal, dijkstra, maxflow, cmpLabel };
})();
if (typeof module !== 'undefined') module.exports = ALGO; // permite testear con Node

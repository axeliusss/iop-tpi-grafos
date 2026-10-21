/* Pruebas de los algoritmos (sin dependencias): node tests/test.js
   1) Casos de las presentaciones de la cátedra, con el resultado que dan las diapositivas.
   2) Propiedades que tienen que cumplirse siempre, verificadas sobre cientos de grafos aleatorios
      contra un método independiente (Bellman-Ford, camino más largo por fuerza bruta, etc.). */
const assert = require('assert');
const A = require('../js/algoritmos.js');
const { PRESETS, PROJECTS } = require('../js/grafos-guia.js');

let ok = 0, fail = 0;
function test(name, fn) {
  try { fn(); ok++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// Arma un grafo del formato del app a partir de "u v w|u v w"
function graphOf(list, directed) {
  const ids = {}, nodes = [], edges = [];
  const id = l => { if (!(l in ids)) { ids[l] = 'n' + nodes.length; nodes.push({ id: ids[l], label: l }); } return ids[l]; };
  list.split('|').forEach((s, k) => { const [u, v, w] = s.trim().split(/\s+/); edges.push({ id: 'e' + k, u: id(u), v: id(v), w: +w }); });
  return { G: { nodes, edges, directed }, id };
}
function randomGraph(n, m, directed, maxW = 20) {
  const nodes = [...Array(n)].map((_, i) => ({ id: 'n' + i, label: String(i + 1) }));
  const edges = []; let k = 0;
  for (let i = 1; i < n; i++) edges.push({ id: 'e' + k++, u: 'n' + Math.floor(Math.random() * i), v: 'n' + i, w: 1 + Math.floor(Math.random() * maxW) });
  for (let j = 0; j < m; j++) { const a = Math.floor(Math.random() * n), b = Math.floor(Math.random() * n); if (a !== b) edges.push({ id: 'e' + k++, u: 'n' + a, v: 'n' + b, w: 1 + Math.floor(Math.random() * maxW) }); }
  return { nodes, edges, directed };
}

console.log('\nCasos de la cátedra');
const indu = graphOf(PRESETS.INDUTECH.edges, false);
test('MST InduTech · Prim desde A = 115 (A-B, B-C, C-F, F-G, B-D, D-E)', () => {
  const r = A.prim(indu.G, indu.id('A'));
  assert.strictEqual(r.summary.value, '115');
  assert.strictEqual(r.table.rows.map(x => x[3]).join(' '), 'A–B B–C C–F F–G B–D D–E');
});
test('MST InduTech · Kruskal = 115, acepta C-F, B-C, F-G, B-D, D-E, A-B', () => {
  const r = A.kruskal(indu.G);
  assert.strictEqual(r.summary.value, '115');
  assert.deepStrictEqual(r.table.rows.filter(x => x[3] === 'Aceptada').map(x => x[1]), ['C–F', 'B–C', 'F–G', 'B–D', 'D–E', 'A–B']);
});
test('Dijkstra InduTech · A → G = 70 por A-B-C-F-G', () => {
  const r = A.dijkstra(indu.G, indu.id('A'), indu.id('G'));
  assert.strictEqual(r.summary.value, '70');
  assert.strictEqual(r.summary.detail, 'A → B → C → F → G');
});
test('Flujo máximo red de transmisión = 18 Mbps (8 por S-A-T + 10 por S-B-T)', () => {
  const f = graphOf(PRESETS.FLUJO18.edges, true);
  const r = A.maxflow(f.G, f.id('S'), f.id('T'));
  assert.strictEqual(r.summary.value, '18');
  assert.deepStrictEqual(r.table.rows.map(x => x[3]), ['8', '10']);
});
test('CPM servidores · duración 21, ruta crítica A-B-D-E, holgura de C = 3', () => {
  const r = A.cpm(A.parseProject(PROJECTS.CPM_SERV.text));
  assert.strictEqual(r.result.T, 21);
  assert.deepStrictEqual(r.result.paths, [['A', 'B', 'D', 'E']]);
  assert.strictEqual(r.result.HT.C, 3);
  assert.deepStrictEqual([r.result.IC.D, r.result.TC.D, r.result.IL.C, r.result.TL.C], [12, 18, 8, 12]);
});
test('PERT servidores · Te ≈ 21.33, σ²p ≈ 1.94, σp ≈ 1.39, P(T ≤ 18) ≈ 0.008', () => {
  const r = A.pert(A.parseProject(PROJECTS.PERT_SERV.text), { deadline: 18 });
  assert(near(r.result.Te, 21.3333, 1e-3));
  assert(near(r.result.varP, 1.9444, 1e-3));
  assert(near(r.result.sd, 1.3944, 1e-3));
  assert(near(r.result.z, -2.39, 0.01));
  // La cátedra redondea te a 21.34 y σ a 1.39 → Z = −2.40 → 0.0082. Con los valores exactos da 0.0084.
  assert(near(r.result.p, 0.0084, 0.0002));
  assert(near(A.normCdf(-2.40), 0.0082, 0.0001));
});

console.log('\nGrafos A–E de la guía');
for (const k of ['A', 'B', 'C', 'D', 'E']) {
  test(`Grafo ${k} · Prim y Kruskal dan el mismo costo`, () => {
    const g = graphOf(PRESETS[k].edges, false);
    assert.strictEqual(A.prim(g.G, g.G.nodes[0].id).summary.value, A.kruskal(g.G).summary.value);
  });
}

console.log('\nPropiedades sobre grafos aleatorios (hasta 200 nodos)');
test('Prim = Kruskal en 300 grafos', () => {
  for (let i = 0; i < 300; i++) {
    const G = randomGraph(5 + Math.floor(Math.random() * 196), Math.floor(Math.random() * 400), false);
    assert.strictEqual(A.prim(G, 'n0').summary.value, A.kruskal(G).summary.value);
  }
});
test('Dijkstra = Bellman-Ford en 300 grafos (dirigidos y no dirigidos)', () => {
  for (let i = 0; i < 300; i++) {
    const G = randomGraph(5 + Math.floor(Math.random() * 120), Math.floor(Math.random() * 300), i % 2 === 0);
    const n = G.nodes.length, dst = 'n' + (n - 1), d = {};
    G.nodes.forEach(x => d[x.id] = Infinity); d.n0 = 0;
    for (let k = 0; k < n; k++) G.edges.forEach(e => {
      if (d[e.u] + e.w < d[e.v]) d[e.v] = d[e.u] + e.w;
      if (!G.directed && d[e.v] + e.w < d[e.u]) d[e.u] = d[e.v] + e.w;
    });
    const r = A.dijkstra(G, 'n0', dst);
    assert.strictEqual(r.summary.value, d[dst] === Infinity ? '∞' : String(d[dst]));
  }
});
test('Flujo máximo = capacidad del corte mínimo y se conserva el flujo en 300 redes', () => {
  for (let i = 0; i < 300; i++) {
    const G = randomGraph(4 + Math.floor(Math.random() * 60), Math.floor(Math.random() * 200), true);
    const t = 'n' + (G.nodes.length - 1);
    const r = A.maxflow(G, 'n0', t);
    const cutCap = G.edges.filter(e => r.summary.detail.split(': ')[1].split(', ').includes(`${G.nodes.find(x => x.id === e.u).label}–${G.nodes.find(x => x.id === e.v).label}`))
      .reduce((s, e) => s + e.w, 0);
    assert.strictEqual(String(cutCap), r.summary.value === '0' ? '0' : r.summary.value);
    // conservación: en cada nodo intermedio entra lo mismo que sale
    const bal = {}; G.nodes.forEach(x => bal[x.label] = 0);
    r.extra.rows.forEach(([, , f, dir]) => { if (dir === '–') return; const [a, b] = dir.split(' → '); bal[a] -= +f; bal[b] += +f; });
    G.nodes.forEach(x => { if (x.id !== 'n0' && x.id !== t) assert(near(bal[x.label], 0), `desbalance en ${x.label}`); });
  }
});
test('CPM = camino más largo (fuerza bruta) en 200 proyectos; holguras ≥ 0 y críticas con holgura 0', () => {
  for (let i = 0; i < 200; i++) {
    const n = 3 + Math.floor(Math.random() * 40), lines = [];
    for (let j = 0; j < n; j++) {
      const pred = [...new Set([...Array(Math.floor(Math.random() * 3))].map(() => Math.floor(Math.random() * j)).filter(x => j > 0))];
      lines.push(`T${j} ${pred.map(p => 'T' + p).join(',') || '-'} ${Math.floor(Math.random() * 10)}`);
    }
    const P = A.parseProject(lines.join('\n')), r = A.cpm(P);
    const longest = {}; P.acts.forEach(a => longest[a.id] = a.t + Math.max(0, ...a.pred.map(p => longest[p])));
    assert.strictEqual(r.result.T, Math.max(...Object.values(longest)));
    P.acts.forEach(a => {
      assert(r.result.HT[a.id] >= 0 && r.result.HL[a.id] >= 0 && r.result.HL[a.id] <= r.result.HT[a.id] + 1e-9);
      assert.strictEqual(r.result.crit.includes(a.id), r.result.HT[a.id] === 0);
    });
    r.result.paths.forEach(p => assert.strictEqual(p.reduce((s, id) => s + P.acts.find(a => a.id === id).t, 0), r.result.T));
  }
});
console.log('\nFormato de texto de aristas (-, >, <)');
test('Interpreta - > < y la línea sin símbolo; < se invierte a >', () => {
  const P = A.parseEdges('A - B 5\nA > C 3\nC<D 2\nE F 1,5\nX   # nodo suelto');
  assert.deepStrictEqual(P.errors, []);
  assert.deepStrictEqual(P.edges.map(e => `${e.u} ${e.dir ? '>' : '-'} ${e.v} ${e.w}`), ['A - B 5', 'A > C 3', 'D > C 2', 'E - F 1.5']);
  assert.deepStrictEqual(P.nodes, ['A', 'B', 'C', 'D', 'E', 'F', 'X']);
});
test('Permite arcos opuestos (A > B y B > A) pero marca choques y repetidas con su línea', () => {
  assert.deepStrictEqual(A.parseEdges('A > B 3\nB > A 5').errors, []);
  const P = A.parseEdges('A - B 5\nA > B 3\nA > C 1\nC < A 2\nG H\nfoo bar baz\nK - K 2');
  assert.deepStrictEqual(P.errors.map(e => e.line), [2, 4, 5, 6, 7]);
});
test('Texto → grafo → texto da lo mismo (las < se escriben como >)', () => {
  const P = A.parseEdges('A - B 5\nC < A 2\nB > C 1');
  const ids = {}; P.nodes.forEach((l, i) => ids[l] = 'n' + i);
  const G = { nodes: P.nodes.map(l => ({ id: ids[l], label: l })), edges: P.edges.map((e, i) => ({ id: 'e' + i, u: ids[e.u], v: ids[e.v], w: e.w, dir: e.dir })) };
  assert.strictEqual(A.edgesToText(G), 'A - B 5\nA > C 2\nB > C 1');
});
test('Grafos mixtos: Dijkstra respeta el sentido de cada arista (vs. Bellman-Ford) en 200 grafos', () => {
  for (let i = 0; i < 200; i++) {
    const G = randomGraph(5 + Math.floor(Math.random() * 80), Math.floor(Math.random() * 200), false);
    G.edges.forEach(e => e.dir = Math.random() < 0.5);
    const n = G.nodes.length, dst = 'n' + (n - 1), d = {};
    G.nodes.forEach(x => d[x.id] = Infinity); d.n0 = 0;
    for (let k = 0; k < n; k++) G.edges.forEach(e => {
      if (d[e.u] + e.w < d[e.v]) d[e.v] = d[e.u] + e.w;
      if (!e.dir && d[e.v] + e.w < d[e.u]) d[e.u] = d[e.v] + e.w;
    });
    assert.strictEqual(A.dijkstra(G, 'n0', dst).summary.value, d[dst] === Infinity ? '∞' : String(d[dst]));
  }
});
test('Flujo: «A - B c» da el mismo flujo máximo que «A > B c» + «B > A c» en 200 redes mixtas', () => {
  for (let i = 0; i < 200; i++) {
    const G = randomGraph(4 + Math.floor(Math.random() * 40), Math.floor(Math.random() * 120), false);
    G.edges.forEach(e => e.dir = Math.random() < 0.6);
    const t = 'n' + (G.nodes.length - 1);
    const H = { nodes: G.nodes, edges: G.edges.flatMap(e => e.dir ? [e] : [{ ...e, dir: true }, { ...e, id: e.id + 'r', u: e.v, v: e.u, dir: true }]) };
    assert.strictEqual(A.maxflow(G, 'n0', t).summary.value, A.maxflow(H, 'n0', t).summary.value);
  }
});

test('Todos los archivos de casos/ se cargan sin errores', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'casos');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    const errs = /cpm|pert|proyecto/.test(f) ? A.parseProject(txt).errors : A.parseEdges(txt).errors.map(e => `línea ${e.line}: ${e.msg}`);
    assert.deepStrictEqual(errs, [], f);
  }
});

console.log('\nProyectos');
test('Validaciones de proyectos: ciclos, predecesoras inexistentes, a ≤ m ≤ b', () => {
  assert(/ciclo/.test(A.cpm(A.parseProject('A - 1\nB A,C 2\nC B 3')).error));
  assert(/no existe/.test(A.cpm(A.parseProject('A Z 1')).error));
  assert(/a ≤ m ≤ b/.test(A.pert(A.parseProject('A - 5 3 1')).error));
});

console.log(`\n${ok} pruebas OK, ${fail} con error\n`);
process.exit(fail ? 1 : 0);

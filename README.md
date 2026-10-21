# Laboratorio de Redes — TPI Modelos de Red

UTN FRVT · Ingeniería en Sistemas de Información · Investigación Operativa 2026

App web para cargar un grafo (nodos y aristas con peso) y resolverlo automáticamente, con **tabla detalle paso a paso**:

| Algoritmo | Problema | Resultado |
|---|---|---|
| Prim | Árbol de expansión mínima | Costo total + aristas del árbol |
| Kruskal | Árbol de expansión mínima | Aristas aceptadas / rechazadas por ciclo |
| Dijkstra | Ruta más corta | Etiquetas [distancia, predecesor] y ruta |
| Ford-Fulkerson (Edmonds-Karp) | Flujo máximo | Caminos aumentantes, flujo por arista y corte mínimo |
| CPM | Ruta crítica (red AON) | IC, TC, IL, TL, holgura total y libre, rutas críticas |
| PERT | Ruta crítica probabilística | te, σ², Te, σp, Z, P(terminar ≤ T) y plazo para una confianza dada |

Incluye precargados los grafos A–E de la *Guía Práctica: Modelos de Red, Actividad 1* y los casos de las presentaciones de la cátedra:
InduTech S.A. (MST = 115, Dijkstra A→G = 70), red de transmisión (flujo máximo = 18 Mbps) e instalación de servidores (CPM = 21 días; PERT Te = 21,33, σp = 1,39).

## Uso

- **Doble click** en el lienzo: agrega un nodo.
- **Click en un nodo y luego en otro**: crea una arista y pide el peso.
- **Doble click en una arista**: cambia el peso. **Doble click en un nodo**: cambia el nombre.
- Arrastrar para mover nodos. `Supr` borra la selección, `Enter` calcula, `←` `→` recorren los pasos.
- También se puede cargar el grafo como texto, una arista por línea (ver abajo).
- **Reordenar** acomoda los nodos automáticamente; los botones **− / + / Ajustar** hacen zoom sobre el lienzo (útil con 200 nodos).
- "Copiar tabla" copia la tabla detalle para pegarla en Word o Excel.

### Formato de las aristas

```
A - B 5     # sin sentido (bidireccional)
A > B 5     # dirigida de A hacia B
A < B 5     # dirigida de B hacia A (al copiar se escribe B > A 5)
A B 5       # sin símbolo = sin sentido
X           # nodo suelto, sin aristas
```

- El número es el peso (costo, distancia o capacidad según el algoritmo). Los nombres de nodos son letras, números, `_` o `.`, sin espacios.
- Se pueden mezclar aristas con y sin sentido. Dijkstra y Ford-Fulkerson respetan el sentido de cada una; Prim y Kruskal lo ignoran y lo avisan.
- En flujo máximo, `A - B 10` es un canal de capacidad 10 que se puede usar en cualquier sentido; da el mismo flujo máximo que `A > B 10` más `B > A 10`.
- `A > B` y `B > A` pueden convivir (arcos opuestos). La misma arista repetida, o una `-` y una `>` entre el mismo par, se marcan como error con su número de línea y no se carga nada hasta corregirlas.
- Al aplicar una lista nueva los nodos se acomodan solos (acomodo por "estrés": cada par de nodos queda a una distancia proporcional a las aristas que los separan). Si solo se editaron algunas líneas del grafo actual, los nodos existentes quedan donde estaban.
- Al dibujar con el mouse, el cuadro del peso trae un selector `-` / `>` / `<`.

### Casos listos para pegar

La carpeta `casos/` tiene archivos `.txt` para copiar y pegar en la lista: los grafos A–E de la guía, los casos de la cátedra, un grafo y una red de flujo de 200 nodos y un proyecto de 200 actividades (CPM y PERT). Cada archivo empieza con comentarios (`#`) que indican qué algoritmo usar y el resultado esperado.

### CPM y PERT

Se cargan como lista de actividades, una por línea:

```
# ID  predecesoras  duración        (CPM)
A - 5
D B,C 6

# ID  predecesoras  a  m  b         (PERT)
A - 3 5 7
D B,C 4 6 9
```

La red se dibuja sola en formato AON (nodo = actividad, flecha = precedencia inmediata), ordenada por niveles, con cada caja como en la cátedra: `[IC | TC]` arriba, `ID | t` al medio y `[IL | TL]` abajo. En PERT se ingresan el plazo T (para calcular la probabilidad de cumplirlo) y/o un % de confianza (para calcular el plazo). La app valida ciclos, predecesoras inexistentes y que a ≤ m ≤ b.

Nota sobre el caso PERT de la cátedra: la presentación redondea Te a 21,34 y σp a 1,39, y obtiene Z = −2,40 → P = 0,0082. Con los valores sin redondear da Z = −2,39 → P = 0,0084.

## Correr localmente

No necesita instalar nada: abrir `index.html` en el navegador.

## Estructura

```
index.html            estructura de la página
css/styles.css        estilos (tema claro y oscuro)
js/algoritmos.js      Prim, Kruskal, Dijkstra, Ford-Fulkerson, CPM, PERT (funciones puras)
js/grafos-guia.js     grafos A–E de la guía, casos de la cátedra y proyectos CPM/PERT
tests/test.js         pruebas automáticas (node tests/test.js)
casos/*.txt           casos para copiar y pegar en la app
js/app.js             editor del grafo, dibujo SVG, tablas y controles
```

Los algoritmos no dependen del navegador, así que se pueden probar con Node:

```bash
node tests/test.js
```

Las pruebas verifican los resultados de las presentaciones de la cátedra y, además, comparan cada algoritmo contra un método independiente sobre cientos de grafos aleatorios de hasta 200 nodos: Prim = Kruskal, Dijkstra = Bellman-Ford (también en grafos mixtos), flujo máximo = capacidad del corte mínimo (con conservación de flujo en cada nodo), CPM = camino más largo calculado por fuerza bruta, y que el formato de texto se interpreta bien (incluidos todos los archivos de `casos/`).

# Laboratorio de Redes — TPI Modelos de Red

UTN FRVT · Ingeniería en Sistemas de Información · Investigación Operativa 2026

App web para cargar un grafo (nodos y aristas con peso) y resolverlo automáticamente, con **tabla detalle paso a paso**:

| Algoritmo | Problema | Resultado |
|---|---|---|
| Prim | Árbol de expansión mínima | Costo total + aristas del árbol |
| Kruskal | Árbol de expansión mínima | Aristas aceptadas / rechazadas por ciclo |
| Dijkstra | Ruta más corta | Etiquetas [distancia, predecesor] y ruta |
| Ford-Fulkerson (Edmonds-Karp) | Flujo máximo | Caminos aumentantes, flujo por arista y corte mínimo |

Incluye precargados los grafos A–E de la *Guía Práctica: Modelos de Red, Actividad 1*.

## Uso

- **Doble click** en el lienzo: agrega un nodo.
- **Click en un nodo y luego en otro**: crea una arista y pide el peso.
- **Doble click en una arista**: cambia el peso. **Doble click en un nodo**: cambia el nombre.
- Arrastrar para mover nodos. `Supr` borra la selección, `Enter` calcula, `←` `→` recorren los pasos.
- También se puede cargar el grafo como texto (`origen destino peso`, una arista por línea).
- "Copiar tabla" copia la tabla detalle para pegarla en Word o Excel.

## Correr localmente

No necesita instalar nada: abrir `index.html` en el navegador.

## Estructura

```
index.html            estructura de la página
css/styles.css        estilos (tema claro y oscuro)
js/algoritmos.js      Prim, Kruskal, Dijkstra, Ford-Fulkerson (funciones puras)
js/grafos-guia.js     grafos A–E de la guía + red de flujo de ejemplo
js/app.js             editor del grafo, dibujo SVG, tablas y controles
```

Los algoritmos no dependen del navegador, así que se pueden probar con Node:

```bash
node -e "const A=require('./js/algoritmos.js'); console.log(A)"
```

# ADR-0006 · Bajas de entidades por compactación estable y sprites asociados por id

- **Estado**: propuesta (change 0003-collisions-and-damage)
- **Fecha**: 2026-11-19

## Contexto
Hasta 0002 la lista de enemigos de `Run` solo crecía. En 0003 aparecen las bajas, y en 0004 y 0005 llegarán
proyectiles y gemas con muchas altas y bajas por segundo. Hay cuatro fuerzas en juego:
- La spec promete el orden de aparición en el snapshot.
- ADR-0003 prohíbe asignar por tick en el camino caliente.
- `EnemyLayer` reutiliza un pool fijo de sprites.
- Recorrer las colecciones (persecución, contacto, snapshot) debe seguir siendo trivial.

## Opciones
1. **Swap-remove**: O(1), pero rompe el orden y mueve entidades entre huecos de sprite.
2. **Marca `alive` con huecos reutilizables**: sin mover nada, pero cada recorrido salta muertos y el número de
   vivos se lleva aparte.
3. **`filter` o `splice`**: conservan el orden, pero asignan un array nuevo en cada llamada.
4. **Compactación estable en el sitio**: un pass de lectura y escritura que copia los vivos hacia delante y acorta
   con `length = w`. Es O(n), no asigna y conserva el orden. En el render, cada sprite se asocia al `id` de la
   entidad (`Map<id, hueco>` más una pila de huecos libres).

## Decisión
Opción 4. Cada colección del agregado con bajas expone un `removeDead()` privado. Se llama una sola vez por tick,
después de aplicar los daños, o de inmediato si la baja llega por una orden fuera del tick (`Run.damageEnemy` en
0003). Los adaptadores de render asocian cada sprite a un `id`, que es estable y nunca se reutiliza, y no al índice.
Una baja solo oculta y libera su hueco, sin repintar a nadie más.

## Consecuencias
- Positivas:
  - Se mantiene el orden de aparición, así que las specs y los snapshots son estables.
  - Cero asignaciones por tick y recorridos sin ramas para saltar muertos.
  - Un enemigo conserva su sprite toda su vida, lo que sirve para futuras animaciones de muerte.
- Negativas / costes:
  - Cada baja cuesta O(n), acotado por un solo pass por tick.
  - Cada baja deja como basura el objeto de la entidad.
  - El adaptador mantiene un `Map` y una pila.
- Cómo revertirla:
  - Para el dominio, sustituir `removeDead` por swap-remove, ajustar la spec (relajar el orden) y la asociación de
    sprites ya basada en `id` seguiría funcionando.
  - Si el benchmark lo exigiera, pasar a *struct of arrays* (ADR-0003).

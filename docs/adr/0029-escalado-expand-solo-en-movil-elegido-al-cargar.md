# ADR-0029 · Escalado EXPAND solo en modo móvil, elegido una vez al cargar

- **Estado**: propuesta (change 0033-mobile-web)
- **Fecha**: 2026-11-26

## Contexto
Desde ADR-0014 el lienzo usa `Scale.RESIZE` a zoom 1. En un móvil en horizontal (844 × 390 px CSS) eso enseña unas
3 veces menos mundo que a 1.280 × 720, y `RESIZE` ignora el `zoom` del `ScaleManager`. El spike `spike/mobile`
(`docs/ai-log/2026-11-26-spike-mobile.md`) probó otras dos vías:
- Escalar `#game` con `transform` no sirve: Phaser mide el padre con `getBoundingClientRect`, que ya incluye la
  transformación.
- `Scale.EXPAND` con un alto base de 640 sí sirve: da un lienzo lógico de 1.385 × 640 mostrado a 844 × 390, con
  `CameraRig`, el recorte de 0018 y la entrada táctil (reescalada por Phaser) sin tocar.

En escritorio, la suite `logic` y todo lo que se ve dependen de RESIZE a zoom 1, y la propuesta exige que no cambien.

## Opciones
1. **EXPAND solo en modo móvil**, con base `minWidth × baseHeight` de contenido, y RESIZE en escritorio. La ruta se
   elige una vez al cargar.
2. **EXPAND en todas partes**: una sola ruta, pero cambia el escritorio (vista, nitidez a dpr 1, E2E a 1.280 × 720 y
   la escala del HUD por escalones).
3. **`Scale.NONE` con tamaño lógico propio** (`setGameSize` y tamaño CSS por CSSOM): control total, pero
   reimplementa lo que Phaser ya hace, también la conversión de coordenadas del toque.
4. **Cambiar de ruta en caliente** cuando cambie `pointer: coarse`: obliga a destruir y recrear el `Phaser.Game`, con
   escenas, texturas y partida.

## Decisión
**Opción 1.**
- `resolveMobile` decide el modo una vez en `bootstrap()`:
  - `?mobile=1|0` gana;
  - sin él, `?e2e` apaga la autodetección;
  - si no, `matchMedia('(pointer: coarse)')`.
- Sin escucha de cambios: conectar un ratón, rotar o entrar en pantalla completa no cambian de ruta hasta recargar.
- En móvil, `scale = { mode: EXPAND, width: minWidth (960), height: baseHeight (640), max: maxView, snap 1 × 1 }`.
  Phaser 4.2.1 (`ScaleManager.updateScale`) da H = max(640, 960 · P_h/P_w) y W = H · P_w/P_h, recortados al tope.
  Así la vista nunca baja de 960 × 540.
- En escritorio, el objeto RESIZE de ADR-0014 sin ningún cambio.
- El HUD y las cartas usan en móvil un `uiScale` fraccionario: el mínimo que deja el texto base a `minTextPx` px CSS,
  acotado para que las cartas y el HUD quepan enteros. Los paneles DOM van a `--ui-scale` = 1. En escritorio se
  mantienen los escalones enteros.
- Las constantes móviles viven en `arena.mobile` (zod) y salen de `parseContent` junto a `maxView`. Nunca llegan a
  `RunConfig` (ADR-0015).

## Consecuencias
- Positivas:
  - Se juega en móvil con al menos tanto mundo como el mínimo de escritorio.
  - El escritorio, el núcleo, las firmas y el balance no cambian.
  - Cámara, recorte y entrada sin código nuevo.
  - Todo lo móvil está en infraestructura y composición.
- Negativas / costes:
  - Dos rutas de escalado que mantener y probar (unitario de `scaleConfig` y un E2E táctil).
  - El lienzo se ve blando a dpr > 1 (no hay tope por `devicePixelRatio`).
  - Un portátil táctil que pase a puntero `coarse` necesita recargar.
  - En pantallas muy bajas, el texto puede quedar por debajo del mínimo para que las cartas quepan.
- Cómo revertirla:
  - Quitar la rama `mobile` de `scaleConfig` y la regla de frame móvil: el modo móvil vuelve a RESIZE a zoom 1 y los
    controles táctiles siguen valiendo.
  - Para pasar a la opción 2 bastaría con usar la rama EXPAND siempre y redefinir la escala del HUD de escritorio
    (cambiaría las specs `world-camera` y `hud`).

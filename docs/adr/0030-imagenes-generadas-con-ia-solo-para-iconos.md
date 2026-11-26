# ADR-0030 · Imágenes generadas con IA solo para iconos de mejora, con procedencia vigilada

- **Estado**: propuesta (change 0034-upgrade-icons)
- **Fecha**: 2026-11-26

## Contexto
Las 15 mejoras y la curación de la tienda necesitan un icono, y Tiny Swords (Update 010) no trae objetos de
inventario: `UI/Icons` solo tiene glifos genéricos. El autor decidió generar los iconos con IA (proposal 0034).

Fuerzas:
- Hasta ahora todo el arte es CC0 de Update 010 (ADR-0012). `guard-assets` exige `version: "Update 010"` a cualquier
  gráfico versionado, y la cabecera de la nota fija pack, autor y licencia.
- El GDD mantiene en Won't los "enemigos dibujados con IA" y el bestiario solo sale del pack.
- El repositorio y el juego son públicos (GitHub Pages). Una imagen solo puede publicarse si los términos de la
  herramienta lo permiten, y esos términos cambian con el tiempo.
- El TFM pide trazabilidad del uso de IA: qué se generó, con qué herramienta y con qué prompt.
- Con el cupo de generación limitado, el juego tiene que poder cerrar el change con iconos pendientes.

## Opciones
1. **Sin IA**: recolorear piezas del pack o dibujar a mano. No hay piezas para cota, botas, escudo o bálsamo, y el
   dibujo manual queda fuera del alcance del autor.
2. **IA registrada a mano** en `files[]` con otra `version`. Rompe la regla de una sola licencia de `files[]` y la
   cabecera CC0, y sin guardarraíl nada impide que un sprite de enemigo generado con IA entre por la misma vía.
3. **Lista aparte `generated[]` en la nota de procedencia, limitada por carpeta y vigilada por `guard-assets`**,
   con el mismo patrón que `fonts[]` (ADR-0028).

## Decisión
Opción **3**:
- La IA solo se admite para los **iconos de mejora y de la curación**, y viven en `public/assets/icons/`.
  `guard-assets` rechaza:
  - un gráfico de esa carpeta sin entrada en `generated[]` o registrado en `files[]`;
  - una entrada de `generated[]` fuera de esa carpeta. Así el Won't de enemigos se cumple de forma mecánica, no solo
    por convención.
- La nota referencia este ADR en `generatedPolicy`; el guardarraíl exige que esté versionado.
- Cada entrada registra (cualquier otro campo es error):
  - `tool` (herramienta y modelo);
  - `createdOn` (fecha de calendario válida);
  - `terms` (URL de los términos sobre las salidas y fecha de lectura);
  - `prompt` completo;
  - `postProcess` (script versionado, si lo hay);
  - `sha256` y `bytes`. Commit y CI comprueban el sha y los bytes.
- Un icono entra solo si sus términos, leídos en la fecha registrada, permiten publicar la salida en un repositorio
  público. Si no, no se versiona y el juego usa la reserva de su categoría.
- Los pasos sobre la salida (quitar fondo, recortar, reescalar con vecino más cercano) se versionan como script, para
  que el PNG sea reproducible a partir de la imagen original.
- La cabecera CC0 de la nota y `files[]` no cambian. La nota pasa a tener tres listas: arte CC0 del pack, fuentes
  OFL y salidas IA.

## Consecuencias
- Positivas:
  - cada imagen IA queda trazable (herramienta, prompt, términos, huella) y lo comprueba el guardarraíl;
  - el veto a enemigos con IA tiene aplicación automática;
  - la reserva por categoría permite publicar con iconos pendientes.
- Negativas / costes:
  - el guardarraíl crece con una tercera lista;
  - los términos se registran pero su lectura es humana: el guardarraíl comprueba que existan, no qué dicen;
  - el estilo puede desentonar con Tiny Swords;
  - el post-proceso actual depende de PowerShell y `System.Drawing` (Windows).
- Cómo revertirla: borrar un icono, su entrada de `generated[]` y su clave de `icons.byId` deja esa mejora con la
  reserva. Retirar la política entera exige quitar también las 2 reservas y la sección `icons` (que es obligatoria),
  y después `generated[]` del guardarraíl.

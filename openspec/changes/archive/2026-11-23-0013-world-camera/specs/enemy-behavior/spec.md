# Spec delta · enemy-behavior

<!-- Ruta: openspec/changes/0013-world-camera/specs/enemy-behavior/spec.md
     La "arena" de esta spec es el mundo de `world-camera` (1.920 × 1.080 por defecto). -->

## MODIFIED Requirements

### Requirement: Enemigos dentro de la arena
El sistema SHALL mantener el círculo de cada enemigo entero dentro de la arena (el mundo, ver `world-camera`) en todo
momento: su centro MUST quedar en [radio, ancho − radio] × [radio, alto − radio], usando el radio del enemigo. Aplica
la misma regla que al jugador. El tamaño de la vista MUST NOT limitar a los enemigos.

#### Scenario: Enemigo más grande que el jugador junto a un borde
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.904, 540) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (1.860, 540)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (1.898, 540)

#### Scenario: Enemigo junto al borde inferior
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (960, 1.064) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (960, 1.020)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (960, 1.058)

#### Scenario: Persecución más allá del borde de la vista
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.500, 270) y un enemigo con velocidad 60 en
  (900, 270)
- **WHEN** se ejecutan 120 ticks
- **THEN** el enemigo está en (1.020, 270) con un error ≤ 0,001

#### Scenario: Partida larga
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick hay un enemigo cuyo centro quede fuera de [radio, 1.920 − radio] × [radio, 1.080 − radio]

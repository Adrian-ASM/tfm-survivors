# Spec delta · enemy-behavior

<!-- Change 0004-auto-weapons. Recibir daño de un arma no altera el comportamiento de un enemigo vivo: ni su
     velocidad ni su trayectoria. Sin knockback ni ralentización (fuera de alcance). -->

## ADDED Requirements

### Requirement: Un enemigo dañado sigue persiguiendo
El sistema SHALL mantener la persecución de un enemigo vivo tras recibir daño de cualquier arma: su velocidad y su
dirección hacia el jugador MUST ser las mismas que si no hubiera recibido daño. Recibir daño no desplaza al enemigo.

#### Scenario: Misma trayectoria con y sin daño
- **GIVEN** dos partidas idénticas con un jugador quieto en (480, 270) y un bug de vida 10 en (380, 270), en las que
  en una el bug recibe un impacto del Linter en el tick n (vida 4) y en la otra no recibe daño
- **WHEN** se ejecutan los ticks n a n + 10
- **THEN** la posición del bug es la misma en ambas partidas en cada uno de esos ticks (error ≤ 0,001)

#### Scenario: El impacto no empuja
- **GIVEN** un bug en la posición P al terminar la persecución del tick n
- **WHEN** recibe un impacto del Linter o un pulso de Tests en el paso de armas del tick n
- **THEN** en el snapshot del tick n sigue exactamente en P

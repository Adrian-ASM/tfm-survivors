# Spec delta · sheep

## REMOVED Requirements

### Requirement: Balance con las ovejas y la carne
Motivo: era el balance propio de 0023 (bot v3 sin recalibrar, 28/50) y su escenario "Contenido de combate intacto"
prohíbe cambiar `content/upgrades.json`, `content/resources.json` y `content/structures.json` respecto a `main` antes
de 0023, lo que este change hace a propósito (dos catálogos, oro por baja y más oro en casas y torres). Lo sustituyen
"Balance con la tienda y el bot v4" (`castle-shop`), que se mide con las ovejas presentes, y "Partida ganable y
perdible con el contenido por defecto" (`run-outcome`), que sigue exigiendo 0 quietos con ambos mapas. Los parámetros
de las ovejas y de la carne no cambian en este change.

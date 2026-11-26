---
name: worktree-flow
description: Crea, lista y elimina git worktrees para trabajar cada change SDD o spike en su propia carpeta y rama, permitiendo sesiones de Claude en paralelo. Úsala para worktree, rama de change, trabajo en paralelo, spike (EN worktree, branch, parallel work).
---

# Worktree flow

Un change = una rama = un worktree = una sesión de Claude. El repo principal se queda en `main` y limpio.

## Convenciones
- Carpeta hermana del repo: `../<repo>.worktrees/<id>`.
- Ramas: `change/<NNNN-nombre>` (se fusionan por PR) y `spike/<tema>` (desechables, **nunca** se fusionan).

## Crear
```bash
git fetch origin
git worktree add -b change/<id> ../<repo>.worktrees/<id> origin/main
cd ../<repo>.worktrees/<id> && npm ci   # cada worktree tiene su node_modules
```
En Windows puedes usar `scripts/worktree.ps1 new <id>`.

**Worktree ya existente** (creado por la app, aparcado o rebasado): si no tiene `node_modules`, ejecuta `npm ci`
antes del primer commit. Sin dependencias husky no está instalado, el pre-commit no corre y el formato o el lint
fallan después (0012: hizo falta un commit `style: prettier`).

Comprueba que los hooks de commit están activos: `git config --get core.hooksPath` debe apuntar a una carpeta que
exista **en este worktree** (`.husky/_`). Un worktree creado por la app puede heredar una ruta absoluta del checkout
principal que no existe, y entonces el pre-commit no se ejecuta (0011). Arréglalo con
`git config --worktree --unset core.hooksPath`.
Repítelo **cada vez que reutilices un worktree**: también puede apuntar a `.husky/_` de **otro** worktree, que
desaparece al borrarlo (0014).
Nunca escribas `git config core.hooksPath <ruta>` sin ámbito: con `extensions.worktreeConfig` va a la config
**compartida** y afecta a todos los checkouts (0033). El valor compartido es el relativo `.husky/_`.

## Trabajar
- Abre una sesión nueva de Claude Code dentro de la carpeta del worktree.
- Commits pequeños. Publica con `git push -u origin change/<id>` (requiere confirmación) y abre un PR con `gh pr create --fill` o desde la web.

## Cerrar (tras merge del PR)
```bash
git worktree remove ../<repo>.worktrees/<id>
git branch -d change/<id>
git worktree prune
```

## Antipatrones
- Dos worktrees con la misma rama (git no lo permite; no fuerces con `--force`).
- Editar `openspec/specs/` desde dos changes a la vez sin coordinarlo: el segundo en archivar debe rebasar.
- Borrar la carpeta a mano en lugar de `git worktree remove`.

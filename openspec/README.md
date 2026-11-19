# openspec/

Estructura compatible con [OpenSpec](https://github.com/Fission-AI/OpenSpec), conducida por las skills y subagentes de
Claude Code del repo (el CLI de OpenSpec es opcional; ver ADR-0005).

```text
openspec/
├── specs/                      # SPECS VIVAS: comportamiento actual del juego (fuente de verdad)
│   └── <capacidad>/spec.md
└── changes/
    ├── <NNNN-nombre>/          # change en curso (vive en su rama/worktree)
    │   ├── exploration.md      # explore   · sdd-explorer
    │   ├── proposal.md         # propose   · sdd-spec-writer   → gate humano
    │   ├── specs/<cap>/spec.md # spec delta (ADDED/MODIFIED/REMOVED)
    │   ├── design.md           # design    · sdd-architect
    │   ├── tasks.md            # tasks     · sdd-architect
    │   └── verify-report.md    # verify    · sdd-verifier (C/W/S)
    └── archive/
        └── AAAA-MM-DD-<NNNN-nombre>/   # change cerrado + retrospective.md
```

Ciclo de vida: ver `.claude/skills/sdd-workflow/SKILL.md` y `.claude/skills/sdd-archive/SKILL.md`.

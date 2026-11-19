<#
.SYNOPSIS
  Gestiona git worktrees por change SDD (Windows / PowerShell).
.EXAMPLE
  ./scripts/worktree.ps1 new 0001-walking-skeleton
  ./scripts/worktree.ps1 spike engine
  ./scripts/worktree.ps1 list
  ./scripts/worktree.ps1 remove 0001-walking-skeleton
#>
param(
  [Parameter(Mandatory)][ValidateSet('new', 'spike', 'list', 'remove')][string]$Action,
  [string]$Id
)
$ErrorActionPreference = 'Stop'

$root = (git rev-parse --show-toplevel).Trim()
$repoName = Split-Path $root -Leaf
$base = Join-Path (Split-Path $root -Parent) "$repoName.worktrees"

function Assert-Id { if (-not $Id) { throw 'Falta el id (p. ej. 0001-walking-skeleton).' } }

switch ($Action) {
  'list' { git worktree list }
  'new' {
    Assert-Id
    $path = Join-Path $base $Id
    git fetch origin
    git worktree add -b "change/$Id" $path origin/main
    Push-Location $path; npm ci; Pop-Location
    Write-Host "Worktree listo en $path. Abre ahí una sesión nueva: cd '$path'; claude"
  }
  'spike' {
    Assert-Id
    $path = Join-Path $base "spike-$Id"
    git worktree add -b "spike/$Id" $path
    Write-Host "Spike desechable en $path (rama spike/$Id; no se fusiona)."
  }
  'remove' {
    Assert-Id
    $path = Join-Path $base $Id
    git worktree remove $path
    git branch -d "change/$Id"
    git worktree prune
  }
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobBlock, listOf, stepsOf, triggerBlock, triggersOf } from './workflowText';

// Spec public-deploy, "Publicación automática tras la calidad en verde". Caracterización del
// despliegue que ya existe en ci.yml (el change no lo modifica): se lee como texto, igual que
// ci.test.ts, y cada comprobación tiene su caso en rojo sobre una variante mutada.
const CI = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);
const ON_MAIN_PUSH = ["github.event_name == 'push'", "github.ref == 'refs/heads/main'"];
const DOCS_ONLY = ['**.md', 'docs/**', 'openspec/**', '.claude/agents/**', '.claude/skills/**'];

const ifOf = (text: string, indent: number): string =>
  new RegExp(`\\n {${String(indent)}}if:\\s*([^\\n]*)`).exec(`\n${text}`)?.[1] ?? '';

/** Problemas del despliegue descrito en el texto de ci.yml (vacío si cumple la spec). */
function deployProblems(yaml: string): string[] {
  const problems: string[] = [];
  const deploy = jobBlock(yaml, 'deploy');
  if (deploy === null) return ['no hay job deploy'];
  const needs = listOf(/\n {4}needs:\s*([^\n]*)/.exec(deploy)?.[1] ?? '');
  if (!(needs.includes('quality') && needs.includes('e2e'))) problems.push('deploy.needs');
  const deployIf = ifOf(deploy, 4);
  if (!ON_MAIN_PUSH.every((c) => deployIf.includes(c))) problems.push('deploy.if');

  const upload = stepsOf(jobBlock(yaml, 'quality') ?? '').filter((s) =>
    s.includes('actions/upload-pages-artifact'),
  );
  const [step = ''] = upload;
  if (upload.length !== 1) problems.push('upload-pages-artifact');
  if (!ON_MAIN_PUSH.every((c) => ifOf(step, 8).includes(c))) problems.push('upload.if');
  if (!/\n {8}with:\s*\{\s*path:\s*dist\s*\}/.test(`\n${step}`)) problems.push('upload.path');

  const ignored = listOf(/\n {4}paths-ignore:\s*([^\n]*)/.exec(triggerBlock(yaml, 'push'))?.[1]);
  if (!DOCS_ONLY.every((p) => ignored.includes(p))) problems.push('push.paths-ignore');
  return problems;
}

const mutate = (from: string, to: string): string => {
  expect(CI).toContain(from);
  return CI.replace(from, to);
};

describe('ci.yml · despliegue a Pages (spec public-deploy, caracterización)', () => {
  it('Scenario: Push a main con código y CI en verde (deploy tras quality y e2e, solo en push a main)', () => {
    expect(deployProblems(CI)).toEqual([]);
    expect(triggersOf(CI)).toEqual(['push', 'pull_request', 'workflow_dispatch']);
  });

  it('Scenario: Push a main con e2e en rojo (rojo: deploy sin e2e en needs)', () => {
    expect(deployProblems(mutate('needs: [quality, e2e]', 'needs: [quality]'))).toEqual([
      'deploy.needs',
    ]);
  });

  it('Scenario: Pull request en verde (rojo: deploy y artefacto sin la condición de push a main)', () => {
    const deployIf = "if: github.event_name == 'push' && github.ref == 'refs/heads/main'";
    const uploadIf = "&& github.event_name == 'push' && github.ref == 'refs/heads/main'";

    expect(deployProblems(mutate(deployIf, 'if: always()'))).toEqual(['deploy.if']);
    expect(deployProblems(mutate(uploadIf, ''))).toEqual(['upload.if']);
    expect(deployProblems(mutate('with: { path: dist }', 'with: { path: . }'))).toEqual([
      'upload.path',
    ]);
  });

  it('Scenario: Push a main solo de documentación (rojo: paths-ignore sin openspec/**)', () => {
    expect(deployProblems(mutate("'openspec/**', ", ''))).toEqual(['push.paths-ignore']);
  });
});

describe('workflowText (helpers sobre el texto)', () => {
  it('triggersOf: en línea, lista y bloque', () => {
    expect(triggersOf('name: x\non: workflow_dispatch\njobs: {}\n')).toEqual(['workflow_dispatch']);
    expect(triggersOf('on: [push, pull_request]\n')).toEqual(['push', 'pull_request']);
    expect(
      triggersOf('on:\n  workflow_dispatch:\n    inputs:\n      url:\n        type: string\njobs:\n'),
    ).toEqual(['workflow_dispatch']);
  });

  it('jobBlock: solo el bloque del job pedido, o null', () => {
    const yaml = 'jobs:\n  a:\n    runs-on: x\n  b:\n    needs: a\n';

    expect(jobBlock(yaml, 'a')).toBe('  a:\n    runs-on: x\n');
    expect(jobBlock(yaml, 'b')).toBe('  b:\n    needs: a\n');
    expect(jobBlock(yaml, 'c')).toBeNull();
  });
});

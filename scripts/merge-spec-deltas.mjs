// Fusiona las specs delta de un change en las specs vivas (skill sdd-archive, paso 1).
// Uso: node scripts/merge-spec-deltas.mjs <change-id> <AAAA-MM-DD>
//
// Convención de las deltas (0024, 0025): un MODIFIED trae la descripción nueva y solo los escenarios
// que cambian o se añaden; los vivos que no cita se conservan ("Escenarios vivos sin cambios: …").
// - ADDED: añade el requisito al final de la spec viva (falla si ya existe).
// - MODIFIED: sustituye la descripción; sustituye los escenarios con el mismo nombre, conserva el
//   resto en su orden y añade al final los nuevos.
// - REMOVED: elimina el requisito entero.
// Añade la línea de historial. No aplica las notas en comentarios ("Al archivar", "se sustituye por"):
// las imprime para hacerlas a mano, junto con los escenarios añadidos, que hay que revisar por si
// sustituyen a uno vivo con otro nombre.
import fs from 'node:fs';
import path from 'node:path';

const [id, date] = process.argv.slice(2);
if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('Uso: node scripts/merge-spec-deltas.mjs <change-id> <AAAA-MM-DD>');
  process.exit(1);
}

const REQ = /^### Requirement: (.+?)\s*$/;
const SCN = /^#### Scenario: (.+?)\s*$/;
const HISTORY = /^<!-- historial/;
const deltaRoot = path.join('openspec/changes', id, 'specs');

const trimEnd = (lines) => {
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  return lines;
};

function withoutComments(lines) {
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (!inside && line.trim().startsWith('<!--')) {
      inside = !line.includes('-->');
      continue;
    }
    if (inside) {
      inside = !line.includes('-->');
      continue;
    }
    out.push(line);
  }
  return out;
}

function comments(text) {
  return [...text.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim())
    .filter((c) => !c.startsWith('historial'));
}

function blocksOf(lines, header) {
  const blocks = [];
  let current = null;
  const head = [];
  for (const line of lines) {
    const match = line.match(header);
    if (match) {
      current = { name: match[1], lines: [line] };
      blocks.push(current);
    } else (current ? current.lines : head).push(line);
  }
  blocks.forEach((b) => trimEnd(b.lines));
  return { head: trimEnd(head), blocks };
}

function deltaSections(text) {
  const raw = { ADDED: [], MODIFIED: [], REMOVED: [] };
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^## (ADDED|MODIFIED|REMOVED) Requirements/);
    if (match) section = match[1];
    else if (/^## /.test(line)) section = null;
    else if (section) raw[section].push(line);
  }
  return Object.fromEntries(
    Object.entries(raw).map(([k, lines]) => [k, blocksOf(lines, REQ).blocks]),
  );
}

function mergeRequirement(liveLines, deltaLines, label) {
  const live = blocksOf(liveLines, SCN);
  const delta = blocksOf(withoutComments(deltaLines), SCN);
  const byName = new Map(delta.blocks.map((s) => [s.name, s]));
  const out = [...delta.head];
  for (const scenario of live.blocks) {
    out.push('', ...(byName.get(scenario.name) ?? scenario).lines);
    byName.delete(scenario.name);
  }
  for (const scenario of byName.values()) {
    out.push('', ...scenario.lines);
    console.log(`  + escenario nuevo en ${label}: ${scenario.name}`);
  }
  return out;
}

for (const capability of fs.readdirSync(deltaRoot)) {
  const deltaText = fs.readFileSync(path.join(deltaRoot, capability, 'spec.md'), 'utf8');
  const delta = deltaSections(deltaText);
  const livePath = path.join('openspec/specs', capability, 'spec.md');
  if (!fs.existsSync(livePath)) {
    console.log(`! ${capability}: no hay spec viva; créala con references/living-spec.md`);
    continue;
  }
  const lines = fs.readFileSync(livePath, 'utf8').split(/\r?\n/);
  const find = (name) => lines.findIndex((l) => l.match(REQ)?.[1] === name);
  const endOf = (start) => {
    let i = start + 1;
    while (
      i < lines.length &&
      !REQ.test(lines[i]) &&
      !/^## /.test(lines[i]) &&
      !HISTORY.test(lines[i])
    )
      i++;
    while (i > start + 1 && lines[i - 1].trim() === '') i--;
    return i;
  };
  const required = (name, kind) => {
    const start = find(name);
    if (start < 0) throw new Error(`${capability}: ${kind} sin requisito vivo "${name}"`);
    return start;
  };

  for (const req of delta.MODIFIED) {
    const start = required(req.name, 'MODIFIED');
    const end = endOf(start);
    const label = `${capability}/${req.name}`;
    lines.splice(
      start,
      end - start,
      ...mergeRequirement(lines.slice(start, end), req.lines, label),
    );
  }
  for (const req of delta.REMOVED) {
    const start = required(req.name, 'REMOVED');
    const end = endOf(start);
    lines.splice(start, end - start + (lines[end]?.trim() === '' ? 1 : 0));
  }
  if (delta.ADDED.length) {
    for (const req of delta.ADDED) {
      if (find(req.name) >= 0) throw new Error(`${capability}: ADDED ya existe "${req.name}"`);
    }
    let at = lines.findIndex((l) => HISTORY.test(l));
    if (at < 0) at = lines.length;
    let from = at;
    while (from > 0 && lines[from - 1].trim() === '') from--;
    const added = delta.ADDED.flatMap((req) => ['', ...withoutComments(req.lines)]);
    lines.splice(from, at - from, ...added, '');
  }

  const text = `${lines.join('\n').replace(/\n+$/, '\n')}<!-- historial: ${id} (${date}) -->\n`;
  fs.writeFileSync(livePath, text);
  const counts = ['ADDED', 'MODIFIED', 'REMOVED'].map((k) => `${k} ${delta[k].length}`);
  console.log(`${capability}: ${counts.join(' · ')}`);
  for (const note of comments(deltaText)) console.log(`  nota: ${note}`);
}

#!/usr/bin/env node
// Guardarraíl 1/3 fuera de Claude Code: aplica las MISMAS reglas de .claude/hooks/ a cualquier autor
// (persona, Claude desde la app, otros agentes). No duplica reglas: lanza cada hook con el mismo JSON que
// envía Claude Code ({ tool_input: { file_path, content } }) y recoge el código 2 (bloqueo).
//
//   node scripts/guard-staged.mjs         → contenido PREPARADO de los ficheros del commit (pre-commit)
//   node scripts/guard-staged.mjs --all   → todos los ficheros versionados (CI)
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';

const all = process.argv.includes('--all');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const HOOKS = ['guard-secrets.mjs', 'guard-architecture.mjs'].map((h) =>
  join(root, '.claude', 'hooks', h),
);
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|ogg|wav|woff2?|ttf|otf|zip|gz|pdf)$/i;
const CODE = /\.(ts|tsx|mts|js|mjs)$/;

const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const listed = all
  ? git(['ls-files', '-z'])
  : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
const files = listed.split('\0').filter((f) => f && !BINARY.test(f));

/** Contenido que entraría en el commit (índice) o, en --all, el versionado en disco. */
const contentOf = (path) =>
  all ? readFileSync(join(root, path), 'utf8') : git(['show', `:${path}`]);

function runHook(hook, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hook], {
      cwd: root,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stderr }));
    child.stdin.end(JSON.stringify(payload));
  });
}

// El hook de arquitectura solo actúa sobre código; el de secretos, sobre todo.
const jobs = files.flatMap((path) => {
  const hooks = CODE.test(path) ? HOOKS : [HOOKS[0]];
  return hooks.map((hook) => ({ path, hook }));
});

const contents = new Map();
const failures = [];
const queue = [...jobs];
const workers = Array.from({ length: Math.max(2, cpus().length) }, async () => {
  for (let job = queue.shift(); job; job = queue.shift()) {
    if (!contents.has(job.path)) contents.set(job.path, contentOf(job.path));
    const payload = {
      tool_input: { file_path: join(root, job.path), content: contents.get(job.path) },
    };
    const { code, stderr } = await runHook(job.hook, payload);
    if (code === 2) failures.push(stderr.trim());
    else if (code !== 0)
      failures.push(`Error inesperado (${code}) en ${job.hook} con ${job.path}\n${stderr}`);
  }
});
await Promise.all(workers);

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  console.error(
    `\n✖ guard: ${failures.length} problema(s) en ${files.length} fichero(s). ` +
      'No uses --no-verify: el CI aplica las mismas reglas.',
  );
  process.exit(1);
}
console.log(
  `✔ guard: ${files.length} fichero(s) revisados${all ? ' (todo el repo)' : ' (preparados)'}.`,
);

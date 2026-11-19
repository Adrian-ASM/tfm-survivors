// Guardarraíl 2/3: reglas de capas y de pureza (AGENTS.md §3). Mismo criterio que .claude/hooks/,
// pero también en el IDE, en el pre-commit (lint-staged) y en CI. Si una regla bloquea, corrige el diseño.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ENGINE = ['phaser', 'phaser/*', 'kaplay', 'kaplay/*'];
const layer = (name) => [`**/${name}`, `**/${name}/**`];

const engineImport = {
  group: ENGINE,
  message: 'El motor solo puede importarse en src/infrastructure (AGENTS.md §3).',
};

const BROWSER = ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB'];
// globalThis/self dan acceso a todo lo anterior por otra puerta (verify-report W2).
const PURE_GLOBALS = [...BROWSER, 'globalThis', 'self'].map((name) => ({
  name,
  message: `${name} solo en src/infrastructure (AGENTS.md §3.3).`,
}));

const PURE_PROPERTIES = [
  {
    object: 'Math',
    property: 'random',
    message: 'Rompe el determinismo: usa el puerto RandomGenerator.',
  },
  { object: 'Date', property: 'now', message: 'Rompe el determinismo: usa el puerto Clock.' },
  {
    object: 'performance',
    property: 'now',
    message: 'Rompe el determinismo: usa el puerto Clock.',
  },
];

const pureCore = {
  'no-restricted-globals': ['error', ...PURE_GLOBALS],
  'no-restricted-properties': ['error', ...PURE_PROPERTIES],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'new Date() rompe el determinismo: usa el puerto Clock.',
    },
    {
      // no-restricted-imports no ve import(): sin esto, el motor o otra capa entran por la puerta de atrás.
      selector: 'ImportExpression',
      message:
        'import() dinámico prohibido en el núcleo: usa imports estáticos (AGENTS.md §3.1-3.2).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'spikes/',
      'node_modules/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly' },
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      ...pureCore,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            engineImport,
            {
              group: [...layer('application'), ...layer('infrastructure'), ...layer('composition')],
              message: 'El dominio no depende de ninguna otra capa (AGENTS.md §3.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      ...pureCore,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            engineImport,
            {
              group: [...layer('infrastructure'), ...layer('composition')],
              message: 'La aplicación solo depende del dominio (AGENTS.md §3.2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: layer('composition'),
              message:
                'Solo src/composition conoce las implementaciones concretas (AGENTS.md §3.4).',
            },
          ],
        },
      ],
    },
  },
);

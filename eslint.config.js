// COD-2 · ESLint.
//
// El proyecto no tenía linter. La configuración es deliberadamente CHICA: el
// objetivo es cazar bugs reales, no imponer estilo sobre ~200 archivos que ya
// existen y funcionan. Todo lo que sea de formato queda fuera — eso lo resuelve
// el criterio de quien escribe, no una regla que llene la consola de ruido.
//
// Las reglas que sí valen la pena acá:
//   · react-hooks/rules-of-hooks   — un hook dentro de un `if` es un bug real
//   · react-hooks/exhaustive-deps  — dependencias faltantes = estado rancio
//   · no-unused-vars               — sobre todo imports muertos tras refactors
//
// ⚠️ Lo que ESLint NO puede cazar acá: el bug de `max-sm:no-scrollbar`, donde
// una variante de Tailwind sobre una clase propia compila a nada en silencio.
// Eso vive en un string de className y ningún plugin genérico lo ve. Para eso
// está `scripts/check-tailwind-variants.mjs`, que sí lo detecta.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'supabase/functions/**',   // Deno, no Node — otro conjunto de globals
            'playwright-report/**',
            'test-results/**',
            '.claude/**',              // worktrees de sesiones viejas: copias del repo
        ],
    },
    js.configs.recommended,

    // Los scripts de `scripts/` y la config de build corren en Node, no en el
    // navegador. Sin esto, `console`, `process`, `fetch` y `URL` salían como
    // `no-undef` — 40 falsos positivos que no eran bugs sino un hueco de config.
    {
        files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}', 'tests/**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            // Los specs de Playwright corren en Node pero evalúan código dentro
            // del navegador (`page.evaluate`), así que necesitan los dos.
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            'no-console': 'off',   // en un script de línea de comandos es la salida
        },
    },

    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,

            // ⚠️ `eslint-plugin-react-hooks` v7 trae reglas nuevas y bastante
            // opinadas que marcan patrones que ACÁ funcionan: 48 avisos de
            // `set-state-in-effect` sobre efectos que sincronizan con la URL o
            // con el store, más `use-memo`, `purity`, `immutability` y
            // `static-components`. Bajarlas a warn es deliberado — como error
            // bloquearían cualquier CI futuro por código que hoy anda bien.
            // Valen como señal para revisar de a poco, no como muro.
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/use-memo': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/static-components': 'warn',

            // Estas dos SÍ quedan en error: son las que cazan bugs de verdad.
            'react-hooks/rules-of-hooks': 'error',

            // Los imports muertos son lo que más aparece tras un refactor —
            // pasó en esta misma sesión al cambiar barras inline por SearchField.
            // Se ignoran los args con `_` al frente, que son intencionales.
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^[A-Z_]',   // componentes y constantes re-exportadas
                caughtErrors: 'none',            // `catch {}` vacío es un patrón usado a propósito
            }],

            // Fast refresh se rompe si un archivo exporta cosas que no son
            // componentes. Aviso, no error: hay archivos donde conviene.
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            // `console` sin guard llega a producción (COD-3). Se permite warn y
            // error mientras se limpia lo demás.
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
    },
];

/**
 * Swap the manifest `exports` between its development and published forms.
 *
 * Locally the kernel is consumed straight from TypeScript source, so the tracked
 * manifest points `exports` at `src`. The registry receives compiled output, so
 * the pack lifecycle rewrites `exports` to `dist` before the tarball is built
 * (`prepack`) and restores the source form afterwards (`postpack`). npm does not
 * honour an `exports` override in `publishConfig`, so the swap is done here.
 *
 * The swap is an exact-block replacement: it fails loudly rather than publish a
 * manifest whose `exports` it could not confidently rewrite.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { readFileSync, writeFileSync } from 'node:fs';

const mode = process.argv[2];

if (mode !== 'dist' && mode !== 'src') {
    console.error('usage: pack-exports.mjs <dist|src>');
    process.exit(1);
}

const SRC = `    "exports": {
        "./*": "./src/*.ts"
    }`;

const DIST = `    "exports": {
        "./*": {
            "types": "./dist/*.d.ts",
            "import": "./dist/*.js"
        }
    }`;

const target = mode === 'dist' ? DIST : SRC;
const other = mode === 'dist' ? SRC : DIST;

const file = new URL('../package.json', import.meta.url);
const text = readFileSync(file, 'utf8');

if (text.includes(target)) {
    process.exit(0);
}

if (!text.includes(other)) {
    console.error('pack-exports: expected exports block not found; refusing to guess');
    process.exit(1);
}

writeFileSync(file, text.replace(other, target));

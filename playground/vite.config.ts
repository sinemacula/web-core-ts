/**
 * Vite build configuration.
 *
 * The application builds to a static, environment-agnostic artifact: no
 * environment variable is baked into the bundle at build time. Runtime
 * configuration is delivered through `runtime-env.json`, rendered at deploy
 * time by `scripts/generate-runtime-env.mjs` and uploaded alongside the
 * artifact.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(process.cwd(), 'src'),
        },
    },
    build: {
        // Pinned explicitly; Vite has shifted this default floor before.
        target: 'baseline-widely-available',
        // Off until an error reporter uploads them: even 'hidden' writes
        // readable .map files into the artifact promoted to S3.
        sourcemap: false,
    },
});

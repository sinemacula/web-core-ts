/**
 * Drift guards for the shared design tokens.
 *
 * The token stylesheet is copied into each application tree; these tests fail
 * the moment the copies diverge, or a component reaches past the role tokens
 * into a raw palette scale or semantic primitive that does not flip between
 * colour schemes. The template tree is git-excluded, so each guard is a no-op
 * where it is absent.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const THEME_CSS = ['playground/src/assets/styles/theme.css', 'template/src/assets/styles/theme.css'];

const STYLE_ROOTS = ['playground/src', 'template/src'];

// Components must consume the role tokens, which flip between colour schemes,
// never a raw palette scale or semantic primitive, which are fixed and would
// not follow a scheme change.
const RAW_COLOR_TOKEN = /--sm-(?:primary|secondary|neutral)-\d|--sm-(?:error|warning|information|success)\b/;

/**
 * Every `.vue` and `.css` file below a directory tree.
 *
 * @param dir - the directory to walk
 * @returns the matching absolute file paths
 */
function styleFiles(dir: string): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
            found.push(...styleFiles(path));
        } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.css')) {
            found.push(path);
        }
    }

    return found;
}

describe('design-token drift guards', () => {
    it('keeps every theme.css copy byte-identical', () => {
        const contents = THEME_CSS.map(path => join(ROOT, path))
            .filter(path => existsSync(path))
            .map(path => readFileSync(path, 'utf8'));

        expect(new Set(contents).size, 'theme.css copies have drifted').toBeLessThanOrEqual(1);
    });

    it('never references a raw colour token outside theme.css', () => {
        const themeCss = new Set(THEME_CSS.map(path => join(ROOT, path)));
        const offenders: string[] = [];

        for (const styleRoot of STYLE_ROOTS) {
            const dir = join(ROOT, styleRoot);

            if (!existsSync(dir)) {
                continue;
            }

            for (const file of styleFiles(dir)) {
                if (!themeCss.has(file) && RAW_COLOR_TOKEN.test(readFileSync(file, 'utf8'))) {
                    offenders.push(file);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});

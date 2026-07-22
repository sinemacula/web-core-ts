/**
 * Browser colour-scheme applier.
 *
 * Stamps `[data-theme]` for an explicit choice (removing it for `system`, which
 * defers to the pure-CSS `prefers-color-scheme` path) and syncs the
 * `theme-color` meta tag to the resolved surface colour.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ColorSchemeApplier } from '@sinemacula/foundation/theme/color-scheme-service';
import type { ColorSchemePreference, ResolvedColorScheme } from '@sinemacula/foundation/theme/color-scheme';

const DEFAULT_THEME_COLORS = { light: '#f8fafc', dark: '#0f172a' } as const;

/**
 * A resolved surface-page colour per scheme, for the `theme-color` meta tag.
 */
export interface ThemeColors {
    /** The colour applied in the light scheme. */
    readonly light: string;

    /** The colour applied in the dark scheme. */
    readonly dark: string;
}

/**
 * Construction options for {@link DomColorSchemeApplier}.
 */
export interface DomColorSchemeApplierOptions {
    /** The document whose root and head receive the applied scheme. */
    readonly targetDocument?: Document;

    /** The surface-page colours applied to the `theme-color` meta tag. */
    readonly themeColors?: ThemeColors;
}

/**
 * A {@link ColorSchemeApplier} that stamps the DOM and the theme-color meta.
 */
export class DomColorSchemeApplier implements ColorSchemeApplier {
    /** The document whose root and head receive the applied scheme. */
    readonly #document: Document;

    /** The surface-page colours for the `theme-color` meta tag. */
    readonly #themeColors: ThemeColors;

    constructor(options: DomColorSchemeApplierOptions = {}) {
        this.#document = options.targetDocument ?? globalThis.document;
        this.#themeColors = options.themeColors ?? DEFAULT_THEME_COLORS;
    }

    /**
     * Stamp or clear `[data-theme]`, then sync the meta tag.
     *
     * @param resolved - the concrete scheme to apply
     * @param preference - the raw preference behind it
     */
    apply(resolved: ResolvedColorScheme, preference: ColorSchemePreference): void {
        if (preference === 'system') {
            this.#document.documentElement.removeAttribute('data-theme');
        } else {
            this.#document.documentElement.setAttribute('data-theme', resolved);
        }

        this.#syncMeta(resolved);
    }

    /**
     * Point the `theme-color` meta tag at the resolved surface colour.
     *
     * @param resolved - the concrete scheme whose colour to apply
     */
    #syncMeta(resolved: ResolvedColorScheme): void {
        let meta = this.#document.querySelector('meta[name="theme-color"]');

        if (meta === null) {
            meta = this.#document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            this.#document.head.appendChild(meta);
        }

        meta.setAttribute('content', this.#themeColors[resolved]);
    }
}

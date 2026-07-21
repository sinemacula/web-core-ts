/**
 * Colour-scheme detection, persistence and DOM application.
 *
 * A stateful web adapter that resolves the active scheme from a stored
 * preference (or the OS when `system`), stamps `[data-theme]` and the
 * `theme-color` meta tag, and tracks OS changes while the preference is
 * `system`. Explicit choices ignore the OS.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { KeyValueStorage } from '../storage/key-value-storage';
import {
    COLOR_SCHEME_STORAGE_KEY,
    type ColorSchemePreference,
    type ResolvedColorScheme,
} from './color-scheme';

const DEFAULT_PREFERENCE: ColorSchemePreference = 'system';

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
 * A listener notified when the resolved scheme changes.
 */
export type ColorSchemeListener = (resolved: ResolvedColorScheme, preference: ColorSchemePreference) => void;

/**
 * Construction options for {@link ColorSchemeService}.
 */
export interface ColorSchemeServiceOptions {
    /** Backing store for the persisted preference. */
    readonly storage: KeyValueStorage;

    /** The storage key for the persisted preference. Defaults to `theme`. */
    readonly storageKey?: string;

    /** The preference used when nothing is stored. Defaults to `system`. */
    readonly defaultPreference?: ColorSchemePreference;

    /** The window whose `matchMedia` sources the OS scheme. */
    readonly targetWindow?: Window;

    /** The document whose root and head receive the applied scheme. */
    readonly targetDocument?: Document;

    /** The surface-page colours applied to the `theme-color` meta tag. */
    readonly themeColors?: ThemeColors;
}

/**
 * Detects, persists and applies the active colour scheme.
 */
export class ColorSchemeService {
    /** Backing store for the persisted preference. */
    readonly #storage: KeyValueStorage;

    /** The resolved storage key for the persisted preference. */
    readonly #storageKey: string;

    /** The preference used when nothing is stored. */
    readonly #defaultPreference: ColorSchemePreference;

    /** The document whose root and head receive the applied scheme. */
    readonly #document: Document;

    /** The surface-page colours for the `theme-color` meta tag. */
    readonly #themeColors: ThemeColors;

    /** The OS dark-scheme media query. */
    readonly #query: MediaQueryList;

    /** The bound OS-change handler. */
    readonly #onOsChange: () => void;

    /** The registered resolved-scheme listeners. */
    readonly #listeners = new Set<ColorSchemeListener>();

    /** The current raw preference. */
    #preference: ColorSchemePreference;

    /** The current resolved scheme. */
    #resolved: ResolvedColorScheme;

    /** Whether {@link start} has run. */
    #started = false;

    constructor(options: ColorSchemeServiceOptions) {
        const targetWindow = options.targetWindow ?? globalThis.window;

        this.#storage = options.storage;
        this.#storageKey = options.storageKey ?? COLOR_SCHEME_STORAGE_KEY;
        this.#defaultPreference = options.defaultPreference ?? DEFAULT_PREFERENCE;
        this.#document = options.targetDocument ?? globalThis.document;
        this.#themeColors = options.themeColors ?? DEFAULT_THEME_COLORS;
        this.#query = targetWindow.matchMedia('(prefers-color-scheme: dark)');
        this.#onOsChange = () => {
            this.#handleOsChange();
        };
        this.#preference = this.#readPreference();
        this.#resolved = this.#derive();
    }

    /**
     * The current raw preference.
     */
    preference(): ColorSchemePreference {
        return this.#preference;
    }

    /**
     * The current resolved scheme.
     */
    resolved(): ResolvedColorScheme {
        return this.#resolved;
    }

    /**
     * Apply the resolved scheme and begin tracking OS changes.
     */
    start(): void {
        if (this.#started) {
            return;
        }

        this.#started = true;
        this.#resolved = this.#derive();
        this.#stamp();
        this.#query.addEventListener('change', this.#onOsChange);
    }

    /**
     * Set the user's preference, persisting or clearing it.
     *
     * @param pref - the new preference
     */
    setPreference(pref: ColorSchemePreference): void {
        this.#preference = pref;

        if (pref === 'system') {
            this.#storage.remove(this.#storageKey);
        } else {
            this.#storage.set(this.#storageKey, pref);
        }

        this.#resolved = this.#derive();
        this.#stamp();
        this.#notify();
    }

    /**
     * Subscribe to resolved-scheme changes.
     *
     * @param listener - the listener to notify
     * @returns an unsubscribe function
     */
    subscribe(listener: ColorSchemeListener): () => void {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    }

    /**
     * Stop tracking OS changes.
     */
    dispose(): void {
        this.#query.removeEventListener('change', this.#onOsChange);
    }

    /**
     * Read the stored preference, falling back to the default.
     *
     * @returns the stored preference, or the default when absent or invalid
     */
    #readPreference(): ColorSchemePreference {
        const stored = this.#storage.get(this.#storageKey);

        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }

        return this.#defaultPreference;
    }

    /**
     * Resolve the preference against the OS scheme.
     *
     * @returns the concrete scheme to apply
     */
    #derive(): ResolvedColorScheme {
        if (this.#preference !== 'system') {
            return this.#preference;
        }

        return this.#query.matches ? 'dark' : 'light';
    }

    /**
     * Stamp or clear `[data-theme]`, then sync the meta tag.
     */
    #stamp(): void {
        if (this.#preference === 'system') {
            this.#document.documentElement.removeAttribute('data-theme');
        } else {
            this.#document.documentElement.setAttribute('data-theme', this.#resolved);
        }

        this.#syncMeta();
    }

    /**
     * Point the `theme-color` meta tag at the resolved surface colour.
     */
    #syncMeta(): void {
        let meta = this.#document.querySelector('meta[name="theme-color"]');

        if (meta === null) {
            meta = this.#document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            this.#document.head.appendChild(meta);
        }

        meta.setAttribute('content', this.#themeColors[this.#resolved]);
    }

    /**
     * Notify every registered listener of the current scheme.
     */
    #notify(): void {
        for (const listener of this.#listeners) {
            listener(this.#resolved, this.#preference);
        }
    }

    /**
     * Re-resolve and re-apply when the OS scheme changes under `system`.
     */
    #handleOsChange(): void {
        if (this.#preference !== 'system') {
            return;
        }

        this.#resolved = this.#derive();
        this.#stamp();
        this.#notify();
    }
}

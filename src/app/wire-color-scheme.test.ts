/**
 * Unit tests for wire-color-scheme.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import { colorScheme, resetWebCoreServices } from './services';
import type { ColorSchemeWiringConfig, WireColorSchemeOptions } from './wire-color-scheme';
import { wireColorScheme } from './wire-color-scheme';

interface FakeMql {
    matches: boolean;
    addCount: number;
    removeCount: number;
    addEventListener(event: string, cb: () => void): void;
    removeEventListener(event: string, cb: () => void): void;
}

function makeMql(matches: boolean): FakeMql {
    return {
        matches,
        addCount: 0,
        removeCount: 0,
        addEventListener() {
            this.addCount += 1;
        },
        removeEventListener() {
            this.removeCount += 1;
        },
    };
}

function windowOf(mql: FakeMql): Window {
    return { matchMedia: () => mql } as unknown as Window;
}

const config: ColorSchemeWiringConfig = {
    colorScheme: { default: 'system' },
};

function baseOptions(overrides: Partial<WireColorSchemeOptions> = {}): WireColorSchemeOptions {
    return {
        config,
        storage: new MemoryStorage(),
        targetWindow: windowOf(makeMql(false)),
        targetDocument: document.implementation.createHTMLDocument('t'),
        ...overrides,
    };
}

function dataTheme(doc: Document): string | null {
    return doc.documentElement.getAttribute('data-theme');
}

function metaColor(doc: Document): string | null {
    return doc.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('wireColorScheme', () => {
    afterEach(() => {
        resetWebCoreServices();
        document.documentElement.removeAttribute('data-theme');
        document.querySelector('meta[name="theme-color"]')?.remove();
    });

    it('stamps an explicit stored preference on the target document', () => {
        const storage = new MemoryStorage();

        storage.set('theme', 'dark');

        const targetDocument = document.implementation.createHTMLDocument('t');
        const service = wireColorScheme(baseOptions({ storage, targetDocument }));

        expect(service.preference()).toBe('dark');
        expect(service.resolved()).toBe('dark');
        expect(dataTheme(targetDocument)).toBe('dark');
    });

    it('leaves the data-theme attribute unset under the system preference', () => {
        const targetDocument = document.implementation.createHTMLDocument('t');

        wireColorScheme(baseOptions({ targetDocument }));

        expect(dataTheme(targetDocument)).toBeNull();
        expect(metaColor(targetDocument)).toBe('#f8fafc');
    });

    it('resolves the system preference to dark when the OS prefers dark', () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const service = wireColorScheme(
            baseOptions({ targetWindow: windowOf(makeMql(true)), targetDocument }),
        );

        expect(service.resolved()).toBe('dark');
        expect(dataTheme(targetDocument)).toBeNull();
        expect(metaColor(targetDocument)).toBe('#0f172a');
    });

    it('applies the configured default preference when nothing is stored', () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const service = wireColorScheme(
            baseOptions({ config: { colorScheme: { default: 'dark' } }, targetDocument }),
        );

        expect(service.preference()).toBe('dark');
        expect(dataTheme(targetDocument)).toBe('dark');
    });

    it('reads the stored preference from the configured storage key, not the default', () => {
        const storage = new MemoryStorage();

        storage.set('theme', 'dark');
        storage.set('app.theme', 'light');

        const service = wireColorScheme(baseOptions({ storage, colorSchemeStorageKey: 'app.theme' }));

        expect(service.preference()).toBe('light');
    });

    it('applies the provided theme colours to the meta tag', () => {
        const targetDocument = document.implementation.createHTMLDocument('t');

        wireColorScheme(baseOptions({ themeColors: { light: '#ffffff', dark: '#000000' }, targetDocument }));

        expect(metaColor(targetDocument)).toBe('#ffffff');
    });

    it('falls back to the global document when no target document is given', () => {
        const storage = new MemoryStorage();

        storage.set('theme', 'dark');

        wireColorScheme({ config, storage, targetWindow: windowOf(makeMql(false)) });

        expect(dataTheme(document)).toBe('dark');
    });

    it('begins tracking OS changes when it starts', () => {
        const mql = makeMql(false);

        wireColorScheme(baseOptions({ targetWindow: windowOf(mql) }));

        expect(mql.addCount).toBe(1);
    });

    it('installs the returned service as the colour-scheme singleton', () => {
        const service = wireColorScheme(baseOptions());

        expect(colorScheme()).toBe(service);
    });

    it('stops tracking OS changes on dispose', () => {
        const mql = makeMql(false);
        const service = wireColorScheme(baseOptions({ targetWindow: windowOf(mql) }));

        service.dispose();

        expect(mql.removeCount).toBe(1);
    });
});

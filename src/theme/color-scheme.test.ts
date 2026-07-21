/**
 * Unit tests for color-scheme.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { COLOR_SCHEME_BOOT_SCRIPT, COLOR_SCHEME_STORAGE_KEY, composeColorSchemeStorageKey } from './color-scheme';

function runBootScript(stored: string | null, throwOnRead = false): string | null {
    let applied: string | null = null;

    const localStorage = {
        getItem(key: string): string | null {
            if (throwOnRead) {
                throw new Error('storage unavailable');
            }

            return key === 'theme' ? stored : null;
        },
    };

    const documentStub = {
        documentElement: {
            setAttribute(name: string, value: string): void {
                if (name === 'data-theme') {
                    applied = value;
                }
            },
        },
    };

    const boot = new Function('localStorage', 'document', COLOR_SCHEME_BOOT_SCRIPT);

    boot(localStorage, documentStub);

    return applied;
}

describe('color-scheme', () => {
    describe('COLOR_SCHEME_STORAGE_KEY', () => {
        it('is theme', () => {
            expect(COLOR_SCHEME_STORAGE_KEY).toBe('theme');
        });
    });

    describe('composeColorSchemeStorageKey', () => {
        it('prefixes the key with the namespace when given one', () => {
            expect(composeColorSchemeStorageKey('app')).toBe('app.theme');
        });

        it('prefixes a custom key with the namespace', () => {
            expect(composeColorSchemeStorageKey('app', 'scheme')).toBe('app.scheme');
        });

        it('returns the bare key when the namespace is null', () => {
            expect(composeColorSchemeStorageKey(null)).toBe('theme');
        });

        it('returns a custom bare key when the namespace is null', () => {
            expect(composeColorSchemeStorageKey(null, 'scheme')).toBe('scheme');
        });
    });

    describe('COLOR_SCHEME_BOOT_SCRIPT', () => {
        it('is the exact self-contained boot string for the theme key', () => {
            expect(COLOR_SCHEME_BOOT_SCRIPT).toBe(
                "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}",
            );
        });

        it('stamps data-theme for a stored dark preference', () => {
            expect(runBootScript('dark')).toBe('dark');
        });

        it('stamps data-theme for a stored light preference', () => {
            expect(runBootScript('light')).toBe('light');
        });

        it('does not stamp for a stored system preference', () => {
            expect(runBootScript('system')).toBeNull();
        });

        it('does not stamp when nothing is stored', () => {
            expect(runBootScript(null)).toBeNull();
        });

        it('does not stamp for a garbage stored value', () => {
            expect(runBootScript('purple')).toBeNull();
        });

        it('swallows a throwing storage read', () => {
            expect(runBootScript('dark', true)).toBeNull();
        });
    });
});

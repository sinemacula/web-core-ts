/**
 * Unit tests for color-scheme-service.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { ColorSchemePreference } from '@sinemacula/foundation/theme/color-scheme';
import { ColorSchemeService, type ThemeColors } from './color-scheme-service';

interface FakeMql {
    matches: boolean;
    query: string;
    addCount: number;
    removeCount: number;
    addEvents: string[];
    removeEvents: string[];
    addEventListener(event: string, cb: () => void): void;
    removeEventListener(event: string, cb: () => void): void;
    fireChange(): void;
}

function makeMql(matches: boolean): FakeMql {
    let handler: (() => void) | null = null;

    const mql: FakeMql = {
        matches,
        query: '',
        addCount: 0,
        removeCount: 0,
        addEvents: [],
        removeEvents: [],
        addEventListener(event, cb) {
            mql.addCount += 1;
            mql.addEvents.push(event);
            handler = cb;
        },
        removeEventListener(event, _cb) {
            mql.removeCount += 1;
            mql.removeEvents.push(event);
            handler = null;
        },
        fireChange() {
            handler?.();
        },
    };

    return mql;
}

function makeService(options?: {
    matches?: boolean;
    initialStored?: string;
    storageKey?: string;
    defaultPreference?: ColorSchemePreference;
    themeColors?: ThemeColors;
}): { service: ColorSchemeService; storage: MemoryStorage; mql: FakeMql; targetDocument: Document } {
    const storage = new MemoryStorage();

    if (options?.initialStored !== undefined) {
        storage.set(options.storageKey ?? 'theme', options.initialStored);
    }

    const mql = makeMql(options?.matches ?? false);
    const targetDocument = document.implementation.createHTMLDocument('t');
    const targetWindow = {
        matchMedia: (query: string) => {
            mql.query = query;

            return mql;
        },
    } as unknown as Window;

    const service = new ColorSchemeService({
        storage,
        targetWindow,
        targetDocument,
        ...(options?.storageKey !== undefined ? { storageKey: options.storageKey } : {}),
        ...(options?.defaultPreference !== undefined ? { defaultPreference: options.defaultPreference } : {}),
        ...(options?.themeColors !== undefined ? { themeColors: options.themeColors } : {}),
    });

    return { service, storage, mql, targetDocument };
}

function dataTheme(doc: Document): string | null {
    return doc.documentElement.getAttribute('data-theme');
}

function metaColor(doc: Document): string | null {
    return doc.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('ColorSchemeService', () => {
    describe('preference', () => {
        it('defaults to system when storage is empty', () => {
            const { service } = makeService();

            expect(service.preference()).toBe('system');
        });

        it('returns a stored light preference verbatim', () => {
            const { service } = makeService({ initialStored: 'light' });

            expect(service.preference()).toBe('light');
        });

        it('returns a stored dark preference verbatim', () => {
            const { service } = makeService({ initialStored: 'dark' });

            expect(service.preference()).toBe('dark');
        });

        it('returns a stored system preference verbatim', () => {
            const { service } = makeService({ initialStored: 'system' });

            expect(service.preference()).toBe('system');
        });

        it('returns a stored system preference verbatim over a differing default', () => {
            const { service } = makeService({ initialStored: 'system', defaultPreference: 'light' });

            expect(service.preference()).toBe('system');
        });

        it('falls back to the default when the stored value is garbage', () => {
            const { service } = makeService({ initialStored: 'purple' });

            expect(service.preference()).toBe('system');
        });

        it('honours a custom default preference', () => {
            const { service } = makeService({ defaultPreference: 'dark' });

            expect(service.preference()).toBe('dark');
        });
    });

    describe('resolved', () => {
        it('resolves system to dark under a dark OS', () => {
            const { service } = makeService({ matches: true });

            expect(service.resolved()).toBe('dark');
        });

        it('resolves system to light under a light OS', () => {
            const { service } = makeService({ matches: false });

            expect(service.resolved()).toBe('light');
        });

        it('keeps an explicit light choice under a dark OS', () => {
            const { service } = makeService({ initialStored: 'light', matches: true });

            expect(service.resolved()).toBe('light');
        });

        it('keeps an explicit dark choice under a light OS', () => {
            const { service } = makeService({ initialStored: 'dark', matches: false });

            expect(service.resolved()).toBe('dark');
        });
    });

    describe('media query', () => {
        it('queries the OS dark-scheme media feature', () => {
            const { mql } = makeService();

            expect(mql.query).toBe('(prefers-color-scheme: dark)');
        });
    });

    describe('start', () => {
        it('stamps the attribute and meta for an explicit dark choice', () => {
            const { service, targetDocument } = makeService({ initialStored: 'dark', matches: false });

            service.start();

            expect(dataTheme(targetDocument)).toBe('dark');
            expect(metaColor(targetDocument)).toBe('#0f172a');
        });

        it('leaves no attribute for system while still setting the OS-resolved meta', () => {
            const { service, targetDocument } = makeService({ matches: true });

            service.start();

            expect(targetDocument.documentElement.hasAttribute('data-theme')).toBe(false);
            expect(metaColor(targetDocument)).toBe('#0f172a');
        });

        it('recomputes the resolved scheme from the OS at start time', () => {
            const { service, mql, targetDocument } = makeService({ matches: false });

            mql.matches = true;
            service.start();

            expect(service.resolved()).toBe('dark');
            expect(metaColor(targetDocument)).toBe('#0f172a');
        });

        it('attaches the OS listener exactly once when called twice', () => {
            const { service, mql } = makeService();

            service.start();
            service.start();

            expect(mql.addCount).toBe(1);
            expect(mql.addEvents).toEqual(['change']);
        });
    });

    describe('setPreference', () => {
        it('persists an explicit light choice, stamps it and notifies', () => {
            const { service, storage, targetDocument } = makeService({ matches: true });
            const listener = vi.fn();

            service.start();
            service.subscribe(listener);
            service.setPreference('light');

            expect(storage.get('theme')).toBe('light');
            expect(dataTheme(targetDocument)).toBe('light');
            expect(metaColor(targetDocument)).toBe('#f8fafc');
            expect(listener).toHaveBeenCalledWith('light', 'light');
        });

        it('removes the stored key and the attribute when set to system', () => {
            const { service, storage, targetDocument } = makeService({ initialStored: 'dark', matches: false });
            const listener = vi.fn();

            service.start();
            service.subscribe(listener);
            service.setPreference('system');

            expect(storage.get('theme')).toBeNull();
            expect(targetDocument.documentElement.hasAttribute('data-theme')).toBe(false);
            expect(listener).toHaveBeenCalledWith('light', 'system');
        });

        it('writes under a custom storage key', () => {
            const { service, storage } = makeService({ storageKey: 'ns.theme' });

            service.setPreference('dark');

            expect(storage.get('ns.theme')).toBe('dark');
            expect(storage.get('theme')).toBeNull();
        });

        it('reads back an explicit choice from a custom storage key', () => {
            const { service } = makeService({ storageKey: 'ns.theme', initialStored: 'dark' });

            expect(service.preference()).toBe('dark');
        });
    });

    describe('OS changes', () => {
        it('re-derives, updates the meta and notifies while on system', () => {
            const { service, mql, targetDocument } = makeService({ matches: false });
            const listener = vi.fn();

            service.start();
            service.subscribe(listener);
            mql.matches = true;
            mql.fireChange();

            expect(service.resolved()).toBe('dark');
            expect(metaColor(targetDocument)).toBe('#0f172a');
            expect(listener).toHaveBeenCalledWith('dark', 'system');
        });

        it('ignores OS changes while an explicit choice is active', () => {
            const { service, mql, targetDocument } = makeService({ initialStored: 'light', matches: false });
            const listener = vi.fn();

            service.start();
            service.subscribe(listener);
            mql.matches = true;
            mql.fireChange();

            expect(service.resolved()).toBe('light');
            expect(dataTheme(targetDocument)).toBe('light');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('detaches the OS listener so later changes are ignored', () => {
            const { service, mql } = makeService({ matches: false });
            const listener = vi.fn();

            service.start();
            service.subscribe(listener);
            service.dispose();
            mql.matches = true;
            mql.fireChange();

            expect(mql.removeCount).toBe(1);
            expect(mql.removeEvents).toEqual(['change']);
            expect(service.resolved()).toBe('light');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('subscribe', () => {
        it('returns an unsubscribe that stops later notifications', () => {
            const { service } = makeService({ matches: false });
            const listener = vi.fn();

            const unsubscribe = service.subscribe(listener);

            unsubscribe();
            service.setPreference('dark');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('meta sync', () => {
        it('creates and appends the meta tag when absent', () => {
            const { service, targetDocument } = makeService({ initialStored: 'dark', matches: false });

            service.start();

            const metas = targetDocument.head.querySelectorAll('meta[name="theme-color"]');

            expect(metas).toHaveLength(1);
            expect(metas[0]?.getAttribute('content')).toBe('#0f172a');
        });

        it('updates the existing meta tag in place', () => {
            const storage = new MemoryStorage();

            storage.set('theme', 'dark');

            const targetDocument = document.implementation.createHTMLDocument('t');
            const existing = targetDocument.createElement('meta');

            existing.setAttribute('name', 'theme-color');
            existing.setAttribute('content', '#000000');
            targetDocument.head.appendChild(existing);

            const mql = makeMql(false);
            const targetWindow = { matchMedia: () => mql } as unknown as Window;

            const service = new ColorSchemeService({ storage, targetWindow, targetDocument });

            service.start();

            const metas = targetDocument.head.querySelectorAll('meta[name="theme-color"]');

            expect(metas).toHaveLength(1);
            expect(metas[0]).toBe(existing);
            expect(existing.getAttribute('content')).toBe('#0f172a');
        });
    });

    describe('defaults', () => {
        it('falls back to the ambient window and document when none are given', () => {
            const storage = new MemoryStorage();

            storage.set('theme', 'dark');

            const service = new ColorSchemeService({ storage });

            service.start();

            expect(service.preference()).toBe('dark');
            expect(service.resolved()).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            service.dispose();
            document.documentElement.removeAttribute('data-theme');
        });
    });

    describe('theme colors', () => {
        it('uses the default surface colours when none are given', () => {
            const light = makeService({ initialStored: 'light', matches: false });

            light.service.start();

            expect(metaColor(light.targetDocument)).toBe('#f8fafc');

            const dark = makeService({ initialStored: 'dark', matches: false });

            dark.service.start();

            expect(metaColor(dark.targetDocument)).toBe('#0f172a');
        });

        it('honours custom surface colours', () => {
            const { service, targetDocument } = makeService({
                initialStored: 'dark',
                matches: false,
                themeColors: { light: '#ffffff', dark: '#111111' },
            });

            service.start();

            expect(metaColor(targetDocument)).toBe('#111111');
        });
    });
});

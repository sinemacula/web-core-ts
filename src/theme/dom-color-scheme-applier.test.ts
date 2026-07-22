/**
 * Unit tests for dom-color-scheme-applier.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import { DomColorSchemeApplier } from './dom-color-scheme-applier';

function makeDoc(): Document {
    return document.implementation.createHTMLDocument('t');
}

function dataTheme(doc: Document): string | null {
    return doc.documentElement.getAttribute('data-theme');
}

function metaColor(doc: Document): string | null {
    return doc.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('DomColorSchemeApplier', () => {
    it('stamps data-theme for an explicit choice', () => {
        const doc = makeDoc();

        new DomColorSchemeApplier({ targetDocument: doc }).apply('dark', 'dark');

        expect(dataTheme(doc)).toBe('dark');
        expect(metaColor(doc)).toBe('#0f172a');
    });

    it('removes data-theme under system', () => {
        const doc = makeDoc();

        doc.documentElement.setAttribute('data-theme', 'dark');
        new DomColorSchemeApplier({ targetDocument: doc }).apply('light', 'system');

        expect(doc.documentElement.hasAttribute('data-theme')).toBe(false);
        expect(metaColor(doc)).toBe('#f8fafc');
    });

    it('creates and appends the meta tag when absent', () => {
        const doc = makeDoc();

        new DomColorSchemeApplier({ targetDocument: doc }).apply('dark', 'dark');

        const metas = doc.head.querySelectorAll('meta[name="theme-color"]');

        expect(metas).toHaveLength(1);
        expect(metas[0]?.getAttribute('content')).toBe('#0f172a');
    });

    it('updates the existing meta tag in place', () => {
        const doc = makeDoc();
        const existing = doc.createElement('meta');

        existing.setAttribute('name', 'theme-color');
        existing.setAttribute('content', '#000000');
        doc.head.appendChild(existing);

        new DomColorSchemeApplier({ targetDocument: doc }).apply('dark', 'dark');

        const metas = doc.head.querySelectorAll('meta[name="theme-color"]');

        expect(metas).toHaveLength(1);
        expect(metas[0]).toBe(existing);
        expect(existing.getAttribute('content')).toBe('#0f172a');
    });

    it('uses the default surface colours when none are given', () => {
        const doc = makeDoc();
        const applier = new DomColorSchemeApplier({ targetDocument: doc });

        applier.apply('light', 'light');
        expect(metaColor(doc)).toBe('#f8fafc');

        applier.apply('dark', 'dark');
        expect(metaColor(doc)).toBe('#0f172a');
    });

    it('honours custom surface colours', () => {
        const doc = makeDoc();

        new DomColorSchemeApplier({ targetDocument: doc, themeColors: { light: '#ffffff', dark: '#111111' } }).apply(
            'dark',
            'dark',
        );

        expect(metaColor(doc)).toBe('#111111');
    });

    describe('ambient document', () => {
        afterEach(() => {
            document.documentElement.removeAttribute('data-theme');
        });

        it('falls back to the ambient document when none is given', () => {
            new DomColorSchemeApplier().apply('dark', 'dark');

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });
    });
});

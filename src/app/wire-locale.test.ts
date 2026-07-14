/**
 * Unit tests for wire-locale.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LocaleMessageLoader, ModuleDefinition } from '../module/module';
import { MemoryStorage } from '../storage/memory-storage';
import { localeSwitcher, resetWebCoreServices } from './services';
import type { LocaleWiringConfig, WireLocaleOptions } from './wire-locale';
import { wireLocale } from './wire-locale';

const config: LocaleWiringConfig = {
    locales: {
        default: 'en-US',
        enabled: ['en-US', 'fr-FR', 'ar-SA'],
        supported: {
            'ar-SA': { direction: 'rtl' },
            'en-US': { direction: 'ltr' },
            'fr-FR': { direction: 'ltr' },
        },
    },
};

function moduleWithLocales(name: string, loader: LocaleMessageLoader): ModuleDefinition {
    return { name, routes: [], locales: loader };
}

function baseOptions(overrides: Partial<WireLocaleOptions> = {}): WireLocaleOptions {
    return {
        config,
        modules: [],
        storage: new MemoryStorage(),
        localeCandidates: ['en-US'],
        targetDocument: document.implementation.createHTMLDocument('t'),
        ...overrides,
    };
}

describe('wireLocale', () => {
    afterEach(() => {
        resetWebCoreServices();
        document.documentElement.removeAttribute('lang');
        document.documentElement.removeAttribute('dir');
    });

    it('activates the first enabled candidate locale', async () => {
        const { i18n } = await wireLocale(baseOptions({ localeCandidates: ['fr-FR'] }));

        expect(i18n.global.locale.value).toBe('fr-FR');
    });

    it('prefers the stored locale over the candidates', async () => {
        const storage = new MemoryStorage();

        storage.set('locale', 'ar-SA');

        const { i18n } = await wireLocale(baseOptions({ storage, localeCandidates: ['fr-FR'] }));

        expect(i18n.global.locale.value).toBe('ar-SA');
    });

    it('falls back to the configured default when nothing matches', async () => {
        const { i18n } = await wireLocale(baseOptions({ localeCandidates: ['de-DE'] }));

        expect(i18n.global.locale.value).toBe('en-US');
    });

    it('reads the stored preference from the configured storage key, not the default', async () => {
        const storage = new MemoryStorage();

        storage.set('locale', 'ar-SA');
        storage.set('lang', 'fr-FR');

        const { i18n } = await wireLocale(baseOptions({ storage, localeStorageKey: 'lang' }));

        expect(i18n.global.locale.value).toBe('fr-FR');
    });

    it('sets lang and dir attributes on the target document', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');

        await wireLocale(baseOptions({ targetDocument, localeCandidates: ['ar-SA'] }));

        expect(targetDocument.documentElement.getAttribute('lang')).toBe('ar-SA');
        expect(targetDocument.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('defaults the direction to ltr when the locale is absent from the supported map', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const narrow: LocaleWiringConfig = {
            locales: { default: 'en-US', enabled: ['en-US'], supported: {} },
        };

        await wireLocale(baseOptions({ config: narrow, targetDocument }));

        expect(targetDocument.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('falls back to the global document when no target document is given', async () => {
        await wireLocale({
            config,
            modules: [],
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
        });

        expect(document.documentElement.getAttribute('lang')).toBe('en-US');
    });

    it('installs the provided formats on the i18n instance', async () => {
        const { i18n } = await wireLocale(
            baseOptions({ formats: { number: { 'en-US': { decimal: { style: 'decimal' } } } } }),
        );

        expect(i18n.global.getNumberFormat('en-US')).toEqual({ decimal: { style: 'decimal' } });
    });

    it('installs shared and namespaced module messages for the active locale', async () => {
        const { i18n } = await wireLocale(
            baseOptions({
                modules: [moduleWithLocales('dash', async () => ({ home: 'Dashboard' }))],
                sharedLoaders: { 'en-US': async () => ({ app: { title: 'My App' } }) },
            }),
        );

        expect(i18n.global.t('app.title')).toBe('My App');
        expect(i18n.global.t('dash.home')).toBe('Dashboard');
    });

    it('loads the configured default locale as the fallback alongside the active locale', async () => {
        const loader = vi.fn(async (locale: string) => ({ greeting: `hello-${locale}` }));

        const { i18n } = await wireLocale(
            baseOptions({
                modules: [moduleWithLocales('dash', loader)],
                localeCandidates: ['fr-FR'],
            }),
        );

        expect(loader.mock.calls).toEqual([['fr-FR'], ['en-US']]);
        expect(i18n.global.getLocaleMessage('en-US')).toEqual({ dash: { greeting: 'hello-en-US' } });
    });

    it('throws by default when a module name shadows a shared top-level key', async () => {
        await expect(
            wireLocale(
                baseOptions({
                    modules: [moduleWithLocales('common', async () => ({ x: 'module' }))],
                    sharedLoaders: { 'en-US': async () => ({ common: { x: 'shared' } }) },
                }),
            ),
        ).rejects.toThrow('Module "common" collides with a shared top-level translation key for locale "en-US".');
    });

    it('lets module messages shadow the shared key under the module-wins strategy', async () => {
        const { i18n } = await wireLocale(
            baseOptions({
                modules: [moduleWithLocales('common', async () => ({ x: 'module' }))],
                sharedLoaders: { 'en-US': async () => ({ common: { x: 'shared' } }) },
                duplicateNamespaceStrategy: 'module-wins',
            }),
        );

        expect(i18n.global.t('common.x')).toBe('module');
    });

    it('applies the error strategy on runtime switches too', async () => {
        const { switcher } = await wireLocale(
            baseOptions({
                modules: [moduleWithLocales('common', async () => ({ x: 'module' }))],
                sharedLoaders: { 'fr-FR': async () => ({ common: { x: 'shared' } }) },
            }),
        );

        await expect(switcher.switchTo('fr-FR')).rejects.toThrow(
            'Module "common" collides with a shared top-level translation key for locale "fr-FR".',
        );
    });

    it('installs the returned switcher as the locale switcher singleton', async () => {
        const { switcher } = await wireLocale(baseOptions());

        expect(localeSwitcher()).toBe(switcher);
    });

    it('reports the detected locale as the switcher current value', async () => {
        const { switcher } = await wireLocale(baseOptions({ localeCandidates: ['fr-FR'] }));

        expect(switcher.current.value).toBe('fr-FR');
    });

    it('persists runtime switches through the same locale service and storage key', async () => {
        const storage = new MemoryStorage();
        const { switcher } = await wireLocale(baseOptions({ storage, localeStorageKey: 'lang' }));

        await switcher.switchTo('fr-FR');

        expect(storage.get('lang')).toBe('fr-FR');
        expect(storage.get('locale')).toBeNull();
    });

    it('shares one memoised message source between activation and the switcher', async () => {
        const loader = vi.fn(async (locale: string) => ({ greeting: `hello-${locale}` }));
        const { switcher } = await wireLocale(baseOptions({ modules: [moduleWithLocales('dash', loader)] }));

        await switcher.switchTo('fr-FR');
        await switcher.switchTo('en-US');

        expect(loader.mock.calls).toEqual([['en-US'], ['fr-FR']]);
    });

    it('synchronises the document lang on runtime switches', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const { i18n, switcher } = await wireLocale(baseOptions({ targetDocument }));

        await switcher.switchTo('ar-SA');

        expect(i18n.global.locale.value).toBe('ar-SA');
        expect(targetDocument.documentElement.getAttribute('lang')).toBe('ar-SA');
        expect(targetDocument.documentElement.getAttribute('dir')).toBe('rtl');
    });
});

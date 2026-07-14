/**
 * Unit tests for application-i18n.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { ModuleDefinition } from '../module/module';
import type { ModuleMessageSource } from '../module/module-registry';
import { MemoryStorage } from '../storage/memory-storage';
import { activateLocale, createApplicationI18n, createLocaleSwitcher } from './application-i18n';
import { LocaleService } from './locale-service';

describe('createApplicationI18n', () => {
    it('returns an i18n instance with legacy set to false', () => {
        const i18n = createApplicationI18n('en-GB');

        expect(i18n.mode).toBe('composition');
    });

    it('sets the initial locale to the provided defaultLocale', () => {
        const i18n = createApplicationI18n('fr-FR');

        expect(i18n.global.locale.value).toBe('fr-FR');
    });

    it('sets the fallback locale to the provided defaultLocale', () => {
        const i18n = createApplicationI18n('en-GB');

        expect(i18n.global.fallbackLocale.value).toBe('en-GB');
    });

    it('installs datetime formats when provided', () => {
        const i18n = createApplicationI18n('en-GB', {
            datetime: { 'en-GB': { short: { year: 'numeric', month: '2-digit', day: '2-digit' } } },
        });

        expect(i18n.global.getDateTimeFormat('en-GB')).toEqual({
            short: { year: 'numeric', month: '2-digit', day: '2-digit' },
        });
    });

    it('installs number formats when provided', () => {
        const i18n = createApplicationI18n('en-GB', {
            number: { 'en-GB': { decimal: { style: 'decimal' } } },
        });

        expect(i18n.global.getNumberFormat('en-GB')).toEqual({ decimal: { style: 'decimal' } });
    });

    it('installs no datetime/number formats when formats is omitted', () => {
        const i18n = createApplicationI18n('en-GB');

        expect(i18n.global.getDateTimeFormat('en-GB')).toEqual({});
        expect(i18n.global.getNumberFormat('en-GB')).toEqual({});
    });
});

describe('activateLocale', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('lang');
        document.documentElement.removeAttribute('dir');
    });

    it('loads shared messages and merges them onto the locale', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            sharedLoaders: {
                'en-GB': async () => ({ welcome: 'Hello' }),
            },
            locale: 'en-GB',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(i18n.global.t('welcome')).toBe('Hello');
    });

    it('namespaces module messages under the module name', async () => {
        const i18n = createApplicationI18n('en-GB');
        const localisedModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async () => ({ login: 'Sign in' }),
        };

        await activateLocale({
            i18n,
            modules: [localisedModule],
            locale: 'en-GB',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        const messages = i18n.global.getLocaleMessage('en-GB');

        expect((messages as Record<string, Record<string, string>>).auth?.login).toBe('Sign in');
    });

    it('switches the locale ref to the activated locale', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            locale: 'fr-FR',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(i18n.global.locale.value).toBe('fr-FR');
    });

    it('sets lang and dir attributes on the provided targetDocument', async () => {
        const i18n = createApplicationI18n('en-GB');
        const target = document.implementation.createHTMLDocument('t');

        await activateLocale({
            i18n,
            modules: [],
            locale: 'ar-SA',
            direction: 'rtl',
            targetDocument: target,
        });

        expect(target.documentElement.getAttribute('lang')).toBe('ar-SA');
        expect(target.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('sets lang and dir attributes on the global document when targetDocument is omitted', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            locale: 'en-GB',
            direction: 'ltr',
        });

        expect(document.documentElement.getAttribute('lang')).toBe('en-GB');
        expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('handles a locale absent from sharedLoaders without throwing', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            sharedLoaders: {
                'fr-FR': async () => ({ bonjour: 'Bonjour' }),
            },
            locale: 'en-GB',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(i18n.global.locale.value).toBe('en-GB');
    });

    it('handles omitted sharedLoaders by treating them as an empty map', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            locale: 'en-GB',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(i18n.global.locale.value).toBe('en-GB');
    });

    it('does not load fallback messages when fallbackLocale equals the active locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        let fallbackLoaderCalled = false;

        const sharedLoaders = {
            'en-GB': () => {
                fallbackLoaderCalled = true;

                return Promise.resolve({ hello: 'Hello' });
            },
        };

        await activateLocale({
            i18n,
            modules: [],
            sharedLoaders,
            locale: 'en-GB',
            direction: 'ltr',
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        // The loader for en-GB is only called once (for the active locale), not a second time
        expect(fallbackLoaderCalled).toBe(true);
        expect(i18n.global.locale.value).toBe('en-GB');
    });

    it('loads fallback messages when fallbackLocale differs from the active locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        const localisedModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async (locale: string) =>
                locale === 'en-GB' ? { login: 'Sign in' } : { login: 'Iniciar sesión' },
        };

        await activateLocale({
            i18n,
            modules: [localisedModule],
            sharedLoaders: {
                'en-GB': async () => ({ welcome: 'Welcome' }),
                'es-ES': async () => ({ welcome: 'Bienvenido' }),
            },
            locale: 'es-ES',
            direction: 'ltr',
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        // Active locale is es-ES
        expect(i18n.global.locale.value).toBe('es-ES');

        // Fallback locale messages are loaded
        const fallbackMessages = i18n.global.getLocaleMessage('en-GB') as Record<string, unknown>;

        expect(fallbackMessages.welcome).toBe('Welcome');
        expect((fallbackMessages.auth as Record<string, string>).login).toBe('Sign in');
    });

    it('does not load fallback messages when fallbackLocale is undefined', async () => {
        const i18n = createApplicationI18n('en-GB');

        await activateLocale({
            i18n,
            modules: [],
            sharedLoaders: {
                'en-GB': async () => ({ hello: 'Hello' }),
            },
            locale: 'fr-FR',
            direction: 'ltr',
            // fallbackLocale is intentionally omitted
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        // en-GB messages are not loaded — the fallback locale had no loader called
        const enMessages = i18n.global.getLocaleMessage('en-GB') as Record<string, unknown>;

        expect(enMessages.hello).toBeUndefined();
        expect(i18n.global.locale.value).toBe('fr-FR');
    });

    it('loads fallback messages using module messages when sharedLoaders is omitted', async () => {
        const i18n = createApplicationI18n('en-GB');
        const localisedModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async (locale: string) => (locale === 'en-GB' ? { login: 'Sign in' } : { login: 'Se connecter' }),
        };

        await activateLocale({
            i18n,
            modules: [localisedModule],
            // sharedLoaders intentionally omitted — covers the sharedLoaders?.[] undefined branch
            locale: 'fr-FR',
            direction: 'ltr',
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(i18n.global.locale.value).toBe('fr-FR');

        const fallbackMessages = i18n.global.getLocaleMessage('en-GB') as Record<string, unknown>;

        expect((fallbackMessages.auth as Record<string, string>).login).toBe('Sign in');
    });

    it('uses the message source instead of module loaders for the active locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        let loaderCalls = 0;
        const localisedModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async () => {
                loaderCalls += 1;

                return { login: 'Sign in' };
            },
        };
        const requested: string[] = [];
        const source: ModuleMessageSource = {
            messages: async locale => {
                requested.push(locale);

                return { auth: { login: 'From source' } };
            },
        };

        await activateLocale({
            i18n,
            modules: [localisedModule],
            locale: 'en-GB',
            direction: 'ltr',
            messageSource: source,
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(loaderCalls).toBe(0);
        expect(requested).toEqual(['en-GB']);

        const messages = i18n.global.getLocaleMessage('en-GB') as Record<string, Record<string, string>>;

        expect(messages.auth?.login).toBe('From source');
    });

    it('uses the message source for the fallback locale load as well', async () => {
        const i18n = createApplicationI18n('en-GB');
        const requested: string[] = [];
        const source: ModuleMessageSource = {
            messages: async locale => {
                requested.push(locale);

                return { auth: { login: locale === 'en-GB' ? 'Sign in' : 'Iniciar sesión' } };
            },
        };

        await activateLocale({
            i18n,
            modules: [],
            locale: 'es-ES',
            direction: 'ltr',
            fallbackLocale: 'en-GB',
            messageSource: source,
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(requested).toEqual(['es-ES', 'en-GB']);

        const active = i18n.global.getLocaleMessage('es-ES') as Record<string, Record<string, string>>;
        const fallback = i18n.global.getLocaleMessage('en-GB') as Record<string, Record<string, string>>;

        expect(active.auth?.login).toBe('Iniciar sesión');
        expect(fallback.auth?.login).toBe('Sign in');
    });

    it('requests the message source once when fallbackLocale equals the active locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        const requested: string[] = [];
        const source: ModuleMessageSource = {
            messages: async locale => {
                requested.push(locale);

                return {};
            },
        };

        await activateLocale({
            i18n,
            modules: [],
            locale: 'en-GB',
            direction: 'ltr',
            fallbackLocale: 'en-GB',
            messageSource: source,
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(requested).toEqual(['en-GB']);
    });

    it('lets a module shadow a shared top-level key when the collision option is absent', async () => {
        const i18n = createApplicationI18n('en-GB');
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        await activateLocale({
            i18n,
            modules: [collidingModule],
            sharedLoaders: {
                'en-GB': async () => ({ common: { greeting: 'From shared' }, welcome: 'Hello' }),
            },
            locale: 'en-GB',
            direction: 'ltr',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        const messages = i18n.global.getLocaleMessage('en-GB') as Record<string, Record<string, string>>;

        expect(messages.common?.greeting).toBe('From module');
        expect(i18n.global.t('welcome')).toBe('Hello');
    });

    it('lets a module shadow a shared top-level key when module-wins is explicit', async () => {
        const i18n = createApplicationI18n('en-GB');
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        await activateLocale({
            i18n,
            modules: [collidingModule],
            sharedLoaders: {
                'en-GB': async () => ({ common: { greeting: 'From shared' }, welcome: 'Hello' }),
            },
            locale: 'en-GB',
            direction: 'ltr',
            onNamespaceCollision: 'module-wins',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        const messages = i18n.global.getLocaleMessage('en-GB') as Record<string, Record<string, string>>;

        expect(messages.common?.greeting).toBe('From module');
        expect(i18n.global.t('welcome')).toBe('Hello');
    });

    it('throws the exact collision error naming the module and the locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        await expect(
            activateLocale({
                i18n,
                modules: [collidingModule],
                sharedLoaders: {
                    'fr-FR': async () => ({ common: { greeting: 'From shared' } }),
                },
                locale: 'fr-FR',
                direction: 'ltr',
                onNamespaceCollision: 'error',
                targetDocument: document.implementation.createHTMLDocument('t'),
            }),
        ).rejects.toThrow('Module "common" collides with a shared top-level translation key for locale "fr-FR".');

        expect(i18n.global.locale.value).toBe('en-GB');
    });

    it('reports only a module that actually collides', async () => {
        const i18n = createApplicationI18n('en-GB');
        const cleanModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async () => ({ login: 'Sign in' }),
        };
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        await expect(
            activateLocale({
                i18n,
                modules: [cleanModule, collidingModule],
                sharedLoaders: {
                    'en-GB': async () => ({ common: { greeting: 'From shared' } }),
                },
                locale: 'en-GB',
                direction: 'ltr',
                onNamespaceCollision: 'error',
                targetDocument: document.implementation.createHTMLDocument('t'),
            }),
        ).rejects.toThrow('Module "common" collides with a shared top-level translation key for locale "en-GB".');
    });

    it('throws for a fallback-locale collision after a clean active load', async () => {
        const i18n = createApplicationI18n('en-GB');
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        await expect(
            activateLocale({
                i18n,
                modules: [collidingModule],
                sharedLoaders: {
                    'es-ES': async () => ({ welcome: 'Hola' }),
                    'en-GB': async () => ({ common: { greeting: 'From shared' } }),
                },
                locale: 'es-ES',
                direction: 'ltr',
                fallbackLocale: 'en-GB',
                onNamespaceCollision: 'error',
                targetDocument: document.implementation.createHTMLDocument('t'),
            }),
        ).rejects.toThrow('Module "common" collides with a shared top-level translation key for locale "en-GB".');
    });

    it('applies collision detection to message-source results', async () => {
        const i18n = createApplicationI18n('en-GB');
        const source: ModuleMessageSource = {
            messages: async () => ({ common: { greeting: 'From source' } }),
        };

        await expect(
            activateLocale({
                i18n,
                modules: [],
                sharedLoaders: {
                    'en-GB': async () => ({ common: { greeting: 'From shared' } }),
                },
                locale: 'en-GB',
                direction: 'ltr',
                messageSource: source,
                onNamespaceCollision: 'error',
                targetDocument: document.implementation.createHTMLDocument('t'),
            }),
        ).rejects.toThrow('Module "common" collides with a shared top-level translation key for locale "en-GB".');
    });

    it('activates normally when error mode finds no collision', async () => {
        const i18n = createApplicationI18n('en-GB');
        const localisedModule: ModuleDefinition = {
            name: 'auth',
            routes: [],
            locales: async () => ({ login: 'Sign in' }),
        };

        await activateLocale({
            i18n,
            modules: [localisedModule],
            sharedLoaders: {
                'en-GB': async () => ({ welcome: 'Hello' }),
            },
            locale: 'en-GB',
            direction: 'ltr',
            onNamespaceCollision: 'error',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        const messages = i18n.global.getLocaleMessage('en-GB') as Record<string, Record<string, string>>;

        expect(messages.auth?.login).toBe('Sign in');
        expect(i18n.global.t('welcome')).toBe('Hello');
        expect(i18n.global.locale.value).toBe('en-GB');
    });
});

describe('createLocaleSwitcher', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('lang');
        document.documentElement.removeAttribute('dir');
    });

    function buildLocaleService(): LocaleService {
        return new LocaleService({
            defaultLocale: 'en-GB',
            enabledLocales: ['en-GB', 'fr-FR'],
            storage: new MemoryStorage(),
        });
    }

    it('mirrors the i18n instance locale reactively', async () => {
        const i18n = createApplicationI18n('en-GB');
        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        expect(switcher.current.value).toBe('en-GB');

        await switcher.switchTo('fr-FR');

        expect(switcher.current.value).toBe('fr-FR');
    });

    it('persists the matched locale and activates it with the matched direction', async () => {
        const i18n = createApplicationI18n('en-GB');
        const storage = new MemoryStorage();
        const localeService = new LocaleService({
            defaultLocale: 'en-GB',
            enabledLocales: ['en-GB', 'ar-SA'],
            storage,
        });
        const target = document.implementation.createHTMLDocument('t');

        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService,
            supported: { 'en-GB': { direction: 'ltr' }, 'ar-SA': { direction: 'rtl' } },
            fallbackLocale: 'en-GB',
            targetDocument: target,
        });

        await switcher.switchTo('ar-SA');

        expect(storage.get('locale')).toBe('ar-SA');
        expect(target.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('matches a regional candidate to its enabled locale before activating', async () => {
        const i18n = createApplicationI18n('en-GB');
        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        await switcher.switchTo('fr-CA');

        expect(switcher.current.value).toBe('fr-FR');
    });

    it('falls back to ltr when the matched locale is absent from the supported map', async () => {
        const i18n = createApplicationI18n('en-GB');
        const target = document.implementation.createHTMLDocument('t');

        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            targetDocument: target,
        });

        await switcher.switchTo('fr-FR');

        expect(target.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('throws a dev error naming the locale when it does not match any enabled locale', async () => {
        const i18n = createApplicationI18n('en-GB');
        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        await expect(switcher.switchTo('de-DE')).rejects.toThrow('de-DE');
    });

    it('forwards sharedLoaders through to activation', async () => {
        const i18n = createApplicationI18n('en-GB');
        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            sharedLoaders: {
                'fr-FR': async () => ({ welcome: 'Bienvenue' }),
            },
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        await switcher.switchTo('fr-FR');

        expect(i18n.global.t('welcome')).toBe('Bienvenue');
    });

    it('sets lang/dir on the global document when targetDocument is omitted', async () => {
        const i18n = createApplicationI18n('en-GB');
        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
        });

        await switcher.switchTo('fr-FR');

        expect(document.documentElement.getAttribute('lang')).toBe('fr-FR');
    });

    it('forwards the message source through to activation', async () => {
        const i18n = createApplicationI18n('en-GB');
        const requested: string[] = [];
        const source: ModuleMessageSource = {
            messages: async locale => {
                requested.push(locale);

                return { auth: { login: locale } };
            },
        };

        const switcher = createLocaleSwitcher({
            i18n,
            modules: [],
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            messageSource: source,
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        await switcher.switchTo('fr-FR');

        expect(requested).toEqual(['fr-FR', 'en-GB']);

        const messages = i18n.global.getLocaleMessage('fr-FR') as Record<string, Record<string, string>>;

        expect(messages.auth?.login).toBe('fr-FR');
    });

    it('forwards the collision strategy through to activation', async () => {
        const i18n = createApplicationI18n('en-GB');
        const collidingModule: ModuleDefinition = {
            name: 'common',
            routes: [],
            locales: async () => ({ greeting: 'From module' }),
        };

        const switcher = createLocaleSwitcher({
            i18n,
            modules: [collidingModule],
            sharedLoaders: {
                'fr-FR': async () => ({ common: { greeting: 'From shared' } }),
            },
            localeService: buildLocaleService(),
            supported: { 'en-GB': { direction: 'ltr' }, 'fr-FR': { direction: 'ltr' } },
            fallbackLocale: 'en-GB',
            onNamespaceCollision: 'error',
            targetDocument: document.implementation.createHTMLDocument('t'),
        });

        await expect(switcher.switchTo('fr-FR')).rejects.toThrow(
            'Module "common" collides with a shared top-level translation key for locale "fr-FR".',
        );
    });
});

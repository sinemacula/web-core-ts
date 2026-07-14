/**
 * Application internationalisation wiring.
 *
 * Wraps vue-i18n behind three operations: building the instance, activating a
 * locale, and switching to a new locale at runtime. Activation lazily loads
 * the shared and per-module translations for that locale, installs them, and
 * synchronises the document `lang`/`dir` attributes. Shared translations are
 * injected by the host application; this package owns the mechanics only.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { IntlDateTimeFormats, IntlNumberFormats } from 'vue-i18n';
import { createI18n } from 'vue-i18n';

import type { LocaleMessages, ModuleDefinition } from '../module/module';
import { collectModuleMessages } from '../module/module';
import type { ModuleMessageSource } from '../module/module-registry';
import type { LocaleService } from './locale-service';

/**
 * Datetime and number formats installed on the i18n instance, keyed by
 * locale. Optional: an application with no formatting needs may omit both.
 */
export interface LocaleFormats {
    readonly datetime?: IntlDateTimeFormats;
    readonly number?: IntlNumberFormats;
}

/**
 * Build the application's vue-i18n instance.
 *
 * @param defaultLocale - the locale used until activation and as fallback
 * @param formats - optional datetime/number formats installed per locale
 * @returns the i18n instance, ready to install on the app
 */
export function createApplicationI18n(defaultLocale: string, formats?: LocaleFormats) {
    return createI18n({
        fallbackLocale: defaultLocale,
        legacy: false,
        locale: defaultLocale,
        messages: {},
        ...(formats?.datetime === undefined ? {} : { datetimeFormats: formats.datetime }),
        ...(formats?.number === undefined ? {} : { numberFormats: formats.number }),
    });
}

/**
 * The vue-i18n instance created by {@link createApplicationI18n}.
 */
export type ApplicationI18n = ReturnType<typeof createApplicationI18n>;

/**
 * Options for activating a locale on the running application.
 */
export interface ActivateLocaleOptions {
    readonly i18n: ApplicationI18n;
    readonly modules: readonly ModuleDefinition[];
    readonly sharedLoaders?: Readonly<Record<string, () => Promise<LocaleMessages>>>;
    readonly locale: string;
    readonly direction: 'ltr' | 'rtl';
    readonly fallbackLocale?: string;
    readonly targetDocument?: Document;

    /**
     * Replaces the internal module-message collection for both the active
     * and fallback locale loads when supplied.
     */
    readonly messageSource?: ModuleMessageSource;

    /**
     * Behaviour when a module name equals a shared top-level message key.
     * Default 'module-wins' keeps the merge where module messages shadow the
     * shared key; 'error' throws naming the module and the locale.
     */
    readonly onNamespaceCollision?: 'module-wins' | 'error';
}

/**
 * Load and activate a locale.
 *
 * When `fallbackLocale` is provided and differs from `locale`, its messages
 * are also loaded and installed so that vue-i18n's fallback chain resolves to
 * real translations rather than raw keys.
 *
 * @param options - the i18n instance, translation sources and target locale
 */
export async function activateLocale(options: ActivateLocaleOptions): Promise<void> {
    await installLocaleMessages(options, options.locale);

    if (options.fallbackLocale !== undefined && options.fallbackLocale !== options.locale) {
        await installLocaleMessages(options, options.fallbackLocale);
    }

    options.i18n.global.locale.value = options.locale;

    const target = options.targetDocument ?? globalThis.document;

    target.documentElement.setAttribute('lang', options.locale);
    target.documentElement.setAttribute('dir', options.direction);
}

/**
 * Options for {@link createLocaleSwitcher}.
 */
export interface LocaleSwitcherOptions {
    readonly i18n: ApplicationI18n;
    readonly modules: readonly ModuleDefinition[];
    readonly sharedLoaders?: Readonly<Record<string, () => Promise<LocaleMessages>>>;
    readonly localeService: LocaleService;
    readonly supported: Readonly<Record<string, { readonly direction: 'ltr' | 'rtl' }>>;
    readonly fallbackLocale: string;
    readonly targetDocument?: Document;

    /** Forwarded to {@link activateLocale} on every switch. */
    readonly messageSource?: ModuleMessageSource;

    /** Forwarded to {@link activateLocale} on every switch. */
    readonly onNamespaceCollision?: 'module-wins' | 'error';
}

/**
 * A runtime locale switcher bound to one i18n instance.
 */
export interface LocaleSwitcher {
    /** The active locale, reactive to changes made through {@link switchTo}. */
    readonly current: ComputedRef<string>;

    /**
     * Resolve, persist and activate a new locale.
     *
     * @param locale - the requested locale (matched against the enabled set)
     * @throws Error when `locale` does not match any enabled locale
     */
    switchTo(locale: string): Promise<void>;
}

/**
 * Build a runtime locale switcher.
 *
 * Reuses {@link activateLocale} for the mechanics of loading and installing
 * translations, so switching a locale after boot follows exactly the same
 * path as activating one at boot.
 *
 * @param options - the i18n instance, module registry, locale service and
 *   supported-locale metadata
 * @returns the locale switcher
 */
export function createLocaleSwitcher(options: LocaleSwitcherOptions): LocaleSwitcher {
    const current = computed(() => options.i18n.global.locale.value);

    return {
        current,
        async switchTo(locale: string): Promise<void> {
            const matched = options.localeService.match(locale);

            if (matched === null) {
                throw new Error(`Cannot switch to locale "${locale}": it is not an enabled locale.`);
            }

            options.localeService.persist(matched);

            await activateLocale({
                i18n: options.i18n,
                modules: options.modules,
                ...(options.sharedLoaders === undefined ? {} : { sharedLoaders: options.sharedLoaders }),
                locale: matched,
                direction: options.supported[matched]?.direction ?? 'ltr',
                fallbackLocale: options.fallbackLocale,
                ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
                ...(options.messageSource === undefined ? {} : { messageSource: options.messageSource }),
                ...(options.onNamespaceCollision === undefined
                    ? {}
                    : { onNamespaceCollision: options.onNamespaceCollision }),
            });
        },
    };
}

/**
 * Load one locale's shared and module translations and install the merged
 * result on the i18n instance.
 *
 * @param options - the activation options
 * @param locale - the locale whose messages are loaded
 * @throws Error when collisions are set to error and a module name equals a
 *   shared top-level message key
 */
async function installLocaleMessages(options: ActivateLocaleOptions, locale: string): Promise<void> {
    const sharedLoader = options.sharedLoaders?.[locale];
    const shared = sharedLoader === undefined ? {} : await sharedLoader();
    const moduleMessages = options.messageSource === undefined
        ? await collectModuleMessages(options.modules, locale)
        : await options.messageSource.messages(locale);

    const collision = options.onNamespaceCollision === 'error'
        ? Object.keys(moduleMessages).find(name => Object.hasOwn(shared, name))
        : undefined;

    if (collision !== undefined) {
        throw new Error(
            `Module "${collision}" collides with a shared top-level translation key for locale "${locale}".`,
        );
    }

    options.i18n.global.setLocaleMessage(locale, { ...shared, ...moduleMessages });
}

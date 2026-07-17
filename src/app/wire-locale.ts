/**
 * Locale wiring for the bootstrap preset.
 *
 * Builds the i18n instance, detects the active locale (stored preference, then
 * caller candidates, then the configured default), activates it through a
 * memoised module message source, and installs a runtime locale switcher built
 * over the same locale service and message source so boot-time detection and
 * later runtime switches stay consistent.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ApplicationI18n, LocaleFormats, LocaleSwitcher } from '../i18n/application-i18n';
import { activateLocale, createApplicationI18n, createLocaleSwitcher } from '../i18n/application-i18n';
import { LocaleService } from '../i18n/locale-service';
import type { LocaleMessages, ModuleDefinition } from '../module/module';
import { createModuleMessageSource } from '../module/module-registry';
import type { KeyValueStorage } from '../storage/key-value-storage';
import { installLocaleSwitcher } from './services';

/**
 * The configuration slice the locale wiring reads.
 */
export interface LocaleWiringConfig {
    readonly locales: {
        readonly default: string;
        readonly enabled: readonly string[];
        readonly supported: Readonly<Record<string, { readonly direction: 'ltr' | 'rtl' }>>;
    };
}

/**
 * Options for {@link wireLocale}.
 */
export interface WireLocaleOptions {
    readonly config: LocaleWiringConfig;

    /**
     * The registry's ordered module list, the source of module translations.
     */
    readonly modules: readonly ModuleDefinition[];

    /** Shared (non-module) translation loaders keyed by locale. */
    readonly sharedLoaders?: Readonly<Record<string, () => Promise<LocaleMessages>>>;

    /** Datetime and number formats installed on the i18n instance. */
    readonly formats?: LocaleFormats;

    /**
     * The storage key the locale preference persists under. Default 'locale'.
     */
    readonly localeStorageKey?: string;

    /**
     * Behaviour when a module name shadows a shared top-level translation key.
     * Default 'error': activation throws naming the module and locale;
     * 'module-wins' keeps the merge where module messages shadow the key.
     */
    readonly duplicateNamespaceStrategy?: 'error' | 'module-wins';

    /** The storage the locale preference is read from and persisted to. */
    readonly storage: KeyValueStorage;

    /**
     * Preferred locales, most preferred first (typically
     * `navigator.languages`).
     */
    readonly localeCandidates: readonly string[];

    /** The document whose `lang`/`dir` attributes are synchronised. */
    readonly targetDocument?: Document;
}

/**
 * The wired i18n instance and its runtime locale switcher.
 */
export interface WiredLocale {
    readonly i18n: ApplicationI18n;
    readonly switcher: LocaleSwitcher;
}

/**
 * Wire application internationalisation.
 *
 * Detects the locale, activates it (loading the configured default alongside as
 * the fallback), and installs the locale switcher singleton.
 *
 * @param options - the configuration slice, modules, i18n options and platform
 * seams
 * @returns the i18n instance and the installed locale switcher
 * @throws Error when the collision strategy is 'error' and a module name equals
 * a shared top-level translation key
 */
export async function wireLocale(options: WireLocaleOptions): Promise<WiredLocale> {
    const locales = options.config.locales;
    const i18n = createApplicationI18n(locales.default, options.formats);
    const localeService = new LocaleService({
        defaultLocale: locales.default,
        enabledLocales: locales.enabled,
        storage: options.storage,
        ...(options.localeStorageKey === undefined ? {} : { storageKey: options.localeStorageKey }),
    });
    const locale = localeService.detect(options.localeCandidates);
    const messageSource = createModuleMessageSource(options.modules);
    const onNamespaceCollision = options.duplicateNamespaceStrategy ?? 'error';

    await activateLocale({
        i18n,
        modules: options.modules,
        ...(options.sharedLoaders === undefined ? {} : { sharedLoaders: options.sharedLoaders }),
        locale,
        direction: locales.supported[locale]?.direction ?? 'ltr',
        fallbackLocale: locales.default,
        messageSource,
        onNamespaceCollision,
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
    });

    const switcher = createLocaleSwitcher({
        i18n,
        modules: options.modules,
        ...(options.sharedLoaders === undefined ? {} : { sharedLoaders: options.sharedLoaders }),
        localeService,
        supported: locales.supported,
        fallbackLocale: locales.default,
        messageSource,
        onNamespaceCollision,
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
    });

    installLocaleSwitcher(switcher);

    return { i18n, switcher };
}

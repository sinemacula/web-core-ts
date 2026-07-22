/**
 * Colour-scheme wiring for the bootstrap preset.
 *
 * Builds the colour-scheme service from the configured default preference and
 * the resolved platform seams, applies the resolved scheme and begins tracking
 * OS changes, then installs the service singleton so components and later boot
 * phases read one shared instance.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { KeyValueStorage } from '@sinemacula/foundation/storage/key-value-storage';
import type { ColorSchemePreference } from '../theme/color-scheme';
import type { ThemeColors } from '../theme/color-scheme-service';
import { ColorSchemeService } from '../theme/color-scheme-service';
import { installColorScheme } from './services';

/**
 * The configuration slice the colour-scheme wiring reads.
 */
export interface ColorSchemeWiringConfig {
    /** Colour-scheme identity: the default preference. */
    readonly colorScheme: {
        /** The preference applied before any stored choice resolves. */
        readonly default: ColorSchemePreference;
    };
}

/**
 * Options for {@link wireColorScheme}.
 */
export interface WireColorSchemeOptions {
    /** The configuration slice the colour-scheme wiring reads. */
    readonly config: ColorSchemeWiringConfig;

    /** The storage the preference is read from and persisted to. */
    readonly storage: KeyValueStorage;

    /** The storage key the preference persists under. Default 'theme'. */
    readonly colorSchemeStorageKey?: string;

    /** The surface-page colours applied to the `theme-color` meta tag. */
    readonly themeColors?: ThemeColors;

    /** The window whose `matchMedia` sources the OS scheme. */
    readonly targetWindow: Window;

    /** The document whose root and head receive the applied scheme. */
    readonly targetDocument?: Document;
}

/**
 * Wire the application colour scheme.
 *
 * Resolves the preference against the OS, applies it, tracks OS changes while
 * the preference is `system`, and installs the colour-scheme singleton.
 *
 * @param options - the configuration slice, storage and platform seams
 * @returns the installed colour-scheme service
 */
export function wireColorScheme(options: WireColorSchemeOptions): ColorSchemeService {
    const config = options.config;
    const service = new ColorSchemeService({
        storage: options.storage,
        defaultPreference: config.colorScheme.default,
        targetWindow: options.targetWindow,
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
        ...(options.colorSchemeStorageKey === undefined ? {} : { storageKey: options.colorSchemeStorageKey }),
        ...(options.themeColors === undefined ? {} : { themeColors: options.themeColors }),
    });

    service.start();

    installColorScheme(service);

    return service;
}

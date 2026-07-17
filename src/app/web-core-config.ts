/**
 * Structural configuration contract read by the bootstrap preset.
 *
 * The preset reads only this slice of the application's configuration tree;
 * applications define richer trees and satisfy the contract structurally. Flag
 * values reuse the feature-flag port's `FlagValue` so a config-delivered flag
 * set feeds the default static adapter without conversion.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { FlagValue } from '../feature-flags/feature-flags';

/**
 * The configuration slice the preset requires from the application.
 */
export interface WebCoreConfig {
    /** HTTP client construction inputs. */
    readonly api: {
        readonly baseUrl: string;
        readonly timeout: number;
    };

    /** Application identity read by observability, titles, and monitors. */
    readonly app: {
        readonly name: string;
        readonly environment: string;
        readonly version: string;
    };

    /** Config-delivered flag set feeding the default static adapter. */
    readonly featureFlags: {
        readonly flags: Readonly<Record<string, FlagValue>>;
    };

    /** Locale identity: default, enabled list, and per-locale metadata. */
    readonly locales: {
        readonly default: string;
        readonly enabled: readonly string[];
        readonly supported: Readonly<Record<string, { readonly direction: 'ltr' | 'rtl' }>>;
    };
}

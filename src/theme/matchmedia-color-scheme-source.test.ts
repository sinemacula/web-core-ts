/**
 * Unit tests for matchmedia-color-scheme-source.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { MatchMediaColorSchemeSource } from './matchmedia-color-scheme-source';

interface FakeMql {
    matches: boolean;
    query: string;
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
        addEvents: [],
        removeEvents: [],
        addEventListener(event, cb) {
            mql.addEvents.push(event);
            handler = cb;
        },
        removeEventListener(event, _cb) {
            mql.removeEvents.push(event);
            handler = null;
        },
        fireChange() {
            handler?.();
        },
    };

    return mql;
}

function windowOf(mql: FakeMql): Window {
    return {
        matchMedia: (query: string) => {
            mql.query = query;

            return mql;
        },
    } as unknown as Window;
}

describe('MatchMediaColorSchemeSource', () => {
    it('queries the OS dark-scheme media feature', () => {
        const mql = makeMql(false);

        new MatchMediaColorSchemeSource(windowOf(mql));

        expect(mql.query).toBe('(prefers-color-scheme: dark)');
    });

    it('reports prefersDark from the query matches', () => {
        expect(new MatchMediaColorSchemeSource(windowOf(makeMql(true))).prefersDark()).toBe(true);
        expect(new MatchMediaColorSchemeSource(windowOf(makeMql(false))).prefersDark()).toBe(false);
    });

    it('subscribes to change events and invokes the callback', () => {
        const mql = makeMql(false);
        const source = new MatchMediaColorSchemeSource(windowOf(mql));
        let fired = 0;

        source.subscribe(() => {
            fired += 1;
        });
        mql.fireChange();

        expect(mql.addEvents).toEqual(['change']);
        expect(fired).toBe(1);
    });

    it('returns an unsubscribe that detaches the change listener', () => {
        const mql = makeMql(false);
        const source = new MatchMediaColorSchemeSource(windowOf(mql));
        let fired = 0;

        const unsubscribe = source.subscribe(() => {
            fired += 1;
        });
        unsubscribe();
        mql.fireChange();

        expect(mql.removeEvents).toEqual(['change']);
        expect(fired).toBe(0);
    });

    it('falls back to the ambient window when none is given', () => {
        expect(typeof new MatchMediaColorSchemeSource().prefersDark()).toBe('boolean');
    });
});

/**
 * Unit tests for clipboard.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyToClipboard } from './clipboard';

function fakeNavigator(writeText: (text: string) => Promise<void>): Navigator {
    return { clipboard: { writeText } } as unknown as Navigator;
}

function navigatorWithoutClipboard(): Navigator {
    return {} as unknown as Navigator;
}

describe('copyToClipboard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns true once the text has been written', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);

        await expect(copyToClipboard('hello', fakeNavigator(writeText))).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('returns false when the Clipboard API is unavailable', async () => {
        await expect(copyToClipboard('hello', navigatorWithoutClipboard())).resolves.toBe(false);
    });

    it('returns false when writeText rejects', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));

        await expect(copyToClipboard('hello', fakeNavigator(writeText))).resolves.toBe(false);
    });

    it('copies through globalThis.navigator when none is provided', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', fakeNavigator(writeText));

        await expect(copyToClipboard('hello')).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
    });
});

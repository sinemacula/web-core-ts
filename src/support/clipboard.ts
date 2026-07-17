/**
 * Clipboard-write helper.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

/**
 * Write `text` to the system clipboard.
 *
 * The Clipboard API is unavailable in some contexts (older browsers, insecure
 * origins) and `writeText` can reject even where it is available (permission
 * denied). Both cases resolve to `false` rather than throwing, so callers can
 * toast a success or failure message without a try/catch.
 *
 * @param text - the text to copy
 * @param targetNavigator - the navigator to copy through; defaults to
 * `globalThis.navigator`
 * @returns true once the text has been written, false when the write was
 * unavailable or failed
 */
export async function copyToClipboard(
    text: string,
    targetNavigator: Navigator = globalThis.navigator,
): Promise<boolean> {
    if (targetNavigator.clipboard === undefined) {
        return false;
    }

    try {
        await targetNavigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Auth module middleware surface.
 *
 * The middleware factories other modules are allowed to consume. Everything
 * under `middleware/` is module-internal; cross-module imports go through
 * this file so the auth module keeps a single public surface.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export { authenticated } from './middleware/authenticated';
export { authorize } from './middleware/authorize';
export { guestOnly } from './middleware/guest-only';

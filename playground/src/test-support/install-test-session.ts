/**
 * Test seam installing the kernel session context.
 *
 * Component and composable tests that exercise the session store install the
 * context here instead of booting the full application. The API gateway is
 * resolved lazily over the kernel HTTP client holder, so a test may swap the
 * installed fake client after this runs and the session still reaches the
 * current one - mirroring how the session module wires the gateway at boot.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { api } from '@sinemacula/web-core/app/services';
import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import { createDefaultSessionApi } from '@sinemacula/web-core/session/default-session-api';
import type { SessionApi } from '@sinemacula/web-core/session/session-api';
import { installSessionContext } from '@sinemacula/web-core/session/session-context';
import type { KeyValueStorage } from '@sinemacula/foundation/storage/key-value-storage';

export { resetSessionContext } from '@sinemacula/web-core/session/session-context';

/**
 * Install a session context matching the application's defaults.
 *
 * @param storage - the storage adapter session state persists to
 */
export function installTestSession(storage: KeyValueStorage): void {
    installSessionContext({
        storageKeys: {
            accessToken: 'auth.access_token',
            refreshToken: 'auth.refresh_token',
            expiresAt: 'auth.expires_at',
            deviceUuid: 'auth.device_uuid',
        },
        routes: { login: { name: 'auth.login' }, loginPath: '/login', home: '/', forbidden: '/forbidden' },
        storage,
        storeId: 'auth',
        coordinator: new TokenRefreshCoordinator({ refresh: () => Promise.resolve(false) }),
        parseTimestamp: () => null,
        device: () => ({ uuid: 'test-device-uuid', os: 'WEB' }),
        get api(): SessionApi {
            return createDefaultSessionApi(api());
        },
    });
}

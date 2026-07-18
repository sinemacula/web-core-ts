/**
 * Browser-boundary API mocking for end-to-end specs.
 *
 * The e2e suite never talks to a real backend: every API call is intercepted at
 * the network layer with `page.route`, so specs exercise the full application
 * (router, stores, HTTP layer, rendering) against deterministic responses.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Page } from '@playwright/test';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write wire-field names as plain
 * string literals inside array elements rather than as object-literal keys -
 * keeping snake_case API field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/**
 * Stub the GET users/self endpoint with a deterministic user record.
 *
 * @param page - the browser page under test
 */
async function mockGetCurrentUser(page: Page): Promise<void> {
    await page.route('**/users/self', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: wire([
                    ['id', 'user-1'],
                    ['first_name', 'E2E'],
                    ['last_name', 'User'],
                    ['full_name', 'E2E User'],
                    ['email', 'e2e@example.com'],
                ]),
            }),
        }),
    );
}

/**
 * Stub the login endpoint with a successful session response and also stub the
 * current-user endpoint that login triggers.
 *
 * @param page - the browser page under test
 */
export async function mockLoginSuccess(page: Page): Promise<void> {
    await page.route('**/auth', route => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }

        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                data: wire([
                    ['token', 'e2e-access-token'],
                    ['refresh_token', 'e2e-refresh-token'],
                    ['expires_at', '2099-12-31 23:59:59'],
                ]),
            }),
        });
    });

    await mockGetCurrentUser(page);
}

/**
 * Stub the login endpoint with an invalid-credentials rejection.
 *
 * @param page - the browser page under test
 */
export async function mockLoginFailure(page: Page): Promise<void> {
    await page.route('**/auth', route => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }

        return route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Invalid credentials.' }),
        });
    });
}

/**
 * Stub the logout endpoint with a 204 No Content response.
 *
 * @param page - the browser page under test
 */
export async function mockLogout(page: Page): Promise<void> {
    await page.route('**/auth', route => {
        if (route.request().method() !== 'DELETE') {
            return route.fallback();
        }

        return route.fulfill({ status: 204 });
    });
}

/** Build one raw user row for the mocked users-list response. */
function userRow(id: string, fullName: string): Record<string, unknown> {
    return wire([
        ['id', id],
        ['full_name', fullName],
        ['email', `${id}@example.com`],
        ['created_at', '2026-01-01 00:00:00'],
    ]);
}

/**
 * Stub the GET users endpoint with two deterministic pages of user rows.
 *
 * Requests whose URL contains `page=2` receive the second page, carrying a row
 * unique to that page so specs can assert pagination advanced; every other
 * request receives the first page. The glob also matches the application's own
 * `/users` route and its `users-view.vue` module, so only genuine `fetch`
 * requests (the API gateway) are stubbed - document navigations and
 * dynamically-imported script modules are let through.
 *
 * @param page - the browser page under test
 */
export async function mockUsersList(page: Page): Promise<void> {
    await page.route('**/users*', route => {
        if (route.request().method() !== 'GET' || route.request().resourceType() !== 'fetch') {
            return route.fallback();
        }

        const isSecondPage = new URL(route.request().url()).searchParams.get('page') === '2';

        const body = isSecondPage
            ? {
                  data: [userRow('user-3', 'Carol Page Two'), userRow('user-4', 'Dave Page Two')],
                  meta: wire([
                      ['current_page', 2],
                      ['last_page', 2],
                      ['per_page', 25],
                      ['total', 27],
                  ]),
              }
            : {
                  data: [userRow('user-1', 'Alice Example'), userRow('user-2', 'Bob Example')],
                  meta: wire([
                      ['current_page', 1],
                      ['last_page', 2],
                      ['per_page', 25],
                      ['total', 27],
                  ]),
              };

        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });
}

/**
 * Stub the GET users endpoint with a 500 server error.
 *
 * A 500 is neither a validation failure nor a 401, so the kernel's default
 * response-error handler raises the application's unexpected-error toast.
 *
 * @param page - the browser page under test
 */
export async function mockUsersListServerError(page: Page): Promise<void> {
    await page.route('**/users*', route => {
        if (route.request().method() !== 'GET' || route.request().resourceType() !== 'fetch') {
            return route.fallback();
        }

        return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Server error.' }),
        });
    });
}

/**
 * Seed an authenticated session before the application boots.
 *
 * Writes both tokens to local storage from an init script, so the auth store
 * hydrates as signed-in on first load. Also registers the current-user mock so
 * any GET users/self triggered by the seeded session is handled.
 *
 * @param page - the browser page under test
 */
export async function seedAuthenticatedSession(page: Page): Promise<void> {
    await page.addInitScript(() => {
        window.localStorage.setItem('auth.access_token', 'e2e-seeded-token');
        window.localStorage.setItem('auth.refresh_token', 'e2e-seeded-refresh-token');
    });

    await mockGetCurrentUser(page);
}

/**
 * Stub GET users/self to fail with 401 once, then succeed.
 *
 * Registered after {@link seedAuthenticatedSession}'s own current-user mock, so
 * it is checked first and takes over: the boot-time request that follows an
 * authenticated visit finds a session the server has already rejected, forcing
 * the bearer-token interceptor's refresh-and-retry path to engage; the retried
 * request that follows a successful refresh finds the session accepted.
 *
 * @param page - the browser page under test
 */
export async function mockUsersSelfUnauthorizedOnce(page: Page): Promise<void> {
    let requestCount = 0;

    await page.route('**/users/self', route => {
        if (route.request().method() !== 'GET' || route.request().resourceType() !== 'fetch') {
            return route.fallback();
        }

        requestCount += 1;

        if (requestCount === 1) {
            return route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Unauthenticated.' }),
            });
        }

        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: wire([
                    ['id', 'user-1'],
                    ['first_name', 'E2E'],
                    ['last_name', 'User'],
                    ['full_name', 'E2E User'],
                    ['email', 'e2e@example.com'],
                ]),
            }),
        });
    });
}

/**
 * Stub the auth refresh endpoint with a fresh session envelope.
 *
 * @param page - the browser page under test
 * @returns an accessor for the number of refresh requests observed so far
 */
export async function mockAuthRefreshSuccess(page: Page): Promise<() => number> {
    let requestCount = 0;

    await page.route('**/auth', route => {
        if (route.request().method() !== 'PATCH' || route.request().resourceType() !== 'fetch') {
            return route.fallback();
        }

        requestCount += 1;

        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: wire([
                    ['token', 'e2e-refreshed-access-token'],
                    ['refresh_token', 'e2e-refreshed-refresh-token'],
                    ['expires_at', '2099-12-31 23:59:59'],
                ]),
            }),
        });
    });

    return () => requestCount;
}

/**
 * Stub the runtime environment document to report one deployed version at boot
 * and a different version on every request after that.
 *
 * Models a release rolling out while a tab is already open: the boot fetch
 * observes the first version, and the update monitor's next poll (a
 * visibility-triggered check, in the e2e suite) observes the second and
 * notifies its subscribers.
 *
 * @param page - the browser page under test
 * @param appUrl - the application's own origin, echoed back as APP_URL so the
 * required-runtime-key check passes when the suite runs against a
 * production-style build
 */
export async function mockRuntimeEnvironmentVersionChange(page: Page, appUrl: string): Promise<void> {
    let requestCount = 0;

    await page.route('**/runtime-env.json', route => {
        if (route.request().resourceType() !== 'fetch') {
            return route.fallback();
        }

        requestCount += 1;

        const appVersion = requestCount === 1 ? '1.0.0' : '2.0.0';

        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
                wire([
                    ['APP_ENV', 'e2e'],
                    ['APP_VERSION', appVersion],
                    ['API_URL', 'http://localhost:8000'],
                    ['APP_URL', appUrl],
                    ['DEFAULT_LOCALE', 'en-US'],
                    ['ENABLED_LOCALES', '["en-US"]'],
                ]),
            ),
        });
    });
}

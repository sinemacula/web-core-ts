/**
 * Component tests for users-view.
 *
 * Exercises the template's rendered states (loading, error, empty, table)
 * and the sort-header wiring; the composable's own behaviour is covered by
 * use-users-list.test.ts.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import type { LocaleSwitcher } from '@sinemacula/web-core/i18n/application-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed, createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import UsersView from '@/modules/users/views/users-view.vue';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseConfiguration, resetConfiguration } from '@/services/config';
import { initialiseLocaleSwitcher, resetLocaleSwitcher } from '@/services/locale';
import { FakeHttpClient } from '@/test-support/fake-http-client';

/**
 * Minimal no-op stub that satisfies the {@link LocaleSwitcher} interface,
 * required because UsersView renders DefaultLayout's locale switcher.
 */
const stubLocaleSwitcher: LocaleSwitcher = {
    current: computed(() => 'en-US'),
    switchTo: async () => undefined,
};

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names
 * as plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/** A valid raw user row as returned by the API. */
function userRow(id: string, fullName: string): Record<string, unknown> {
    return wire([
        ['id', id],
        ['full_name', fullName],
        ['email', `${id}@example.com`],
        ['created_at', '2026-01-01 00:00:00'],
    ]);
}

/** Flushes pending microtasks so an in-flight fetch and DOM update settle. */
async function flushAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

interface MountedUsersView {
    readonly container: HTMLDivElement;
    readonly unmount: () => void;
}

/** Mount UsersView with the minimal plugins it needs. */
function mountUsersView(): MountedUsersView {
    const pinia = createPinia();
    const i18n = createI18n({
        legacy: false,
        locale: 'en-US',
        messages: {},
        // A fixed UTC timeZone keeps the formatted assertion stable regardless
        // of the machine running the test suite.
        datetimeFormats: {
            'en-US': { short: { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' } },
        },
    });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/users', component: UsersView },
        ],
    });

    const container = document.createElement('div') as HTMLDivElement;

    document.body.appendChild(container);

    const app = createApp(UsersView);

    setActivePinia(pinia);
    app.use(pinia).use(i18n).use(router);
    app.mount(container);

    return {
        container,
        unmount: () => {
            app.unmount();
            container.remove();
        },
    };
}

/**
 * Build a `Record<string, string>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write SCREAMING_SNAKE_CASE env
 * keys as plain string literals without triggering Biome's naming-convention
 * rule on object literal keys.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, string>`
 */
function wireEnv(entries: ReadonlyArray<readonly [string, string]>): Record<string, string> {
    return Object.fromEntries(entries);
}

describe('UsersView', () => {
    beforeEach(() => {
        initialiseConfiguration(new Environment(new ObjectEnvironmentSource(wireEnv([['APP_NAME', 'TestApp']]))));
        initialiseLocaleSwitcher(stubLocaleSwitcher);
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetConfiguration();
        resetLocaleSwitcher();
    });

    it('renders the heading', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({ data: [] });
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        expect(container.querySelector('.users-view__heading')).not.toBeNull();

        unmount();
    });

    it('renders a row per user once the initial fetch resolves', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({ data: [userRow('u1', 'Alice Smith'), userRow('u2', 'Bob Jones')] });
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);

        unmount();
    });

    it('formats the createdAt column with the datetime formatter', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({ data: [userRow('u1', 'Alice Smith')] });
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        const cells = container.querySelectorAll('tbody tr td');

        expect(cells[2]?.textContent).toBe('1/1/2026');

        unmount();
    });

    it('renders the empty state when there are no rows', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({ data: [] });
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        expect(container.querySelector('.users-view__state')).not.toBeNull();
        expect(container.querySelector('table')).toBeNull();

        unmount();
    });

    it('renders the error state and recovers via the retry button', async () => {
        const fake = new FakeHttpClient();

        fake.queueError(new Error('boom'));
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        const retryButton = container.querySelector('button');

        if (retryButton === null) {
            throw new Error('retry button not found');
        }

        fake.queueResponse({ data: [userRow('u1', 'Alice Smith')] });
        retryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        await flushAll();

        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);

        unmount();
    });

    it('toggles aria-sort on a column header when its sort button is clicked', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({ data: [userRow('u1', 'Alice Smith')] });
        initialiseApi(fake);

        const { container, unmount } = mountUsersView();

        await flushAll();

        const sortButton = container.querySelector('.users-view__sort');
        const header = sortButton?.closest('th');

        if (sortButton === null || header === null || header === undefined) {
            throw new Error('sortable column header not found');
        }

        expect(header.getAttribute('aria-sort')).toBe('none');

        fake.queueResponse({ data: [userRow('u1', 'Alice Smith')] });
        sortButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        await flushAll();

        expect(header.getAttribute('aria-sort')).toBe('ascending');

        unmount();
    });
});

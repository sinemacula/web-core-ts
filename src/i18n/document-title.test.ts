/**
 * Unit tests for document-title.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory } from 'vue-router';

import { createApplicationRouter } from '../router/router-factory';
import { activateLocale, createApplicationI18n } from './application-i18n';
import { installDocumentTitleSync } from './document-title';

const Empty = defineComponent({ render: () => null });

async function buildEnv() {
    const i18n = createApplicationI18n('en-GB');

    await activateLocale({
        i18n,
        modules: [],
        sharedLoaders: {
            'en-GB': async () => ({ 'page.home': 'Home', 'page.about': 'About' }),
        },
        locale: 'en-GB',
        direction: 'ltr',
        targetDocument: document.implementation.createHTMLDocument('setup'),
    });

    const router = createApplicationRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: Empty, meta: { title: 'page.home' } },
            { path: '/about', component: Empty, meta: { title: 'page.about' } },
            { path: '/no-title', component: Empty },
        ],
    });

    return { i18n, router };
}

describe('installDocumentTitleSync', () => {
    afterEach(() => {
        document.title = '';
    });

    it('sets the title to "<translated> | <appName>" for a route with meta.title', async () => {
        const { i18n, router } = await buildEnv();
        const target = document.implementation.createHTMLDocument('test');

        installDocumentTitleSync({ router, i18n, appName: 'MyApp', targetDocument: target });

        await router.push('/about');

        expect(target.title).toBe('About | MyApp');
    });

    it('sets the title to just the appName for a route without meta.title', async () => {
        const { i18n, router } = await buildEnv();
        const target = document.implementation.createHTMLDocument('test');

        installDocumentTitleSync({ router, i18n, appName: 'MyApp', targetDocument: target });

        await router.push('/no-title');

        expect(target.title).toBe('MyApp');
    });

    it('sets the title on the global document when targetDocument is omitted', async () => {
        const { i18n, router } = await buildEnv();

        installDocumentTitleSync({ router, i18n, appName: 'Console' });

        await router.push('/');

        expect(document.title).toBe('Home | Console');
    });

    it('updates the provided targetDocument title when navigating to a second route', async () => {
        const { i18n, router } = await buildEnv();
        const target = document.implementation.createHTMLDocument('test');

        installDocumentTitleSync({ router, i18n, appName: 'App', targetDocument: target });

        await router.push('/');
        expect(target.title).toBe('Home | App');

        await router.push('/about');
        expect(target.title).toBe('About | App');
    });

    it('returns a teardown that stops updating the title on navigation', async () => {
        const { i18n, router } = await buildEnv();
        const target = document.implementation.createHTMLDocument('test');

        const teardown = installDocumentTitleSync({ router, i18n, appName: 'App', targetDocument: target });

        await router.push('/');
        expect(target.title).toBe('Home | App');

        teardown();

        await router.push('/about');
        expect(target.title).toBe('Home | App');
    });

    it('leaves the title untouched when torn down before any navigation', async () => {
        const { i18n, router } = await buildEnv();
        const target = document.implementation.createHTMLDocument('test');

        target.title = 'untouched';

        const teardown = installDocumentTitleSync({ router, i18n, appName: 'App', targetDocument: target });

        teardown();

        await router.push('/about');

        expect(target.title).toBe('untouched');
    });
});

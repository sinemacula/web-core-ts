/**
 * Component tests for not-found-view.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import NotFoundView from '@/modules/errors/views/not-found-view.vue';

interface MountedNotFoundView {

    readonly container: HTMLDivElement;
    readonly router: ReturnType<typeof createRouter>;
    readonly unmount: () => void;
}

/**
 * Mount NotFoundView with the minimal plugins it needs.
 *
 * @returns the DOM container, router instance, and an unmount callback
 */
function mountNotFoundView(): MountedNotFoundView {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: {} });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/:pathMatch(.*)*', component: NotFoundView },
        ],
    });

    const container = document.createElement('div') as HTMLDivElement;

    document.body.appendChild(container);

    const app = createApp(NotFoundView);

    app.use(i18n).use(router);
    app.mount(container);

    return {
        container,
        router,
        unmount: () => {
            app.unmount();
            container.remove();
        },
    };
}

describe('NotFoundView', () => {
    it('renders the not-found heading', () => {
        const { container, unmount } = mountNotFoundView();

        expect(container.querySelector('.not-found-view__heading')).not.toBeNull();

        unmount();
    });

    it('navigates back to the application root when the back-home action is clicked', async () => {
        const { container, router, unmount } = mountNotFoundView();

        await router.isReady();

        const pushSpy = vi.spyOn(router, 'push');
        const button = container.querySelector('button');

        if (button === null) {
            throw new Error('back-home button not found');
        }

        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(pushSpy).toHaveBeenCalledWith('/');

        unmount();
    });
});

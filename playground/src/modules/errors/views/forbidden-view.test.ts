/**
 * Component tests for forbidden-view.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import ForbiddenView from '@/modules/errors/views/forbidden-view.vue';

interface MountedForbiddenView {
    readonly container: HTMLDivElement;
    readonly router: ReturnType<typeof createRouter>;
    readonly unmount: () => void;
}

/**
 * Mount ForbiddenView with the minimal plugins it needs.
 *
 * @returns the DOM container, router instance, and an unmount callback
 */
function mountForbiddenView(): MountedForbiddenView {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: {} });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/forbidden', component: ForbiddenView },
        ],
    });

    const container = document.createElement('div') as HTMLDivElement;

    document.body.appendChild(container);

    const app = createApp(ForbiddenView);

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

describe('ForbiddenView', () => {
    it('renders the forbidden heading', () => {
        const { container, unmount } = mountForbiddenView();

        expect(container.querySelector('.forbidden-view__heading')).not.toBeNull();

        unmount();
    });

    it('navigates back to the application root when the back-home action is clicked', async () => {
        const { container, router, unmount } = mountForbiddenView();

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

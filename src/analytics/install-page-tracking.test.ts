/**
 * Unit tests for install-page-tracking.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory } from 'vue-router';

import { BreadcrumbTrail } from '../reporting/breadcrumb-trail';
import { createApplicationRouter } from '../router/router-factory';
import type { AnalyticsTracker } from './analytics-tracker';
import { installPageTracking } from './install-page-tracking';

const Empty = defineComponent({ render: () => null });

function buildRouter() {
    return createApplicationRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', name: 'home', component: Empty },
            { path: '/about', name: 'about', component: Empty },
            { path: '/no-name', component: Empty },
        ],
    });
}

function makeTracker(): AnalyticsTracker & {
    pageCalls: Array<{ name: string; properties: Readonly<Record<string, unknown>> | undefined }>;
} {
    const pageCalls: Array<{ name: string; properties: Readonly<Record<string, unknown>> | undefined }> = [];

    return {
        pageCalls,
        track: vi.fn(),
        page(name: string, properties?: Readonly<Record<string, unknown>>) {
            pageCalls.push({ name, properties });
        },
        identify: vi.fn(),
        reset: vi.fn(),
    };
}

describe('installPageTracking', () => {
    describe('page calls', () => {
        it('calls tracker.page with the route name and fullPath after navigation', async () => {
            const router = buildRouter();
            const tracker = makeTracker();

            installPageTracking({ router, tracker });

            await router.push('/about');

            expect(tracker.pageCalls[0]).toStrictEqual({
                name: 'about',
                properties: { path: '/about' },
            });
        });

        it('falls back to to.path when the route has no name', async () => {
            const router = buildRouter();
            const tracker = makeTracker();

            installPageTracking({ router, tracker });

            await router.push('/no-name');

            expect(tracker.pageCalls[0]?.name).toBe('/no-name');
        });

        it('calls tracker.page on every navigation', async () => {
            const router = buildRouter();
            const tracker = makeTracker();

            installPageTracking({ router, tracker });

            await router.push('/');
            await router.push('/about');

            expect(tracker.pageCalls).toHaveLength(2);
        });
    });

    describe('breadcrumb trail (trail provided)', () => {
        it('records a navigation breadcrumb when a trail is provided', async () => {
            const router = buildRouter();
            const tracker = makeTracker();
            const trail = new BreadcrumbTrail(50, () => 0);

            installPageTracking({ router, tracker, trail });

            await router.push('/about');

            expect(trail.list()).toHaveLength(1);
            expect(trail.list()[0]?.category).toBe('navigation');
        });

        it('breadcrumb message contains from and to fullPath', async () => {
            const router = buildRouter();
            const tracker = makeTracker();
            const trail = new BreadcrumbTrail(50, () => 0);

            installPageTracking({ router, tracker, trail });

            await router.push('/about');

            expect(trail.list()[0]?.message).toBe('/ -> /about');
        });

        it('records a breadcrumb for each subsequent navigation', async () => {
            const router = buildRouter();
            const tracker = makeTracker();
            const trail = new BreadcrumbTrail(50, () => 0);

            installPageTracking({ router, tracker, trail });

            await router.push('/');
            await router.push('/about');

            expect(trail.list()).toHaveLength(2);
        });
    });

    describe('breadcrumb trail (trail absent)', () => {
        it('does not add breadcrumbs when no trail is provided', async () => {
            const router = buildRouter();
            const tracker = makeTracker();
            const trail = new BreadcrumbTrail(50, () => 0);

            installPageTracking({ router, tracker });

            await router.push('/about');

            expect(trail.list()).toHaveLength(0);
        });
    });
});

/**
 * Unit tests for navigation-progress.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import type { Component } from 'vue';
import { defineComponent, effectScope } from 'vue';
import type { Router } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createNavigationProgress, type NavigationProgress } from './navigation-progress';

const EmptyComponent = defineComponent({ render: () => null });

/**
 * A lazy route component whose resolution is controlled externally, so a test
 * can assert the in-flight state before letting navigation complete.
 */
interface DeferredComponent {
    readonly load: () => Promise<Component>;
    readonly resolve: () => void;
}

function deferredComponent(): DeferredComponent {
    let resolve!: () => void;
    const promise = new Promise<Component>(res => {
        resolve = () => res(EmptyComponent);
    });

    return { load: () => promise, resolve };
}

function buildRouter(lazyLoader: () => Promise<Component>): Router {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: EmptyComponent },
            { path: '/lazy', component: lazyLoader },
            { path: '/broken', component: () => Promise.reject(new Error('exploded loading the route')) },
        ],
    });
}

/** Flush the microtask queue built up by the router's async guard pipeline. */
async function flushRouterGuards(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('createNavigationProgress', () => {
    it('starts with isNavigating false', () => {
        const router = buildRouter(() => Promise.resolve(EmptyComponent));
        const progress = createNavigationProgress(router);

        expect(progress.isNavigating.value).toBe(false);

        progress.stop();
    });

    it('sets isNavigating true while a lazy navigation is in flight and false once it completes', async () => {
        const deferred = deferredComponent();
        const router = buildRouter(deferred.load);
        const progress = createNavigationProgress(router);

        const navigation = router.push('/lazy');

        await flushRouterGuards();
        expect(progress.isNavigating.value).toBe(true);

        deferred.resolve();
        await navigation;

        expect(progress.isNavigating.value).toBe(false);

        progress.stop();
    });

    it('sets isNavigating false after a navigation error', async () => {
        const router = buildRouter(() => Promise.resolve(EmptyComponent));
        const progress = createNavigationProgress(router);

        await router.push('/broken').catch(() => {
            // The router's own promise rejects alongside the onError handler
            // under test.
        });

        expect(progress.isNavigating.value).toBe(false);

        progress.stop();
    });

    it('stop() resets isNavigating to false immediately, even mid-navigation', async () => {
        const deferred = deferredComponent();
        const router = buildRouter(deferred.load);
        const progress = createNavigationProgress(router);

        const navigation = router.push('/lazy');

        await flushRouterGuards();
        expect(progress.isNavigating.value).toBe(true);

        progress.stop();
        expect(progress.isNavigating.value).toBe(false);

        deferred.resolve();
        await navigation;

        expect(progress.isNavigating.value).toBe(false);
    });

    it('stop() removes the router hooks so a later navigation no longer toggles isNavigating', async () => {
        const deferred = deferredComponent();
        const router = buildRouter(deferred.load);
        const progress = createNavigationProgress(router);

        progress.stop();

        const navigation = router.push('/lazy');

        await flushRouterGuards();
        expect(progress.isNavigating.value).toBe(false);

        deferred.resolve();
        await navigation;

        expect(progress.isNavigating.value).toBe(false);
    });

    it('registers stop() via onScopeDispose so disposing the enclosing scope resets isNavigating', async () => {
        const deferred = deferredComponent();
        const router = buildRouter(deferred.load);
        const scope = effectScope();
        let progress!: NavigationProgress;

        scope.run(() => {
            progress = createNavigationProgress(router);
        });

        const navigation = router.push('/lazy');

        await flushRouterGuards();
        expect(progress.isNavigating.value).toBe(true);

        scope.stop();

        expect(progress.isNavigating.value).toBe(false);

        deferred.resolve();
        await navigation;
    });
});

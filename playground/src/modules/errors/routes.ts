/**
 * Errors module routes.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RouteRecordRaw } from 'vue-router';

import { ERRORS_ROUTE_NAMES } from './route-names';

export const errorsRoutes: readonly RouteRecordRaw[] = [
    {
        path: '/forbidden',
        name: ERRORS_ROUTE_NAMES.forbidden,
        component: () => import('./views/forbidden-view.vue'),
        meta: {
            title: 'errors.forbidden.title',
        },
    },
    {
        path: '/:pathMatch(.*)*',
        name: ERRORS_ROUTE_NAMES.notFound,
        component: () => import('./views/not-found-view.vue'),
        meta: {
            title: 'errors.notFound.title',
        },
    },
];

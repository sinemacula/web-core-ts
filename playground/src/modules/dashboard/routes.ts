/**
 * Dashboard module routes.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { RouteRecordRaw } from 'vue-router';

import { authenticated } from '@/modules/auth';

import { DASHBOARD_ROUTE_NAMES } from './route-names';

export const dashboardRoutes: readonly RouteRecordRaw[] = [
    {
        path: '/',
        name: DASHBOARD_ROUTE_NAMES.home,
        component: () => import('./views/dashboard-view.vue'),
        meta: {
            title: 'dashboard.home.title',
            middleware: [authenticated()],
        },
    },
];

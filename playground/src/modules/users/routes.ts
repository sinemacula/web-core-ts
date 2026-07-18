/**
 * Users module routes.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RouteRecordRaw } from 'vue-router';

import { authorize } from '@/modules/auth';

import { USERS_ROUTE_NAMES } from './route-names';

export const usersRoutes: readonly RouteRecordRaw[] = [
    {
        path: '/users',
        name: USERS_ROUTE_NAMES.index,
        component: () => import('./views/users-view.vue'),
        meta: {
            title: 'users.index.title',
            middleware: [authorize('users.view')],
        },
    },
];

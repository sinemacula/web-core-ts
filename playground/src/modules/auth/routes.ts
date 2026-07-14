/**
 * Auth module routes.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { RouteRecordRaw } from 'vue-router';

import { guestOnly } from './middleware/guest-only';
import { AUTH_ROUTE_NAMES } from './route-names';

export const authRoutes: readonly RouteRecordRaw[] = [
    {
        path: '/login',
        name: AUTH_ROUTE_NAMES.login,
        component: () => import('./views/login-view.vue'),
        meta: {
            title: 'auth.login.title',
            middleware: [guestOnly()],
        },
    },
];

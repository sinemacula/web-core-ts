/**
 * Unit tests for useApiQuery composable.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import type { ApiQuery } from './api-query';
import { useApiQuery } from './use-api-query';

describe('useApiQuery', () => {
    describe('no initial option', () => {
        it('starts with an empty query', () => {
            const { query } = useApiQuery();

            expect(query.value.toQueryParameters()).toEqual({});
        });

        it('starts with empty parameters', () => {
            const { parameters } = useApiQuery();

            expect(parameters.value).toEqual({});
        });
    });

    describe('initial option', () => {
        it('applies the initial builder to seed the query', () => {
            const { query } = useApiQuery({
                initial: q => q.where('status', 'active').page(1),
            });

            const params = query.value.toQueryParameters();

            expect(JSON.parse(String(params.filters))).toEqual({ status: 'active' });
            expect(params.page).toBe(1);
        });

        it('reflects the initial state in parameters', () => {
            const { parameters } = useApiQuery({
                initial: q => q.limit(10),
            });

            expect(parameters.value.limit).toBe(10);
        });
    });

    describe('apply', () => {
        it('replaces the held query with the result of the mutate callback', () => {
            const { query, apply } = useApiQuery();

            apply(q => q.where('name', 'Alice'));

            expect(JSON.parse(String(query.value.toQueryParameters().filters))).toEqual({ name: 'Alice' });
        });

        it('recomputes parameters after apply', () => {
            const { parameters, apply } = useApiQuery();

            apply(q => q.page(5).limit(20));

            expect(parameters.value.page).toBe(5);
            expect(parameters.value.limit).toBe(20);
        });

        it('receives the current query as the argument to the mutate callback', () => {
            const { query, apply } = useApiQuery({
                initial: q => q.where('status', 'active'),
            });

            apply(q => q.where('role', 'admin'));

            const params = query.value.toQueryParameters();
            const filters = JSON.parse(String(params.filters));

            expect(filters).toEqual({ status: 'active', role: 'admin' });
        });

        it('successive apply calls accumulate changes', () => {
            const { query, apply } = useApiQuery();

            apply(q => q.where('a', 1));
            apply(q => q.where('b', 2));

            const filters = JSON.parse(String(query.value.toQueryParameters().filters));

            expect(filters).toEqual({ a: 1, b: 2 });
        });
    });

    describe('reset', () => {
        it('restores the query to the initial state after apply', () => {
            const { query, apply, reset } = useApiQuery({
                initial: q => q.where('status', 'active'),
            });

            apply(q => q.where('role', 'admin'));
            reset();

            const filters = JSON.parse(String(query.value.toQueryParameters().filters));

            expect(filters).toEqual({ status: 'active' });
            expect(query.value.toQueryParameters().role).toBeUndefined();
        });

        it('restores to an empty query when no initial option was given', () => {
            const { query, apply, reset } = useApiQuery();

            apply(q => q.where('name', 'Alice'));
            reset();

            expect(query.value.toQueryParameters()).toEqual({});
        });

        it('recomputes parameters to the initial state after reset', () => {
            const { parameters, apply, reset } = useApiQuery({
                initial: q => q.limit(10),
            });

            apply(q => q.limit(99));

            expect(parameters.value.limit).toBe(99);

            reset();

            expect(parameters.value.limit).toBe(10);
        });

        it('uses the same initial ApiQuery instance on every reset (referential identity)', () => {
            const { query, apply, reset } = useApiQuery({
                initial: q => q.where('x', 1),
            });

            const first = query.value;

            apply(q => q.where('y', 2));
            reset();

            expect(query.value).toBe(first);
        });
    });

    describe('reactivity', () => {
        it('query ComputedRef updates when apply is called', () => {
            const { query, apply } = useApiQuery();

            const before = query.value;

            apply(q => q.where('name', 'Bob'));

            expect(query.value).not.toBe(before);
        });

        it('parameters ComputedRef updates when the query changes', () => {
            const { parameters, apply } = useApiQuery();

            expect(parameters.value.page).toBeUndefined();

            apply(q => q.page(3));

            expect(parameters.value.page).toBe(3);
        });

        it('returns a fresh ApiQuery instance from apply — not mutated original', () => {
            const { apply } = useApiQuery();
            let capturedInput: ApiQuery | undefined;

            apply(q => {
                capturedInput = q;

                return q.where('z', 9);
            });

            expect(capturedInput?.toQueryParameters()).toEqual({});
        });
    });
});

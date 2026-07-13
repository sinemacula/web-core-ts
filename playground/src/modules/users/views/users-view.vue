<!--
    Users list screen.

    Thin template over the use-users-list composable: renders the loading,
    error and empty states, a sortable table, and a pagination footer. The
    table markup is module-local - like toast-host - and will be replaced by
    the ported UI kit table component once that lands.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import SmTextInput from '@/components/ui/sm-text-input.vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import DefaultLayout from '@/layouts/default-layout.vue';

import { parseWireTimestamp, useUsersList } from '../composables/use-users-list';

const { t, d } = useI18n();
const usersList = useUsersList();

const paginationLabel = computed(() => {
    const meta = usersList.meta.value;

    return meta === null ? '' : t('users.index.pagination', { current: meta.currentPage, last: meta.lastPage });
});

/**
 * The `aria-sort` value for a sortable column header.
 *
 * @param column - the wire column name backing the header
 * @returns the ARIA sort state for the column
 */
function ariaSortFor(column: string): 'ascending' | 'descending' | 'none' {
    const sort = usersList.sort.value;

    if (sort === null || sort.column !== column) {
        return 'none';
    }

    return sort.direction === 'asc' ? 'ascending' : 'descending';
}
</script>

<template>
    <DefaultLayout>
        <h1 class="users-view__heading">{{ t('users.index.title') }}</h1>

        <SmTextInput
            v-model="usersList.searchInput.value"
            :label="t('users.index.search')"
            class="users-view__search"
        />

        <template v-if="!usersList.hasLoaded.value && usersList.isLoading.value">
            <p class="users-view__state">{{ t('common.states.loading') }}</p>
        </template>

        <template v-else-if="usersList.error.value !== null">
            <div class="users-view__state">
                <p>{{ t('common.states.error') }}</p>
                <SmButton variant="secondary" @click="usersList.refetch">
                    {{ t('users.index.actions.retry') }}
                </SmButton>
            </div>
        </template>

        <template v-else-if="usersList.rows.value.length === 0">
            <p class="users-view__state">{{ t('common.states.empty') }}</p>
        </template>

        <template v-else>
            <table class="users-view__table">
                <thead>
                    <tr>
                        <th scope="col" :aria-sort="ariaSortFor('full_name')">
                            <button type="button" class="users-view__sort" @click="usersList.sortBy('full_name')">
                                {{ t('users.index.columns.fullName') }}
                            </button>
                        </th>
                        <th scope="col">{{ t('users.index.columns.email') }}</th>
                        <th scope="col" :aria-sort="ariaSortFor('created_at')">
                            <button type="button" class="users-view__sort" @click="usersList.sortBy('created_at')">
                                {{ t('users.index.columns.createdAt') }}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in usersList.rows.value" :key="row.id">
                        <td>{{ row.fullName }}</td>
                        <td>{{ row.email }}</td>
                        <td>{{ d(parseWireTimestamp(row.createdAt), 'short') }}</td>
                    </tr>
                </tbody>
            </table>

            <footer class="users-view__pagination">
                <SmButton variant="ghost" :disabled="usersList.page.value <= 1" @click="usersList.previous">
                    {{ t('users.index.actions.previousPage') }}
                </SmButton>
                <span class="users-view__pagination-text">{{ paginationLabel }}</span>
                <SmButton
                    variant="ghost"
                    :disabled="usersList.meta.value !== null && usersList.page.value >= usersList.meta.value.lastPage"
                    @click="usersList.next"
                >
                    {{ t('users.index.actions.nextPage') }}
                </SmButton>
            </footer>
        </template>
    </DefaultLayout>
</template>

<style scoped>
.users-view__heading {
    margin-bottom: var(--sm-space-4);
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}

.users-view__search {
    max-width: 24rem;
    margin-bottom: var(--sm-space-6);
}

.users-view__state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sm-space-3);
    padding: var(--sm-space-6);
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}

.users-view__table {
    width: 100%;
    background: var(--sm-surface-raised);
    border: 1px solid var(--sm-border);
    border-radius: var(--sm-radius-md);
    border-collapse: collapse;
}

.users-view__table th,
.users-view__table td {
    padding: var(--sm-space-3) var(--sm-space-4);
    border-bottom: 1px solid var(--sm-border);
    text-align: left;
}

.users-view__sort {
    display: inline-flex;
    align-items: center;
    padding: 0;
    background: none;
    border: none;
    color: var(--sm-text-strong);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.users-view__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sm-space-4);
    margin-top: var(--sm-space-4);
}

.users-view__pagination-text {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}
</style>

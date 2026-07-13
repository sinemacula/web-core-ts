<!--
    Forbidden (403) screen.

    Rendered when an authenticated visitor is redirected here by the
    authorize() middleware for lacking a required permission. Deliberately
    without DefaultLayout or GuestLayout chrome, matching not-found-view.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
    <div class="forbidden-view">
        <div class="forbidden-view__panel">
            <h1 class="forbidden-view__heading">{{ t('errors.forbidden.title') }}</h1>
            <p class="forbidden-view__message">{{ t('errors.forbidden.message') }}</p>
            <RouterLink to="/" custom v-slot="{ navigate }">
                <SmButton @click="navigate">{{ t('errors.forbidden.action') }}</SmButton>
            </RouterLink>
        </div>
    </div>
</template>

<style scoped>
.forbidden-view {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--sm-space-8) var(--sm-space-4);
}

.forbidden-view__panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sm-space-4);
    max-width: 28rem;
}

.forbidden-view__heading {
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}

.forbidden-view__message {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}
</style>

<!--
    Not-found (404) screen.

    Rendered by the catch-all route for any URL that matches no other route.
    Deliberately without DefaultLayout or GuestLayout chrome since the
    visitor may not be signed in.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
    <div class="not-found-view">
        <div class="not-found-view__panel">
            <h1 class="not-found-view__heading">{{ t('errors.notFound.title') }}</h1>
            <p class="not-found-view__message">{{ t('errors.notFound.message') }}</p>
            <RouterLink to="/" custom v-slot="{ navigate }">
                <SmButton @click="navigate">{{ t('errors.notFound.action') }}</SmButton>
            </RouterLink>
        </div>
    </div>
</template>

<style scoped>
.not-found-view {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--sm-space-8) var(--sm-space-4);
}

.not-found-view__panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sm-space-4);
    max-width: 28rem;
}

.not-found-view__heading {
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}

.not-found-view__message {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}
</style>

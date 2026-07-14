<!--
    Application root: the router outlet, navigation progress indicator, the
    fatal-error fallback panel, and the global notification hosts.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import { useI18n } from 'vue-i18n';
import { RouterView } from 'vue-router';

import ConfirmHost from '@/components/confirm-host.vue';
import NavigationProgress from '@/components/navigation-progress.vue';
import ToastHost from '@/components/toast-host.vue';
import { useFatalBoundary } from '@/modules/errors/composables/use-fatal-boundary';

const { t } = useI18n();
const boundary = useFatalBoundary();

const handleReload = (): void => location.reload();
</script>

<template>
    <NavigationProgress />
    <div v-if="boundary.fatal.value" class="app-fatal">
        <h1 class="app-fatal__heading">{{ t('errors.fatal.title') }}</h1>
        <p class="app-fatal__message">{{ t('errors.fatal.message') }}</p>
        <SmButton @click="handleReload">{{ t('errors.fatal.action') }}</SmButton>
    </div>
    <RouterView v-else />
    <ToastHost />
    <ConfirmHost />
</template>

<style scoped>
.app-fatal {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: var(--sm-space-4);
    max-width: 28rem;
    min-height: 100vh;
    margin-inline: auto;
    padding: var(--sm-space-8) var(--sm-space-4);
}

.app-fatal__heading {
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}

.app-fatal__message {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}
</style>

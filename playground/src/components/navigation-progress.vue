<!--
    Router navigation progress indicator.

    Thin presenter over the kernel createNavigationProgress: renders a fixed
    top progress bar while a navigation is in flight. Replaced by the ported
    UI kit progress component when that lands.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import { createNavigationProgress } from '@sinemacula/web-core/router/navigation-progress';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const progress = createNavigationProgress(useRouter());
</script>

<template>
    <div
        v-if="progress.isNavigating.value"
        class="navigation-progress"
        role="progressbar"
        :aria-label="t('common.states.loading')"
    />
</template>

<style scoped>
.navigation-progress {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    width: 100%;
    height: 3px;
    background: var(--sm-primary-500);
    animation: navigation-progress-indeterminate 1.2s ease-in-out infinite;
}

@keyframes navigation-progress-indeterminate {
    0% {
        transform: translateX(-100%) scaleX(0.4);
    }

    50% {
        transform: translateX(0%) scaleX(0.6);
    }

    100% {
        transform: translateX(100%) scaleX(0.4);
    }
}
</style>

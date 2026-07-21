<!--
    Toast rendering host.

    Thin presenter over the kernel ToastService: state and lifecycle live in
    the service; this component only renders and relays dismissals. Replaced
    by the ported UI kit toast component when that lands.

    Accessibility: error and warning toasts are rendered in an assertive live
    region (`role="alert"`, `aria-live="assertive"`) so screen readers
    interrupt immediately. Success and information toasts are rendered in a
    polite live region (`role="status"`, `aria-live="polite"`) so screen
    readers announce them at the next opportunity without interrupting.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { toasts } from '@/services/toast';
import type { Toast } from '@sinemacula/web-core/notifications/toast-service';

const { t } = useI18n();
const service = toasts();

/** Toasts that require assertive announcement (error, warning). */
const assertiveToasts = computed(() =>
    service.toasts.value.filter((toast: Toast) => toast.variant === 'error' || toast.variant === 'warning'),
);

/** Toasts that should be announced politely (success, information). */
const politeToasts = computed(() =>
    service.toasts.value.filter((toast: Toast) => toast.variant === 'success' || toast.variant === 'information'),
);
</script>

<template>
    <div class="toast-host">
        <!--
            Assertive region: error and warning variants interrupt the screen
            reader immediately
        -->
        <div role="alert" aria-live="assertive" class="toast-host__region">
            <div
                v-for="toast in assertiveToasts"
                :key="toast.id"
                :class="['toast-host__toast', `toast-host__toast--${toast.variant}`]"
            >
                <span class="toast-host__message">{{ t(toast.message) }}</span>
                <button
                    type="button"
                    class="toast-host__dismiss"
                    :aria-label="t('common.actions.dismiss')"
                    @click="service.dismiss(toast.id)"
                >
                    &times;
                </button>
            </div>
        </div>

        <!--
            Polite region: success and information variants announce at the next
            opportunity
        -->
        <div role="status" aria-live="polite" class="toast-host__region">
            <div
                v-for="toast in politeToasts"
                :key="toast.id"
                :class="['toast-host__toast', `toast-host__toast--${toast.variant}`]"
            >
                <span class="toast-host__message">{{ t(toast.message) }}</span>
                <button
                    type="button"
                    class="toast-host__dismiss"
                    :aria-label="t('common.actions.dismiss')"
                    @click="service.dismiss(toast.id)"
                >
                    &times;
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.toast-host {
    position: fixed;
    right: var(--sm-space-4);
    bottom: var(--sm-space-4);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: var(--sm-space-2);
    max-width: 24rem;
}

.toast-host__region {
    display: contents;
}

.toast-host__toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sm-space-3);
    padding: var(--sm-space-3) var(--sm-space-4);
    background: var(--sm-surface-raised);
    border: 1px solid var(--sm-border);
    border-left-width: 4px;
    border-radius: var(--sm-radius-md);
    box-shadow: var(--sm-shadow-md);
    color: var(--sm-text-body);
    font-size: var(--sm-text-sm);
}

.toast-host__toast--success {
    border-left-color: var(--sm-status-success);
}

.toast-host__toast--error {
    border-left-color: var(--sm-status-error);
}

.toast-host__toast--information {
    border-left-color: var(--sm-status-information);
}

.toast-host__toast--warning {
    border-left-color: var(--sm-status-warning);
}

.toast-host__dismiss {
    padding: 0;
    background: none;
    border: none;
    color: var(--sm-text-muted);
    font-size: var(--sm-text-lg);
    line-height: 1;
    cursor: pointer;
}
</style>

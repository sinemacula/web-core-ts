<!--
    Confirmation dialog host.

    Thin presenter over the kernel ConfirmService: requests queue in the
    service; this component renders the active one and relays the outcome.
    Replaced by the ported UI kit dialog component when that lands.

    Accessibility: the dialog has `aria-labelledby` pointing at the title
    element and `aria-describedby` pointing at the message element. Focus is
    trapped inside the panel while the dialog is open (useFocusTrap) and
    restored to the triggering element on close. Escape dismisses the dialog.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import SmCard from '@/components/ui/sm-card.vue';
import { useI18n } from 'vue-i18n';
import { ref, watch } from 'vue';

import { useFocusTrap } from '@sinemacula/web-core/composables/use-focus-trap';
import { confirmDialogs } from '@/services/confirm';

const { t } = useI18n();
const service = confirmDialogs();

const panelRef = ref<HTMLElement | null>(null);
const trap = useFocusTrap(panelRef);

watch(
    () => service.active.value,
    (active) => {
        if (active !== null) {
            trap.activate();
        } else {
            trap.deactivate();
        }
    },
);

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        service.settle(false);
    }
}
</script>

<template>
    <div
        v-if="service.active.value !== null"
        class="confirm-host"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`confirm-title-${service.active.value.id}`"
        :aria-describedby="`confirm-message-${service.active.value.id}`"
        @keydown="onKeydown"
    >
        <SmCard class="confirm-host__panel" ref="panelRef">
            <h2 :id="`confirm-title-${service.active.value.id}`" class="confirm-host__title">
                {{ t(service.active.value.title) }}
            </h2>
            <p :id="`confirm-message-${service.active.value.id}`" class="confirm-host__message">
                {{ t(service.active.value.message) }}
            </p>
            <div class="confirm-host__actions">
                <SmButton variant="ghost" @click="service.settle(false)">
                    {{ t(service.active.value.cancelLabel ?? 'common.actions.cancel') }}
                </SmButton>
                <SmButton @click="service.settle(true)">
                    {{ t(service.active.value.confirmLabel ?? 'common.actions.confirm') }}
                </SmButton>
            </div>
        </SmCard>
    </div>
</template>

<style scoped>
.confirm-host {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sm-space-4);
    background: rgb(15 23 42 / 40%);
}

.confirm-host__panel {
    width: 100%;
    max-width: 26rem;
}

.confirm-host__title {
    margin-bottom: var(--sm-space-4);
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}

.confirm-host__message {
    color: var(--sm-text-body);
    font-size: var(--sm-text-sm);
}

.confirm-host__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sm-space-2);
    margin-top: var(--sm-space-5);
}
</style>

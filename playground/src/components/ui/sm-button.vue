<!--
    Primary action button.

    Presentational only: props in, clicks out. The loading state disables the
    button and shows a spinner alongside the label.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmSpinner from './sm-spinner.vue';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
    /** Visual style of the button. */
    variant?: Variant;
    /** Native button type. */
    type?: 'button' | 'submit';
    /** Disable interaction. */
    disabled?: boolean;
    /** Show a spinner and disable interaction. */
    loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
});
</script>

<template>
    <button
        :type="props.type"
        :class="['sm-button', `sm-button--${props.variant}`]"
        :disabled="props.disabled || props.loading"
    >
        <SmSpinner v-if="props.loading" size="sm" />
        <slot />
    </button>
</template>

<style scoped>
.sm-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sm-space-2);
    padding: var(--sm-space-2) var(--sm-space-4);
    border: none;
    border-radius: var(--sm-radius-md);
    font-size: var(--sm-text-sm);
    font-weight: 600;
    line-height: 1.25rem;
    cursor: pointer;
    transition:
        background-color var(--sm-transition),
        color var(--sm-transition);
}

.sm-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.sm-button--primary {
    background: var(--sm-primary-900);
    color: var(--sm-neutral-0);
}

.sm-button--primary:hover:not(:disabled) {
    background: var(--sm-primary-700);
}

.sm-button--secondary {
    background: var(--sm-secondary-600);
    color: var(--sm-neutral-0);
}

.sm-button--secondary:hover:not(:disabled) {
    background: var(--sm-secondary-500);
}

.sm-button--ghost {
    background: transparent;
    color: var(--sm-primary-700);
}

.sm-button--ghost:hover:not(:disabled) {
    background: var(--sm-primary-50);
}

.sm-button--danger {
    background: var(--sm-error);
    color: var(--sm-neutral-0);
}

.sm-button--danger:hover:not(:disabled) {
    background: var(--sm-error-strong);
}
</style>

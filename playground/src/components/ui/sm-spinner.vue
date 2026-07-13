<!--
    Indeterminate loading spinner.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
interface Props {
    /** Visual size of the spinner. */
    size?: 'sm' | 'md' | 'lg';
}

withDefaults(defineProps<Props>(), {
    size: 'md',
});
</script>

<template>
    <span :class="['sm-spinner', `sm-spinner--${size}`]" aria-hidden="true" />
</template>

<style scoped>
.sm-spinner {
    display: inline-block;
    border: 2px solid currentcolor;
    border-radius: 9999px;
    border-top-color: transparent;
    animation: sm-spin 0.7s linear infinite;
}

.sm-spinner--sm {
    width: 1rem;
    height: 1rem;
}

.sm-spinner--md {
    width: 1.25rem;
    height: 1.25rem;
}

.sm-spinner--lg {
    width: 2rem;
    height: 2rem;
    border-width: 4px;
}

@keyframes sm-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>

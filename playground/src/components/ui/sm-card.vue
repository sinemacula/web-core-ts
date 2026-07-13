<!--
    Content card.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
interface Props {
    /** Optional heading rendered above the card body. */
    title?: string;
}

withDefaults(defineProps<Props>(), {
    title: '',
});
</script>

<template>
    <section class="sm-card">
        <h2 v-if="title !== ''" class="sm-card__title">{{ title }}</h2>
        <slot />
    </section>
</template>

<style scoped>
.sm-card {
    padding: var(--sm-space-6);
    background: var(--sm-surface-raised);
    border: 1px solid var(--sm-border);
    border-radius: var(--sm-radius-lg);
    box-shadow: var(--sm-shadow-sm);
}

.sm-card__title {
    margin-bottom: var(--sm-space-4);
    color: var(--sm-text-strong);
    font-size: var(--sm-text-lg);
    font-weight: 600;
}
</style>

<!--
    Colour-scheme switcher.

    Three-way light / dark / system control over the kernel colour-scheme
    service. Selecting a preference persists it; while deferring to the OS the
    resolved scheme is tracked so the active choice stays highlighted as the OS
    flips.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { colorScheme } from '@sinemacula/web-core/app/services';
import type { ColorSchemePreference, ResolvedColorScheme } from '@sinemacula/foundation/theme/color-scheme';

const { t } = useI18n();
const service = colorScheme();

const options: readonly ColorSchemePreference[] = ['light', 'dark', 'system'];

const preference = ref<ColorSchemePreference>(service.preference());
const resolved = ref<ResolvedColorScheme>(service.resolved());

let unsubscribe: (() => void) | null = null;

/**
 * Persist the chosen preference and reflect it in the pressed state.
 *
 * @param pref - the newly selected preference
 */
function select(pref: ColorSchemePreference): void {
    preference.value = pref;
    service.setPreference(pref);
}

onMounted(() => {
    unsubscribe = service.subscribe((next: ResolvedColorScheme) => {
        resolved.value = next;
    });
});

onUnmounted(() => {
    unsubscribe?.();
});
</script>

<template>
    <div class="sm-color-scheme-switcher" role="group" :aria-label="t('common.theme.label')">
        <button
            v-for="option in options"
            :key="option"
            type="button"
            :class="[
                'sm-color-scheme-switcher__option',
                { 'sm-color-scheme-switcher__option--resolved': preference === 'system' && resolved === option },
                { 'sm-color-scheme-switcher__option--active': preference === option },
            ]"
            :aria-pressed="preference === option"
            @click="select(option)"
        >
            {{ t(`common.theme.${option}`) }}
        </button>
    </div>
</template>

<style scoped>
.sm-color-scheme-switcher {
    display: inline-flex;
    gap: var(--sm-space-1);
    padding: var(--sm-space-1);
    background: var(--sm-surface-sunken);
    border: 1px solid var(--sm-border);
    border-radius: var(--sm-radius-md);
}

.sm-color-scheme-switcher__option {
    padding: var(--sm-space-1) var(--sm-space-3);
    background: none;
    border: none;
    border-radius: var(--sm-radius-sm);
    color: var(--sm-text-body);
    font-size: var(--sm-text-sm);
    font-weight: 500;
    line-height: 1.25rem;
    cursor: pointer;
    transition:
        background-color var(--sm-transition),
        color var(--sm-transition);
}

.sm-color-scheme-switcher__option:hover {
    color: var(--sm-text-strong);
}

.sm-color-scheme-switcher__option:focus-visible {
    outline: var(--sm-focus-ring);
    outline-offset: var(--sm-focus-offset);
}

.sm-color-scheme-switcher__option--resolved {
    color: var(--sm-accent);
}

.sm-color-scheme-switcher__option--active {
    background: var(--sm-surface-raised);
    box-shadow: var(--sm-shadow-sm);
    color: var(--sm-text-strong);
}
</style>

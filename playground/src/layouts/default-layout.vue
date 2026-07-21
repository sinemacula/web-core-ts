<!--
    Authenticated application layout.

    Header with the application brand and a slot for page-level actions;
    content constrained to a centred column.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import LocaleSwitcher from '@/components/locale-switcher.vue';
import SmColorSchemeSwitcher from '@/components/theme/sm-color-scheme-switcher.vue';
import { config } from '@/services/config';

const { t } = useI18n();
const appName = config().app.name;
</script>

<template>
    <div class="default-layout">
        <header class="default-layout__header">
            <div class="default-layout__header-inner">
                <span class="default-layout__brand">{{ appName }}</span>
                <nav class="default-layout__nav" :aria-label="t('common.nav.label')">
                    <RouterLink to="/" class="default-layout__nav-link">{{ t('common.nav.dashboard') }}</RouterLink>
                    <RouterLink to="/users" class="default-layout__nav-link">{{ t('common.nav.users') }}</RouterLink>
                </nav>
                <div class="default-layout__header-actions">
                    <LocaleSwitcher />
                    <SmColorSchemeSwitcher />
                    <slot name="actions" />
                </div>
            </div>
        </header>
        <main class="default-layout__main">
            <slot />
        </main>
    </div>
</template>

<style scoped>
.default-layout {
    min-height: 100vh;
}

.default-layout__header {
    background: var(--sm-surface-raised);
    border-bottom: 1px solid var(--sm-border);
}

.default-layout__header-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sm-space-4);
    max-width: 72rem;
    margin-inline: auto;
    padding: var(--sm-space-4) var(--sm-space-6);
}

.default-layout__brand {
    color: var(--sm-text-strong);
    font-weight: 700;
}

.default-layout__nav {
    display: flex;
    gap: var(--sm-space-4);
}

.default-layout__nav-link {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
    font-weight: 500;
    text-decoration: none;
    transition: color var(--sm-transition);
}

.default-layout__nav-link:hover {
    color: var(--sm-text-strong);
}

.default-layout__nav-link.router-link-active {
    color: var(--sm-accent-hover);
    font-weight: 700;
}

.default-layout__header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sm-space-4);
}

.default-layout__main {
    max-width: 72rem;
    margin-inline: auto;
    padding: var(--sm-space-8) var(--sm-space-6);
}
</style>

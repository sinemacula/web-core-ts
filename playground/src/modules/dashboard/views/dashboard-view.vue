<!--
    Dashboard home screen.

    Placeholder landing view demonstrating the authenticated layout, module
    translations and sign-out flow.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import SmCard from '@/components/ui/sm-card.vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import DefaultLayout from '@/layouts/default-layout.vue';
import { AUTH_ROUTE_NAMES, useAuthStore } from '@/modules/auth';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const handleSignOut = async (): Promise<void> => {
    await auth.logout();
    await router.push({ name: AUTH_ROUTE_NAMES.login });
};
</script>

<template>
    <DefaultLayout>
        <template #actions>
            <SmButton variant="ghost" @click="handleSignOut">{{ t('common.actions.signOut') }}</SmButton>
        </template>
        <SmCard :title="t('dashboard.home.title')">
            <p class="dashboard__welcome">{{ t('dashboard.home.welcome') }}</p>
        </SmCard>
    </DefaultLayout>
</template>

<style scoped>
.dashboard__welcome {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}
</style>

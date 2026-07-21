<!--
    Login screen.

    Thin template over the use-login-form composable: renders fields, relays
    submission, and routes into the application on success.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import SmButton from '@/components/ui/sm-button.vue';
import SmCard from '@/components/ui/sm-card.vue';
import SmTextInput from '@/components/ui/sm-text-input.vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import GuestLayout from '@/layouts/guest-layout.vue';
import { useLoginForm } from '@/modules/auth/composables/use-login-form';
import { REDIRECT_QUERY_KEY, sanitiseRedirectTarget } from '@sinemacula/web-core/session/redirect';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const form = useLoginForm();

const handleSubmit = async (): Promise<void> => {
    if (await form.submit()) {
        await router.push(sanitiseRedirectTarget(route.query[REDIRECT_QUERY_KEY]) ?? '/');
    }
};
</script>

<template>
    <GuestLayout>
        <SmCard :title="t('auth.login.title')">
            <form class="login-form" novalidate @submit.prevent="handleSubmit">
                <p class="login-form__subtitle">{{ t('auth.login.subtitle') }}</p>
                <SmTextInput
                    v-model="form.email.value"
                    :label="t('auth.login.fields.email')"
                    :error="form.emailError.value === '' ? '' : t(form.emailError.value)"
                    type="email"
                    autocomplete="email"
                    required
                />
                <SmTextInput
                    v-model="form.password.value"
                    :label="t('auth.login.fields.password')"
                    :error="form.passwordError.value === '' ? '' : t(form.passwordError.value)"
                    type="password"
                    autocomplete="current-password"
                    required
                />
                <p v-if="form.error.value !== null" class="login-form__error">{{ t(form.error.value) }}</p>
                <SmButton type="submit" :loading="form.isSubmitting.value">
                    {{ t('auth.login.actions.submit') }}
                </SmButton>
            </form>
        </SmCard>
    </GuestLayout>
</template>

<style scoped>
.login-form {
    display: flex;
    flex-direction: column;
    gap: var(--sm-space-4);
}

.login-form__subtitle {
    color: var(--sm-text-muted);
    font-size: var(--sm-text-sm);
}

.login-form__error {
    color: var(--sm-danger);
    font-size: var(--sm-text-sm);
}
</style>

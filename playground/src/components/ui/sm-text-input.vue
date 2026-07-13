<!--
    Labelled text input with validation message.

    Two-way bound via v-model. A non-empty error message renders below the
    input and switches the border to the error palette.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<script setup lang="ts">
import { useId } from 'vue';

interface Props {
    /** Field label. */
    label: string;
    /** Native input type. */
    type?: 'text' | 'email' | 'password';
    /** Mark the field as required. */
    required?: boolean;
    /** Disable interaction. */
    disabled?: boolean;
    /** Validation message; empty string means valid. */
    error?: string;
    /** Autocomplete hint passed to the input. */
    autocomplete?: string;
}

const props = withDefaults(defineProps<Props>(), {
    type: 'text',
    required: false,
    disabled: false,
    error: '',
    autocomplete: 'off',
});

const model = defineModel<string>({ default: '' });

const id = useId();
</script>

<template>
    <div class="sm-text-input">
        <label :for="id" class="sm-text-input__label">{{ props.label }}</label>
        <input
            :id="id"
            v-model="model"
            :type="props.type"
            :required="props.required"
            :disabled="props.disabled"
            :autocomplete="props.autocomplete"
            :aria-invalid="props.error !== ''"
            :class="['sm-text-input__control', { 'sm-text-input__control--invalid': props.error !== '' }]"
        />
        <p v-if="props.error !== ''" class="sm-text-input__error">{{ props.error }}</p>
    </div>
</template>

<style scoped>
.sm-text-input {
    display: flex;
    flex-direction: column;
    gap: var(--sm-space-1);
}

.sm-text-input__label {
    color: var(--sm-text-strong);
    font-size: var(--sm-text-sm);
    font-weight: 500;
}

.sm-text-input__control {
    padding: var(--sm-space-2) var(--sm-space-3);
    background: var(--sm-surface-raised);
    border: 1px solid var(--sm-neutral-300);
    border-radius: var(--sm-radius-md);
    color: var(--sm-text-strong);
    font-size: var(--sm-text-sm);
    transition: border-color var(--sm-transition);
}

.sm-text-input__control:disabled {
    background: var(--sm-neutral-100);
    cursor: not-allowed;
}

.sm-text-input__control--invalid {
    border-color: var(--sm-error);
}

.sm-text-input__error {
    color: var(--sm-error);
    font-size: var(--sm-text-sm);
}
</style>

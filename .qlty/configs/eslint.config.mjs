import typeChecked from '@sinemacula/coding-standards/js/eslint/type-checked';
import vue from '@sinemacula/coding-standards/js/eslint/vue';

// This is a TypeScript + Vue framework, so it runs the type-aware layer (which
// spreads the base) and the SFC layer on top of it.
export default [
    ...typeChecked,
    ...vue,
    {
        // Test files legitimately define several fixture components; the
        // one-per-file rule guards production SFC organisation, not fixtures.
        files: ['**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '**/__tests__/**', '**/tests/**'],
        rules: {
            'vue/one-component-per-file': 'off',
        },
    },
];

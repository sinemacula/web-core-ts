import sm from '@sinemacula/coding-standards/js/eslint';

export default [
    ...sm,
    {
        // Test files legitimately throw the base Error in stubs and failure
        // simulations, where a domain subclass adds nothing.
        files: ['**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
        rules: {
            '@sinemacula/no-base-error': 'off',
        },
    },
];

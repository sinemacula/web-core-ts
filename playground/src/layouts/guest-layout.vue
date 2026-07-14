<!--
    Unauthenticated layout: a single centred column.

    @author Ben Carey <bdmc@sinemacula.co.uk>
    @copyright 2026 Sine Macula Limited
-->

<template>
    <div class="guest-layout">
        <div class="guest-layout__panel">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.guest-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--sm-space-8) var(--sm-space-4);
}

.guest-layout__panel {
    width: 100%;
    max-width: 28rem;
}
</style>

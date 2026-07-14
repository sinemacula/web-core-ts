/**
 * Application entry point.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

// Side-effect import: registers the Tailwind layer and theme tokens with the bundler.
import '@/assets/styles/app.css';

import { startApplication } from '@/bootstrap/application';

const MOUNT_SELECTOR = '#app';

startApplication(MOUNT_SELECTOR).catch((error: unknown) => {
    console.error('Application failed to start.', error);

    const mount = document.querySelector(MOUNT_SELECTOR);

    if (mount === null) {
        return;
    }

    const detail = import.meta.env.DEV && error instanceof Error ? `<p>${error.message}</p>` : '';

    mount.innerHTML = `<div style="padding:2rem;font-family:sans-serif"><strong>The application could not start.</strong>${detail}</div>`;
});

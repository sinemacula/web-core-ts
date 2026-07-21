/**
 * Generate self-contained static HTTP error pages into the build output.
 *
 * A single-page app on static hosting cannot render its in-app error views when
 * the failure happens before the app boots (origin/edge 5xx, malformed
 * requests). These pages cover those codes with fully self-contained HTML - all
 * CSS inlined (the shared design tokens plus a small layout layer), no external
 * stylesheet, font, script or asset reference, since during an outage the
 * hashed `assets/*` are exactly what may be failing. They honour the stored
 * colour-scheme preference and the OS scheme through the same mechanism the app
 * uses (the pre-paint boot script plus the token stylesheet's media query).
 *
 * The set follows the codes a static host can serve a custom page for,
 * including 404: a deep link is normally rewritten to the app and its in-layout
 * not-found view handles it, but the static page is the fallback for when the
 * application script itself fails to load.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const themeStylesheet = join(appRoot, 'src', 'assets', 'styles', 'theme.css');
const outputDir = join(appRoot, 'dist', 'errors');

/** The pre-paint scheme stamp, a verbatim copy of the kernel boot script. */
const bootScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

/** The status codes that need a self-contained page, with their copy. */
const errorPages = {
    400: { title: 'Bad Request', message: 'The server could not understand the request.' },
    403: { title: 'Forbidden', message: 'You do not have permission to view this page.' },
    404: { title: 'Not Found', message: 'The page you are looking for could not be found.' },
    405: { title: 'Method Not Allowed', message: 'That request method is not allowed here.' },
    414: { title: 'URI Too Long', message: 'The request address is too long to process.' },
    416: { title: 'Range Not Satisfiable', message: 'The requested range cannot be served.' },
    500: { title: 'Internal Server Error', message: 'Something went wrong on our end.' },
    501: { title: 'Not Implemented', message: 'The server does not support this request.' },
    502: { title: 'Bad Gateway', message: 'The server received an invalid response upstream.' },
    503: { title: 'Service Unavailable', message: 'The service is temporarily unavailable. Please try again shortly.' },
    504: { title: 'Gateway Timeout', message: 'The upstream server took too long to respond.' },
};

/** The layout layer, built on the inlined design tokens. */
const layoutStyles = `
        *,
        *::before,
        *::after {
            box-sizing: border-box;
        }

        * {
            margin: 0;
        }

        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: var(--sm-space-6);
            background: var(--sm-surface-page);
            color: var(--sm-text-body);
            font-family: var(--sm-font-sans);
            font-size: var(--sm-text-base);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .error {
            max-width: 32rem;
            text-align: center;
        }

        .error__code {
            font-size: 4rem;
            font-weight: 700;
            line-height: 1;
            color: var(--sm-accent);
        }

        .error__title {
            margin-top: var(--sm-space-4);
            font-size: var(--sm-text-xl);
            font-weight: 700;
            color: var(--sm-text-strong);
        }

        .error__message {
            margin-top: var(--sm-space-3);
            color: var(--sm-text-muted);
        }

        .error__home {
            display: inline-block;
            margin-top: var(--sm-space-6);
            color: var(--sm-accent);
            font-weight: 500;
            text-decoration: none;
        }

        .error__home:hover {
            text-decoration: underline;
        }

        :focus-visible {
            outline: var(--sm-focus-ring);
            outline-offset: var(--sm-focus-offset);
        }`;

/**
 * Render one self-contained error page.
 *
 * @param code - the HTTP status code
 * @param page - the page copy
 * @param tokens - the design-token stylesheet, inlined verbatim
 * @returns the complete HTML document
 */
function renderErrorPage(code, page, tokens) {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#f8fafc" />
        <title>${code} ${page.title}</title>
        <script>${bootScript}</script>
        <style>
${tokens}
${layoutStyles}
        </style>
    </head>
    <body>
        <main class="error">
            <p class="error__code">${code}</p>
            <h1 class="error__title">${page.title}</h1>
            <p class="error__message">${page.message}</p>
            <a class="error__home" href="/">Return to the homepage</a>
        </main>
    </body>
</html>
`;
}

const tokens = readFileSync(themeStylesheet, 'utf8').trimEnd();

mkdirSync(outputDir, { recursive: true });

for (const code of Object.keys(errorPages)) {
    writeFileSync(join(outputDir, `${code}.html`), renderErrorPage(code, errorPages[code], tokens));
}

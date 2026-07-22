/**
 * Web location of the runtime environment document.
 *
 * Deployed artifacts are environment-agnostic: the deploy pipeline renders
 * `runtime-env.json` next to the artifact (served with no-store caching), and
 * the application fetches it before mounting. The loader itself lives in the
 * base; this constant carries the web serving convention.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

/**
 * Default URL of the runtime environment document served next to the artifact.
 */
export const RUNTIME_ENVIRONMENT_URL = '/runtime-env.json';

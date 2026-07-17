/**
 * Render the runtime environment document for a deployment.
 *
 * The build artifact is environment-agnostic; this script materialises the
 * environment at deploy time. The pipeline runs it with the target
 * environment's variables and uploads the output next to the artifact:
 *
 *   node scripts/generate-runtime-env.mjs > runtime-env.json
 *   aws s3 cp runtime-env.json "s3://${BUCKET}/runtime-env.json" \
 *     --cache-control no-store
 *
 * Only the keys listed in RUNTIME_ENV_KEYS are exposed - never dump the full
 * environment into a public file.
 *
 * APP_VERSION contract: the update monitor diffs this value to detect new
 * deployments, so every deploy MUST set it to a value that changes per release
 * (derive it, do not hard-code it), e.g.:
 *
 *   APP_VERSION=$(git rev-parse --short HEAD) \
 *     node scripts/generate-runtime-env.mjs > runtime-env.json
 *
 * A constant APP_VERSION silently disables update detection.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

const DEFAULT_KEYS = [
    'APP_ENV',
    'APP_VERSION',
    'API_URL',
    'APP_URL',
    'STATIC_URL',
    'STREAM_URL',
    'DEFAULT_LOCALE',
    'ENABLED_LOCALES',
    'FEATURE_FLAGS',
    'SEGMENT_WRITE_KEY',
    'SENTRY_DSN',
];

const keys =
    (process.env.RUNTIME_ENV_KEYS ?? '').trim() === ''
        ? DEFAULT_KEYS
        : (process.env.RUNTIME_ENV_KEYS ?? '').split(/\s+/u);

const values = {};

for (const key of keys) {
    const value = process.env[key];

    if (value !== undefined && value !== '') {
        values[key] = value;
    }
}

process.stdout.write(`${JSON.stringify(values, null, 4)}\n`);

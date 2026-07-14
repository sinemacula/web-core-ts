# Playground

The reference application and development harness for [`@sinemacula/web-core`](../README.md).

This workspace is a complete Vue 3 SPA built on the kernel. It exists for three reasons:

- **Reference consumer.** It depends on the kernel through the real package name and exports map, so every
  import specifier here is exactly what an external consumer writes. When the kernel changes shape, this app
  is the first thing that breaks.
- **Permanent integration harness.** The Playwright end-to-end suite (`e2e/` at the repository root) and the
  size-limit budgets run against this app, so the kernel is continuously proven inside a real boot sequence,
  router and production build - not only unit tests.
- **Development harness.** `npm run dev` at the repository root serves this app, giving kernel work an
  immediate, clickable surface.

The package is private and never published.

## Running it

All scripts run from the repository root; `dev`, `build`, `preview` and `size` proxy to this workspace.

| Script (repo root)  | Purpose                                             |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Vite dev server for this app                        |
| `npm run build`     | Production build to `playground/dist/`              |
| `npm run preview`   | Serve the production build locally                  |
| `npm run test:e2e`  | Playwright end-to-end suite against this app        |
| `npm run size`      | size-limit budgets over the built `dist/assets/*`   |

The root `typecheck`, `test`, `test:coverage`, `test:mutation`, `check` and `deadcode` scripts cover this
workspace's source alongside the kernel's.

```bash
nvm use                              # Node 24
npm install                          # from the repo root
cp playground/.env.example playground/.env
npm run dev
```

## How it consumes the kernel

`package.json` declares `"@sinemacula/web-core": "file:.."`. npm links the repository root as a real
dependency, resolved through the kernel's actual `exports` map, so imports here are what a consuming app
writes:

```ts
import { FetchHttpClient } from '@sinemacula/web-core/http/fetch-http-client';
```

There are no barrel files - every kernel import is a subpath. The `@/*` alias resolves to this app's own
`src/` only (`vite.config.ts`).

## Layout

```text
index.html                  Vite entry document
public/                     Static assets copied verbatim into the artifact
scripts/
  generate-runtime-env.mjs  Renders runtime-env.json at deploy time
src/
  main.ts                   Entry point and composition root - one createWebCoreApp call, then mount
  App.vue                   Application root: router outlet, progress, error panel, notification hosts
  assets/                   Global styles (theme tokens + app layer)
  config/                   Laravel-style typed configuration definitions
  services/                 App-typed wrappers over the kernel service accessors: config(), api(), ...
  modules/                  Feature modules: routes + views + stores + services + locales
  layouts/                  Page chrome
  locales/                  Shared translations (lazy-loaded)
  components/               App-level hosts (toasts, confirm dialogs, navigation progress) and ui/ primitives
  forms/                    Typed form schemas and server-error mapping
  test-support/             Unit-test fakes and seams: HTTP client, network guard, session-context installer
```

For what lives in the kernel itself, see the [root README](../README.md).

## Boot sequence

`src/main.ts` is the whole composition root: one `createWebCoreApp` call, then `app.start('#app')`. The phase
sequence - runtime environment, configuration, services, module lifecycle, i18n, router, observability,
monitors - is kernel-owned and documented in the
[root README](../README.md#bootstrapping-an-application); this app supplies only its own inputs:

- **Configuration** - `createWebEnvironment` over the fetched `/runtime-env.json`. In development, `VITE_*`
  variables are chained behind the runtime document as a fallback; in production the document must contain
  every key in `REQUIRED_RUNTIME_KEYS` (`src/config/runtime.ts`) or boot fails loudly. `defineConfiguration`
  (`src/config/*`) shapes the frozen tree read back through `config()`.
- **Modules** - `[createSessionModule(), ...modules]`: the kernel session module with every default (this
  app is the reference those defaults mirror) ahead of the explicit module list in `src/modules/index.ts`.
- **Locales** - the shared loaders and datetime/number formats from `src/locales/`.
- **Application copy** - the two toast keys the kernel never defaults: `common.states.error` for unexpected
  HTTP failures and `common.updates.available` for the update monitor.

A failed boot renders a static message into the mount node instead of mounting. `src/boot.test.ts` pins what
is app-specific about this composition by driving `createWebCoreApp` through the kernel's platform seams
(fake fetch, memory storage, memory history); the phase machinery itself is covered by the kernel's own
suite.

## Configuration (runtime, not build time)

Deployed artifacts are environment-agnostic. The app fetches `/runtime-env.json` before mounting; the deploy
pipeline renders that file per environment (`scripts/generate-runtime-env.mjs`) and uploads it next to the
artifact with `Cache-Control: no-store`. Locally, Vite's `.env` (`VITE_*`, see `.env.example`) fills the same
keys through the environment chain. Application code never reads either directly - it reads `config()`:

```ts
import { config, configValue } from '@/services/config';

config().app.urls.api;       // fully typed
configValue('app.urls.api'); // dot-notation, for dynamic access
```

Only the keys allow-listed in `generate-runtime-env.mjs` are ever exposed - never the full environment. One
key carries a contract: `APP_VERSION` must change on every release (derive it from the commit, do not
hard-code it), because the update monitor diffs it to detect new deployments. A constant value silently
disables update detection.

## Adding a feature module

1. Create `src/modules/<name>/` with `module.ts`, `routes.ts`, `route-names.ts`, and `views/`.
2. Declare middleware on routes via `meta.middleware` (`authenticated()`, `guestOnly()`, `authorize(...)`).
3. Add translations under `locales/` and register their loaders in `module.ts` - messages are namespaced
   under the module name automatically.
4. Register the module in `src/modules/index.ts`. That is the only registration step - there is no filesystem
   magic, and declaration order is the effective order except that the module marked `fallback: true` (the
   errors module - it owns the catch-all route) is always ordered last by the registry.
5. Modules that need more than routes and translations declare it on the definition: `guards` for global
   navigation middleware, `stores` for eagerly-instantiated pinia stores, `register` to contribute HTTP
   machinery, `boot` for runtime effects with a teardown. See the module contract in the
   [root README](../README.md#modules).
6. Cross-module imports go through a module's public surface (`<module>/index.ts`), never into its internals.

## What is demo material

The `auth` module is the reference login flow: the login view, form composable and locale copy over the
kernel session module, whose generic machinery (store, guards, token refresh, redirect handling) it
re-exports through `auth/index.ts` under the app's established names (`useAuthStore`, `authenticated`, ...).
The `errors` module is the reference forbidden and not-found handling, owning the application catch-all
through its `fallback` marker. The `users` and `dashboard` modules are demonstration content - an
authenticated landing view and a query-backed list that give the end-to-end suite realistic pages to
exercise. A real application would adapt the former and replace the latter.

## End-to-end tests

`e2e/` at the repository root drives this app with Playwright (`npm run test:e2e`). Locally the suite runs
against the Vite dev server; in CI it runs against a production build served by `vite preview` with a rendered
`runtime-env.json`, so it exercises the same artifact that ships. The API is never assumed to exist: specs
stub the network at the browser boundary (`e2e/support/api-mock.ts`).

## Size budgets

Budgets are defined in this workspace's `package.json` and measured over the built output, so run
`npm run build` first:

| Budget                 | Limit  |
|------------------------|--------|
| application js (gzip)  | 150 KB |
| application css (gzip) | 25 KB  |

## Deployment

Guidance for applications built on the framework; the playground itself is not deployed anywhere.

`npm run build` produces a static, environment-agnostic artifact in `dist/` that is promoted unchanged
between environments - for example S3 behind CloudFront. Requirements on the distribution:

- SPA fallback: 403/404 rewritten to `/index.html` (history-mode routing).
- `/runtime-env.json` and `index.html` served with no caching; hashed `/assets/*` cached immutable.

Per environment, the pipeline renders and uploads the runtime document next to the artifact:

```bash
npm run build
APP_VERSION=$(git rev-parse --short HEAD) \
  node scripts/generate-runtime-env.mjs > runtime-env.json
aws s3 cp runtime-env.json "s3://${BUCKET}/runtime-env.json" --cache-control no-store
```

Hidden source maps are emitted (`build.sourcemap: 'hidden'`) for upload to an error reporter; they are never
referenced from the bundle, so readable source is not published.

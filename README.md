# Web Core

`@sinemacula/web-core` is the framework-agnostic kernel on which Sine Macula web applications are built. It
provides the cross-cutting concerns every frontend needs - configuration, HTTP, routing, modules, i18n, storage
and more - as small, port-driven TypeScript units with no product code and no UI.

The repository root is the package: `src/` is the published kernel source. The repository is also the
**reference architecture** for consuming frontends - the playground application under `playground/` shows how a
real product wires the kernel, and is the template consuming apps follow.

## What lives here

| Area                 | What it provides                                                                                                              | Port / service                    | Vue       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------- |
| `src/activity/`      | Detects when the user has stopped interacting, for policies like auto-logout                                                  | `IdleMonitor` (no port)           | no        |
| `src/analytics/`     | Records product events through a swappable tracker (console + no-op adapters)                                                 | `AnalyticsTracker`                | type-only |
| `src/app/`           | The composition root: `createWebCoreApp` wires every subsystem in order, plus the service holders and accessors               | `createWebCoreApp`                | runtime   |
| `src/authorization/` | Evaluates flat permission grants with wildcard-prefix matching                                                                | `PermissionSet` (no port)         | no        |
| `src/composables/`   | Reusable Vue composables: focus trap, pagination, route-query state                                                           | -                                 | runtime   |
| `src/config/`        | Reads typed configuration from the environment and freezes it into a repository                                               | `EnvironmentSource`               | no        |
| `src/connectivity/`  | Tracks browser online/offline and notifies subscribers on change                                                              | `ConnectivityMonitor` (no port)   | no        |
| `src/feature-flags/` | Resolves feature flags through a swappable provider (static adapter + `useFeatureFlag`)                                       | `FeatureFlags`                    | runtime   |
| `src/http/`          | HTTP client: a fetch adapter behind a port, a typed error hierarchy, and bearer-token attach + refresh-and-retry              | `HttpClient`                      | no        |
| `src/i18n/`          | Detects and persists the active locale, wires vue-i18n, and syncs the document title                                          | `LocaleSwitcher` (service)        | runtime   |
| `src/logging/`       | A minimal logging port with console and no-op adapters                                                                        | `Logger`                          | no        |
| `src/module/`        | The feature-module contract and the registry that validates, orders, boots and collects messages from modules                 | `ModuleDefinition` (contract)     | type-only |
| `src/notifications/` | Toast and confirm-dialog services - state and lifecycle only; rendering stays app-side                                        | `ToastService` / `ConfirmService` | runtime   |
| `src/query/`         | Resource queries: the `ApiQuery` builder, a typed filter DSL, envelope mapping, `ResourceClient`, and list-query composables  | `ResourceClient` (service)        | runtime   |
| `src/realtime/`      | Live connections behind a port: WebSocket and EventSource adapters sharing exponential-backoff reconnect                      | `RealtimeConnection`              | no        |
| `src/reporting/`     | Error reporting through a swappable reporter, a breadcrumb trail, and a global error-handler installer                        | `ErrorReporter`                   | type-only |
| `src/router/`        | Navigation: a middleware contract + pipeline, router factory, route-meta typing, chunk-load recovery, and navigation progress | `RouteMiddleware` (contract)      | runtime   |
| `src/session/`       | The opt-in session module: bearer-auth store, route guards, token refresh, redirect handling, and a default `/auth` gateway   | `SessionApi`                      | runtime   |
| `src/storage/`       | A synchronous key-value storage port with browser, in-memory and key-namespacing adapters                                     | `KeyValueStorage`                 | no        |
| `src/support/`       | Small shared utilities (`deepFreeze`, `isRecord`, clipboard) and the `ServiceHolder` singleton primitive                      | -                                 | no        |
| `src/updates/`       | Polls the deployed runtime document for a new release and notifies when one appears                                           | `UpdateMonitor` (no port)         | no        |

## Installation

```bash
npm install @sinemacula/web-core vue vue-router vue-i18n pinia
```

`vue`, `vue-router`, `vue-i18n` and `pinia` are peer dependencies - install them alongside the kernel. The package
is ESM-only and ships compiled `dist/` with type declarations.

## Import style

No barrel exports. Import the file you need, by its full subpath:

```ts
import { FetchHttpClient } from '@sinemacula/web-core/http/fetch-http-client';
```

Inside this repository the exports map (`"./*": "./src/*.ts"`) resolves every subpath directly to its source file,
so the playground consumes the kernel with no build step. The published package remaps the same wildcard to
compiled output (`"./*": { "types": "./dist/*.d.ts", "import": "./dist/*.js" }`); import specifiers are identical
either way. `vue`, `vue-router`, `vue-i18n` and `pinia` are peer dependencies; the framework-agnostic areas (http,
storage, config, ...) never import them.

## Modules

An application is composed of feature modules. A module is a plain object satisfying `ModuleDefinition`
(`src/module/module.ts`); the application owns an explicit, ordered array of them and hands it to
`createWebCoreApp` - no filesystem magic, no auto-imports.

| Field      | Semantics                                                                                  |
|------------|--------------------------------------------------------------------------------------------|
| `name`     | Required. Unique across the registry (duplicates throw); also the translation namespace    |
| `routes`   | Required. Routes contributed to the application router, in registry order                  |
| `locales`  | Optional loader resolving the module's translations for one locale, null when not provided |
| `guards`   | Optional global middleware, run on every navigation before route-level `meta.middleware`   |
| `stores`   | Optional store hooks instantiated eagerly at the stores phase, in registry order           |
| `register` | Optional synchronous hook contributing HTTP machinery before the client is built           |
| `boot`     | Optional post-router, pre-mount hook for runtime effects; may return a teardown            |
| `fallback` | Optional marker: this module owns the application catch-all; the registry orders it last   |

The field semantics in full: `locales` messages land under the `name` namespace (build a loader from an
import map with `createLocaleLoader`). `guards` run in registry order, and instances may be created at
module-definition time provided they defer all store and service access to `handle()`. A `stores` entry is
`(pinia) => { $dispose() }` - a `defineStore` hook fits directly - instantiated after pinia and storage
install and before i18n and the router. `boot` receives the full runtime context (app, router, pinia, i18n,
http, storage, config, platform seams). `fallback` may be declared by at most one module, and keeping the
catch-all last within that module's own `routes` array remains the module's responsibility.

`createModuleRegistry` (`src/module/module-registry.ts`) validates the list and fixes the effective order:
declaration order, with the (at most one) `fallback` module moved last. A duplicated name throws a
`ModuleRegistryError` listing every duplicate; more than one fallback throws naming each of them. The preset
calls it for you - applications only maintain the array.

The lifecycle then runs in registry order. `register` hooks execute first, after configuration, storage,
notifications and observability are installed but before the HTTP client, stores, i18n and router exist,
each receiving a `ModuleHttpRegistrar` whose contributions feed the HTTP client's construction:
`addRequestInterceptor` (appended after preset-level interceptors, in registry order),
`addResponseErrorHandler` (run after the preset's handler, in registry order), and `setUnauthorizedHandler` -
a single slot registry-wide, one refresh authority per application; a second call throws naming both
contributing modules. `stores` factories run next, and `boot` hooks last. Teardown is composed the other way:
every teardown a `boot` returned disposes in LIFO order (a boot rejection tears down the already-booted
modules and rethrows), followed by each store's `$dispose`, all folded into the application handle's
`dispose()`.

`collectModuleRoutes`, `collectModuleGuards` and `createModuleMessageSource` (parallel, memoised per locale)
flatten a registry's contributions; the preset threads them so applications rarely call them directly.

## Bootstrapping an application

`createWebCoreApp` (`src/app/create-web-core-app.ts`) assembles a complete application from the kernel: it
fetches the runtime environment document, freezes the configuration, installs every service singleton, runs
the module lifecycle and wires i18n, routing, observability, chunk recovery, realtime and the release
monitors - in a fixed phase order that makes the boot's implicit constraints structural (notifications and
observability before the HTTP client, storage before stores, stores before i18n and the router).

The application's configuration definition must structurally satisfy `WebCoreConfig`
(`src/app/web-core-config.ts`) - the slice the preset reads: `api.baseUrl`/`api.timeout`,
`app.name`/`app.environment`/`app.version`, `featureFlags.flags` and
`locales.default`/`locales.enabled`/`locales.supported`. Applications define richer trees around it.

### Options

Top-level: `root` (the component mounted by `start()`), `modules` (the explicit ordered module list) and an
optional `pinia` instance (injectable for tests; defaults to a fresh one). Everything else is grouped:

| Group           | Configures                                                                                     |
|-----------------|------------------------------------------------------------------------------------------------|
| `config`        | `createEnvironment` + `define` + `runtimeUrl` - environment construction and the frozen tree   |
| `http`          | `interceptors`, `onResponseError`, `unexpectedErrorToastKey`, `client` - the HTTP client build |
| `i18n`          | `sharedLoaders`, `formats`, `localeStorageKey`, `duplicateNamespaceStrategy`                   |
| `observability` | `reporter` / `analytics` / `logger` adapter factories over the frozen config                   |
| `featureFlags`  | Provider factory; defaults to the static adapter over `featureFlags.flags`                     |
| `realtime`      | Opt-in connection factory; installed into the realtime holder, disconnected on dispose         |
| `notifications` | `toasts` / `confirm` service instances - state only, rendering hosts stay application-side     |
| `monitors`      | `updates`, `connectivity` and `chunkRecovery` - release monitoring and chunk-load recovery     |
| `platform`      | `fetchFn`, `storage`, `targetWindow`, `targetDocument`, `clock`, `history`, `localeCandidates` |

The load-bearing defaults and behaviours:

- `config.createEnvironment` is caller-owned - the only place build-time variables may appear. It receives
  the fetched runtime document; pair it with `createWebEnvironment` (`src/config/web-environment.ts`), which
  chains the prefixed build-time variables behind the runtime document in development and, in production,
  throws a `ConfigurationError` naming every missing `requiredKeys` entry. `config.runtimeUrl` (default
  `/runtime-env.json`) is one URL for both the runtime-environment fetch and the update monitor's default
  poll target.
- `http.unexpectedErrorToastKey` arms the default response-error handler: it skips validation failures and
  401s, raises the application's toast and captures the error with request context. Without it (and without
  an `onResponseError` override) unexpected failures are captured only. The key is application copy - the
  kernel ships no translation keys. Module register-phase contributions always run after the resolved
  handler.
- `i18n.localeStorageKey` defaults to `locale`; `duplicateNamespaceStrategy` defaults to `error` - a module
  name shadowing a shared top-level translation key throws at activation, and `module-wins` restores the
  shadowing merge.
- Without `observability` factories, the local environment gets console adapters and every other environment
  gets the null adapters; a factory receives the full frozen config so adapter selection is config-driven.
- `monitors.updates` runs by default when `app.version` is not the `dev` sentinel, but only arms when
  `toastKey` (an application-owned sticky-toast key) or `onUpdate` is provided; enabling it explicitly with
  neither throws a `WebCoreAppError` at boot. `monitors.connectivity` defaults to on exactly when the update
  monitor runs and pauses its polling while offline. `monitors.chunkRecovery` is on by default.
- The `platform` seams thread to every subsystem and to module hooks (as `ResolvedPlatform`), which is how
  tests drive the full boot: fake fetch, `MemoryStorage`, `createMemoryHistory`, a detached document, a fixed
  clock and an injected pinia.

### Entry point

The whole composition root is one call. The canonical example is the playground's entry
(`playground/src/main.ts`), shown here with its imports de-aliased:

```ts
import { createWebCoreApp } from '@sinemacula/web-core/app/create-web-core-app';
import { createWebEnvironment } from '@sinemacula/web-core/config/web-environment';
import { createSessionModule } from '@sinemacula/web-core/session/create-session-module';

import App from './App.vue';
import { defineConfiguration } from './config';
import { REQUIRED_RUNTIME_KEYS } from './config/runtime';
import { sharedLocaleLoaders } from './locales';
import { localeFormats } from './locales/formats';
import { modules } from './modules';

async function start(): Promise<void> {
    const app = await createWebCoreApp({
        root: App,
        modules: [createSessionModule(), ...modules],
        config: {
            createEnvironment: runtime =>
                createWebEnvironment({
                    runtime,
                    dev: import.meta.env.DEV,
                    buildTimeEnv: import.meta.env,
                    requiredKeys: REQUIRED_RUNTIME_KEYS,
                }),
            define: defineConfiguration,
        },
        http: { unexpectedErrorToastKey: 'common.states.error' },
        i18n: { sharedLoaders: sharedLocaleLoaders, formats: localeFormats },
        monitors: { updates: { toastKey: 'common.updates.available' } },
    });

    await app.start('#app');
}

start().catch(() => {
    // Render a static boot-failure message; nothing has mounted.
});
```

`import.meta.env` appears only here, as input to the caller-supplied `createEnvironment` - no kernel file
evaluates it. The two translation keys are application copy passed as options.

### start() and dispose()

`createWebCoreApp` resolves once every phase has run; nothing is mounted yet. `start(selector?)` awaits
`router.isReady()` and then mounts (default `#app`), so initialisation completes strictly before any
component renders. The handle also exposes the assembled `app`, `router`, `pinia` and `i18n`, the frozen
`config` tree, direct typed references to every installed service under `services`, and the started
`monitors` - tests never need ambient access.

`dispose()` idempotently tears down everything the boot installed, in reverse: monitors, realtime disconnect,
chunk recovery, module boot teardowns, store disposals, then the page-tracking, global-error-handling and
title-sync uninstalls. Service holders are left installed; `resetWebCoreServices()` is the separate test
affordance.

### Service accessors

The preset installs every service into a kernel-standard holder (`src/app/services.ts`). Components, stores
and module services read them through typed accessors; each throws until its `install*` counterpart has run,
which the boot guarantees happens before mount:

| Accessor                   | Service                                                               |
|----------------------------|-----------------------------------------------------------------------|
| `appConfig<T>()`           | The frozen configuration tree, cast to the application's shape        |
| `appConfigRepository<T>()` | The configuration repository (dot-notation `get`)                     |
| `api()`                    | The HTTP client                                                       |
| `appStorage()`             | The key-value storage adapter                                         |
| `toasts()`                 | The toast service                                                     |
| `confirmDialogs()`         | The confirmation dialog service                                       |
| `reporting()`              | The error reporter                                                    |
| `analytics()`              | The analytics tracker                                                 |
| `logger()`                 | The logger                                                            |
| `featureFlags()`           | The feature-flag adapter                                              |
| `localeSwitcher()`         | The locale switcher                                                   |
| `realtime()`               | The realtime connection (installed only when the application opts in) |

`appConfig<T>()` keeps configuration app-typed through its generic - the playground wraps it once
(`config()` in `playground/src/services/config.ts`) and every other accessor is used as-is.
`resetWebCoreServices()` clears every holder between tests.

### Session module

`createSessionModule` (`src/session/create-session-module.ts`) returns a plain `ModuleDefinition` - session
support is opt-in and self-installs through the module contract, with no preset special case. At register it
installs the session context and contributes the bearer-token interceptor plus the single unauthorized
handler (a `TokenRefreshCoordinator`, so the reactive 401 path and the proactive refresh timer can never
race); at the stores phase the session store hydrates from storage; at boot it wires cross-tab session
mirroring, proactive refresh ahead of expiry, the session-loss redirect (login route plus the sanitised
current path under the `redirect` query key) and identity fan-out to the reporting, analytics and
feature-flag holders.

Every option defaults to the reference application's behaviour: `name` (`session`), `storeId` (`auth`),
`api` (the default gateway - `POST`/`PATCH`/`DELETE` on `auth`, `GET users/self`, a `{ data }` envelope and
UTC `YYYY-MM-DD HH:MM:SS` expiry timestamps, each injectable via `endpoints`, `parseTimestamp`, `unwrap` and
`mapUser` in `createDefaultSessionApi`), `storageKeys`, `routes`, `refreshSkewMs` (60 seconds), `deviceOs`
(`WEB`), `generateUuid`, the `crossTabSync`/`proactiveRefresh`/`sessionLossRedirect` toggles (all true) and
`identity` (per-channel mappings, or `false` to disable).

The storage keys are a public contract - live sessions persist under them, so renaming any is a breaking
change requiring an explicit migration:

| Key            | Default              |
|----------------|----------------------|
| `accessToken`  | `auth.access_token`  |
| `refreshToken` | `auth.refresh_token` |
| `expiresAt`    | `auth.expires_at`    |
| `deviceUuid`   | `auth.device_uuid`   |

Keys are matched raw against cross-tab `storage` events, so the storage adapter must persist un-namespaced;
an application wanting a prefix sets it in the keys themselves so event keys still match.

Route identity is one configurable source feeding the guards, the session-loss redirect and the redirect
sanitiser's loop guard: `login` (`{ name: 'auth.login' }`), `loginPath` (`/login` - set together with `login`
when renaming), `home` (`/`) and `forbidden` (`/forbidden` - the application's fallback module owns the
page).

What stays application-side: the login route and view, the credential form, all locale copy, and the user
field mapping when the wire shape diverges (`mapUser`). Applications guard routes with `authenticated()`,
`guestOnly()` and `authorize()` from `src/session/middleware.ts`, check permissions with `can()`/`useCan()`
from `src/session/authorization.ts`, and read session state through `useSessionStore()`.

## Design rules

- Every behavioural dependency is a port (interface); adapters are substituted in tests.
- No Vue component code in the kernel - it must stay usable by any Sine Macula frontend, whatever its shell.
- Tests are colocated (`*.test.ts`) and the package is covered to 100%.

## Recorded design decisions

- **Service access is application-singleton, not provide/inject.** The bootstrap preset installs kernel
  services into standard holders exposed as typed accessor singletons (`api()`, `toasts()`, ... in
  `src/app/services.ts`). Kernel-level `InjectionKey`s were considered and rejected: the accessor pattern
  keeps services usable outside component context (stores, middleware, plain modules), keeps the kernel
  Vue-optional for its agnostic layers, and makes test substitution explicit (`resetWebCoreServices()`).
  Holders are process-global by design - one application per page; SSR and multi-app scoping are out of
  scope. Revisit only if a consumer genuinely needs per-subtree service scoping.
- **Time is injected per class, not through a shared Clock port.** Each time-dependent unit accepts a
  `clock`/timer override where tests need determinism. A unifying Clock abstraction adds indirection without a
  consumer; introduce one only if cross-cutting time control (e.g. app-wide time travel) becomes a requirement.
- **No success-side response interceptors yet.** The error side has a seam (`onResponseError`); response header
  access and global response transforms wait for a concrete consumer (ETag caching, rate-limit surfacing) rather
  than being designed speculatively.

## Stack

| Concern   | Choice                                                            |
|-----------|-------------------------------------------------------------------|
| Framework | Vue 3 (Composition API) - vue/vue-router/vue-i18n/pinia as peers  |
| Language  | TypeScript, maximally strict                                      |
| Build     | mkdist (kernel -> `dist/`) + Vite (playground/apps)               |
| State     | Pinia - application module stores plus the kernel session store   |
| Routing   | Vue Router + Laravel-style middleware pipeline                    |
| i18n      | vue-i18n, lazily-loaded locales                                   |
| Styling   | Design tokens (`--sm-*` custom properties) + scoped CSS           |
| Tests     | Vitest (100% coverage enforced), Stryker mutation testing         |
| Quality   | qlty + Biome (sinemacula/coding-standards), Knip, security scans  |

## Repository layout

```text
src/           The kernel package source - one directory per area, tests colocated
playground/    Reference application + dev harness (@sinemacula/web-core-playground)
e2e/           Playwright suite driving the playground application
```

The playground consumes the kernel as `"@sinemacula/web-core": "file:.."` - a self-link resolved through the
package's real exports map, not a path alias. Its import specifiers are therefore exactly what an external
consumer writes, so the reference application doubles as a permanent integration test of the published surface.

For the application-side details - boot sequence, runtime environment mechanics, adding a feature module - see
[playground/README.md](playground/README.md).

## Getting started

```bash
nvm use                                      # Node 24
npm install
cp playground/.env.example playground/.env   # local development variables (VITE_*)
npm run dev
```

| Script                  | Purpose                                        |
|-------------------------|------------------------------------------------|
| `npm run dev`           | Playground dev server (Vite)                   |
| `npm run build`         | Playground production build                    |
| `npm run build:dist`    | Compile the kernel package to `dist/`          |
| `npm run preview`       | Preview the playground production build        |
| `npm run typecheck`     | `vue-tsc` over kernel + workspaces             |
| `npm run test`          | Unit tests (kernel + playground)               |
| `npm run test:watch`    | Unit tests in watch mode                       |
| `npm run test:coverage` | Unit tests with 100% thresholds                |
| `npm run test:mutation` | Stryker mutation testing                       |
| `npm run test:e2e`      | Playwright end-to-end suite                    |
| `npm run test:e2e:ui`   | Playwright end-to-end suite in UI mode         |
| `npm run check`         | qlty lint + security suite                     |
| `npm run fmt`           | qlty auto-format                               |
| `npm run smells`        | qlty duplication + complexity analysis         |
| `npm run deadcode`      | Knip dead-code detection                       |
| `npm run size`          | size-limit bundle budgets (playground build)   |
| `npm run check:pkg`     | Pack + validate the published surface          |

## Quality gates

- **Tests**: colocated `*.test.ts`, 100% line/branch/function/statement coverage enforced by `vitest` over
  `src/**` and `playground/src/**`.
- **Mutation**: Stryker over kernel + playground, 90% break threshold.
- **Lint/format**: Biome via qlty, rules from `sinemacula/coding-standards`.
- **Dead code**: Knip across all workspaces.
- **Bundle size**: size-limit budgets on the playground build.
- **Hooks**: `.qlty/hooks/` - format on pre-commit, check on pre-push.

## Releases

The package is published to npm from CI - never by hand.

- **Versioning**: release-please reads Conventional Commit history and maintains a standing Release PR that bumps
  `package.json` and `CHANGELOG.md`. Merging it tags the release and cuts a GitHub Release.
- **Publish**: the `v*` tag triggers the `npm-publish` workflow, which compiles `dist/` through the `prepack`
  lifecycle and runs `npm publish --provenance` under npm trusted publishing (OIDC - no token).
- **Local checks**: `npm run build:dist` compiles the package; `npm run check:pkg` packs it and validates the
  published surface with publint and are-the-types-wrong.

## Licence

Apache-2.0. Copyright Sine Macula Limited.

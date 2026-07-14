# Web Core

`@sinemacula/web-core` is the framework-agnostic kernel on which Sine Macula web applications are built. It
provides the cross-cutting concerns every frontend needs - configuration, HTTP, routing, modules, i18n, storage
and more - as small, port-driven TypeScript units with no product code and no UI.

The repository root is the package: `src/` is the published kernel source. The repository is also the
**reference architecture** for consuming frontends - the playground application under `playground/` shows how a
real product wires the kernel, and is the template consuming apps follow.

## What lives here

| Area                 | Contents                                                                                                     |
|----------------------|--------------------------------------------------------------------------------------------------------------|
| `src/activity/`      | User-idle detection (`IdleMonitor`) driving policy timeouts such as auto-logout                              |
| `src/analytics/`     | `AnalyticsTracker` port, console and null adapters, router page-tracking installer                           |
| `src/authorization/` | `PermissionSet`: flat permission grants with wildcard-prefix evaluation                                      |
| `src/composables/`   | Vue composables: focus trap, pagination, route-query state                                                   |
| `src/config/`        | Environment port + sources (runtime JSON, prefixed Vite vars, chain), typed reader, frozen config repository |
| `src/connectivity/`  | Network-connectivity monitor over the browser online/offline signals                                         |
| `src/feature-flags/` | `FeatureFlags` port, static adapter, `useFeatureFlag` composable                                             |
| `src/http/`          | `HttpClient` port, fetch adapter, error hierarchy, bearer-token interceptor, refresh coordinator             |
| `src/i18n/`          | Locale detection/persistence, vue-i18n wiring, document-title sync                                           |
| `src/logging/`       | `Logger` port with console and null adapters                                                                 |
| `src/module/`        | `ModuleDefinition` contract and registry helpers                                                             |
| `src/notifications/` | Toast and confirmation services: state and lifecycle only, rendering stays application-side                  |
| `src/query/`         | `ApiQuery` fluent builder, typed `ResourceClient`, response envelope, list-query composables                 |
| `src/realtime/`      | `RealtimeConnection` port, WebSocket and EventSource adapters, exponential backoff                           |
| `src/reporting/`     | `ErrorReporter` port, breadcrumb trail, global error-handler installer                                       |
| `src/router/`        | Middleware contract + pipeline, router factory, route-meta augmentation                                      |
| `src/storage/`       | `KeyValueStorage` port with browser and in-memory adapters                                                   |
| `src/support/`       | Small shared utilities (`deepFreeze`, `isRecord`)                                                            |
| `src/updates/`       | Deployed-version monitor polling for new releases                                                            |

## Import style

No barrel exports. Import the file you need, by its full subpath:

```ts
import { FetchHttpClient } from '@sinemacula/web-core/http/fetch-http-client';
```

The exports map (`"./*": "./src/*.ts"`) resolves every subpath directly to its source file. `vue`, `vue-router`
and `vue-i18n` are peer dependencies; the framework-agnostic areas (http, storage, config, ...) never import
them.

## Design rules

- Every behavioural dependency is a port (interface); adapters are substituted in tests.
- No Vue component code in the kernel - it must stay usable by any Sine Macula frontend, whatever its shell.
- Tests are colocated (`*.test.ts`) and the package is covered to 100%.

## Recorded design decisions

- **Service access is application-singleton, not provide/inject.** Applications wire kernel services through
  their composition root and expose them via typed accessor singletons (`config()`, `api()`, ...). Kernel-level
  `InjectionKey`s were considered and rejected: the accessor pattern keeps services usable outside component
  context (stores, middleware, plain modules), keeps the kernel Vue-optional for its agnostic layers, and makes
  test substitution explicit. Revisit only if a consumer genuinely needs per-subtree service scoping.
- **Time is injected per class, not through a shared Clock port.** Each time-dependent unit accepts a
  `clock`/timer override where tests need determinism. A unifying Clock abstraction adds indirection without a
  consumer; introduce one only if cross-cutting time control (e.g. app-wide time travel) becomes a requirement.
- **No success-side response interceptors yet.** The error side has a seam (`onResponseError`); response header
  access and global response transforms wait for a concrete consumer (ETag caching, rate-limit surfacing) rather
  than being designed speculatively.

## Stack

| Concern   | Choice                                                            |
|-----------|-------------------------------------------------------------------|
| Framework | Vue 3 (Composition API) - vue/vue-router/vue-i18n as peer deps    |
| Language  | TypeScript, maximally strict                                      |
| Build     | Vite                                                              |
| State     | Pinia, application-side - the kernel holds no global state        |
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

## Quality gates

- **Tests**: colocated `*.test.ts`, 100% line/branch/function/statement coverage enforced by `vitest` over
  `src/**` and `playground/src/**`.
- **Mutation**: Stryker over kernel + playground, 90% break threshold.
- **Lint/format**: Biome via qlty, rules from `sinemacula/coding-standards`.
- **Dead code**: Knip across all workspaces.
- **Bundle size**: size-limit budgets on the playground build.
- **Hooks**: `.qlty/hooks/` - format on pre-commit, check on pre-push.

## Licence

Apache-2.0. Copyright Sine Macula Limited.

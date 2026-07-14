# Contributing

## Workflow

1. Branch from `master` using the `{type}/{scope}` convention (e.g. `feat/users-table`, `fix/session-refresh`).
2. Keep every change green against the full gate suite before pushing:

   ```bash
   npm run typecheck
   npm run test:coverage   # 100% lines/branches/functions/statements is enforced
   npm run test:e2e
   npm run check           # qlty lint + security suite
   npm run deadcode
   npm run build
   ```

3. Commit with conventional-commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`...).
4. Open a pull request against `master`; CI plus Qlty Cloud gate the merge.

## Architecture rules

- The kernel (root `src/`) must remain product-agnostic and framework-boundary-clean: no Vue component code,
  ports-and-adapters at the edges. Product and application functionality belongs in `playground/`.
- No barrel files; consumers import the kernel by subpath (e.g. `@sinemacula/web-core/http/http-client`).
- Behaviour lives in plain TypeScript; Vue single-file components stay thin (template plus wiring).
- Cross-module imports between playground modules go through a module's public surface (top-level files such
  as `auth/middleware.ts`), never into its internals.
- Wire-format keys (snake_case) never appear as object-literal keys; use the `wire()` entry-tuple idiom.
- New behaviour ships with colocated tests; coverage thresholds are not negotiable.
- Styling uses the `--sm-*` design tokens; components never hard-code visual values.

## Quality tooling

Run everything through qlty (`npm run check`, `npm run fmt`) rather than invoking linters directly; the shared
configuration lives in `.qlty/` and is enforced by Qlty Cloud on every pull request.

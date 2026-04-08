# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React app. Key areas:
  - `pages/` route-level screens such as `Dashboard.tsx`, `Journal.tsx`, and `PropAccounts.tsx`
  - `components/` shared UI, modals, navigation, and tests
  - `lib/` store, Supabase helpers, sync logic, and utilities
  - `types/` shared TypeScript models
  - `data/` seeded app data
  - `test/` Vitest setup
- `src-tauri/` contains the Rust/Tauri desktop and Android wrapper code.
- `public/` holds static assets. `docs/` and `CODEX_HANDOFF.md` capture product context and recent decisions.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite web app locally.
- `npm run build` runs `tsc` and produces the production web bundle in `dist/`.
- `npx vitest run` executes all unit tests in `src/**/*.{test,spec}.{ts,tsx}`.
- `npm run tauri dev` launches the desktop app in Tauri dev mode.
- `npm run tauri build` creates desktop installers in `src-tauri/target/release/bundle/`.
- `npx tauri android build --debug` builds the Android debug APK in `src-tauri/gen/android/.../apk/`.

## Coding Style & Naming Conventions
- Match the existing TypeScript/React style: 2-space indentation, semicolons, and double quotes.
- Use the `@/` alias for imports from `src`.
- Components and pages use `PascalCase`; helpers and hooks use `camelCase`; tests use `*.test.tsx`.
- Keep UI changes consistent with the existing dark, operator-style shell instead of introducing isolated visual patterns.

## Testing Guidelines
- Tests use Vitest with `jsdom` and Testing Library via `src/test/setup.ts`.
- Add or update tests for shared logic in `lib/` and reusable UI behavior in `components/`.
- Prefer focused assertions over snapshot-heavy tests. Run `npx vitest run` before handing off non-trivial changes.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit pattern seen in history: `feat: ...`, `fix: ...`.
- Keep commits scoped to one change area when possible.
- PRs should include: a short behavior summary, affected platforms (`web`, `desktop`, `android`), test/build results, and screenshots for visible UI changes.

## Security & Configuration Tips
- Supabase keys live in `.env.local`; do not hardcode secrets in source files.
- Treat Tauri and sync changes carefully: verify both `src/` and `src-tauri/` behavior when modifying persistence, auth, or packaging.

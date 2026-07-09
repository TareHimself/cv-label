## Testing

- When adding or changing a component, add/update its unit tests (Vitest + Testing Library) alongside the change. When the change alters user-facing behavior, also update the relevant e2e spec/page object under `e2e/`.
- Do not run the full e2e suite (`pnpm test:e2e`) after every small change — it's slow and requires a build. Default to `pnpm typecheck`, `pnpm lint`, and the relevant unit tests (`pnpm test`). Only run e2e when explicitly asked, or when the change is significant enough (e.g. cross-page flows) that unit tests can't cover it.
- Unit tests should reuse existing constants and shared logic (e.g. shared fixtures, test helpers like `renderWithProviders`, page objects, existing utility/constant modules) instead of re-deriving or hardcoding values that already exist elsewhere in the codebase.

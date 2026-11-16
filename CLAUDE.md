# brobot-admin-ui — agent notes

Read `README.md` first. It covers the pages, the auth model and the overlay
contract. The superproject's `guidelines/PROJECT.md` still applies: its
Definition of Done, WCAG 2.2 AA, and no Playwright in fleet jobs.

- **Server-side features only.** Anything that acts on the streamer's machine
  belongs in `apps/brobot-client`. Do not add host-control UI here.
- **Keep the 2022 paths.** `/commands`, `/pokemon/team?username=`,
  `/pokemon/battleoutcome` and `/twitch/supahot/overlay` are posted by the bot
  and bookmarked in OBS.
- **The API's shapes are generated from brobot's registered document.**
  `src/app/core/generated/` is openapi-generator's output (`typescript-angular`
  7.18.0, models only) from `openapi.json` at the commit the `brobot` entry of
  `libs/contracts/documents.yaml` records. Never edit it; regenerate:
  `pnpm run generate:api` (Java 17+, and git or gh). `scripts/check-brobot-api.mjs`
  (in `typecheck`, `build` and `test`; no Java) fails on a hand edit, a changed
  pin or option, or a registry entry moved to another commit.
  `src/app/core/brobot-api.ts` gives the generated types the names the pages
  use and imports them with `import type` only.
- **`src/app/overlay/overlay-events.ts` is a verbatim copy** of brobot's
  `src/modules/twitch/overlay-events.ts`. Do not edit it here.
- **`lib-slide-toggle`'s `(change)` fires twice**: its boolean output, then
  the inner checkbox's native `change` event bubbling to the host. Handlers
  must ignore the non-boolean call (see `CommandsPage.setEnabled`).
- **ngx-ui translation keys need English** in `src/app/core/ui-strings.ts`.
  Otherwise the raw key becomes an accessible name.
- **Typecheck all three projects**: `tsconfig.app.json`, `tsconfig.spec.json`
  and `e2e/tsconfig.json`. `tsconfig.editor.json` exists only so eslint's
  type-aware rules can see every file.

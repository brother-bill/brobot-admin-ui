# brobot-admin-ui

The website for **bro_____bot**, the Twitch bot in `apps/brobot`: the chat
commands and their on/off switches, the Pokémon leaderboard, team search, the
last battles, and the stream overlay OBS shows on stream.

This is the 2026 rebuild of the 2022 Angular 15 + Material site, done in
place: Angular 21, zoneless, standalone components and signals, on the
monorepo's `libs/ngx-ui` (material look, dark) with brobot's palette. It
lives in the singularity monorepo as `apps/brobot-admin-ui` (package
`@singularity/brobot-admin-ui`). The migration charter is
`guidelines/brobot/migration-plan.md` in the superproject; this is ticket
**U1**.

**Server-side features only.** Anything that acts on the streamer's machine
(blocking Enter, muting the mic) is `apps/brobot-client`, the desktop app. The
overlay here only shows what the API sends it.

## Pages

| Path | Who | What |
|---|---|---|
| `/commands` (and `/`) | everyone | Every chat command, by category, and whether it is on. Admins get a switch per command (`POST /api/commands`). |
| `/pokemon/leaderboard` | everyone | Top 30 Pokémon by level, each linked to its trainer's team. |
| `/pokemon/team?username=` | everyone | Six slots of a viewer's team, looked up by Twitch login. The login is in the URL: it is the link `!pokemon team` posts. |
| `/pokemon/battleoutcome` | everyone | The logs of the last 1v1 and the last team battle. |
| `/login` | everyone | Sign in with Twitch. Admins also get the streamer and bot account links. |
| `/twitch/supahot/overlay` (and `/overlay`) | OBS | The browser source: transparent, no header, no session. |

The paths are the 2022 site's on purpose. The bot posts them in chat
(`apps/brobot/src/modules/twitch/ui-links.ts`), viewers have them bookmarked,
and OBS points at the overlay path.

"Admin" means the API's admin roles: `StreamerAuth` or `Admin`
(`src/app/core/brobot-api.ts`, `ADMIN_ROLES`). The API enforces that. The
site only decides what to show.

## Auth

brobot's session is a JWT pair in `httpOnly` cookies. It has the same shape
api-time issues, so **libs/ngx-auth's `authInterceptor`** is used unchanged.
It sends credentials on every request and answers a 401 with one refresh.
That refresh goes through the generated contracts client, whose base path is
set to brobot's `/api`, so it lands on brobot's `POST /api/auth/refresh`
alias (see `app.config.ts`).

ngx-auth's `AuthService` and guards are **not** used. They read api-time's
`/api/auth/current-user`, and nothing on this site needs a guard: every page
is public, and admin controls are hidden rather than routed away from.
`SessionService` asks brobot's `GET /api/auth/twitch/status` instead. It
asks through an `HttpBackend` client, so a signed-out viewer's 401 means
"signed out". Otherwise the interceptor would treat it as an error and
redirect to `/`.

- **Sign in** is a full-page link to `/api/auth/twitch/login`. Before
  leaving, the site stores the current path. The API's callback lands on `/`,
  and the site then returns the viewer to where they were.
- **Callback results:** the API appends `?auth_error=<reason>` or
  `?linked=streamer|bot` to the URL. The shell shows a banner for them and
  removes them from the URL (`core/auth-return.ts`).
- **Streamer / bot links** are admin-only buttons on `/login`. They never
  change who is signed in here.

## Strings from ngx-ui

ngx-ui labels a few controls with translation keys. For example, the alert
banner's dismiss button is `a11y.dismiss_alert`. The site is English-only, so
`core/ui-strings.ts` gives ngx-translate a small inline English table. Without
it, a screen reader would read the key itself. Add a key there when a new
ngx-ui component shows one.

## The stream overlay

OBS loads `/twitch/supahot/overlay` as a browser source. The page makes
`<html>` and `<body>` transparent itself, because the theme paints them. It
listens on `/api/admin-ui`, a receive-only socket with no secret. It
reconnects 3 s after any close, clean or not, and shows:

- `pokemon_roar`: the viewer's Pokémon and its name, with its cry. Roars
  queue and never overlap.
- `quack`: the duck sound.
- `vote_state` (**proposed; brobot does not send it yet**): a meter for a
  running `!chatban` / `!voiceban` vote. It turns orange when the threshold is
  reached. See `src/app/overlay/vote-state.ts` for the frame. Until the API
  sends it, no meter is drawn.

`overlay/overlay-events.ts` is a verbatim copy of brobot's
`src/modules/twitch/overlay-events.ts`. Refresh it when that file changes.
The page only ever sees the `OverlaySocket` interface
(`overlay/overlay-socket.ts`); the specs provide a fake one.

The card art and sounds still come from the 2022 Cloudinary set
(`environment.pokemonArtUrl` / `pokemonCryUrl`, and the duck in the overlay).
The migration plan names R2 as their future home. Moving them means changing
those URLs.

## Running it

```bash
pnpm run dev:brobot-admin-ui          # from the repo root; http://localhost:4207
```

`src/environments/environment.ts` expects the API on `http://localhost:3000`.
That API needs `http://localhost:4207` in `ALLOWED_ORIGINS`, and its
`UI_URL` must point here, so the Twitch callbacks come back to this site.
Production (`environment.prod.ts`) serves the site from `https://brobot.live`
and talks to `https://admin.brobot.live`.

## Checks

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm exec tsc --noEmit -p tsconfig.spec.json
pnpm exec tsc --noEmit -p e2e/tsconfig.json
pnpm run test                  # ng test --watch=false (vitest)
pnpm run build                 # production build, budgets enforced
pnpm run test:e2e              # Playwright smoke; the API is mocked with page.route
```

### Why the initial bundle is ~700 kB

The initial bundle is ~700 kB raw (~140 kB over the wire). The warning budget
is 750 kB. About 180 kB of that is the api-time contracts client. ngx-auth's
interceptor imports its `AuthService` from `@singularity/contracts/angular`,
and that barrel is consumed as source, so no generated service tree-shakes.
Another ~80 kB is ngx-ui's icon sprite. Both costs come from the shared libs,
and the fix belongs there: an ngx-auth refresh that does not go through the
generated client.

import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { ShellComponent } from './layout/shell.component';
import { OVERLAY_SOCKET, WebSocketOverlaySocket } from './overlay/overlay-socket';

/**
 * The paths are the 2022 site's: the bot posts `/commands`,
 * `/pokemon/team?username=` and `/pokemon/battleoutcome` in chat
 * (`apps/brobot/src/modules/twitch/ui-links.ts`), viewers have them
 * bookmarked, and OBS is pointed at `/twitch/supahot/overlay`.
 */
export const OVERLAY_PATH = 'twitch/supahot/overlay';

/** Keeps the query string: the Twitch callbacks land on `/` with `?auth_error=` / `?linked=`. */
const toCommands = ({ queryParams }: { queryParams: Record<string, unknown> }) =>
    inject(Router).createUrlTree(['/commands'], { queryParams });

export const routes: Routes = [
    {
        // The OBS browser source: no header, no session check, transparent page.
        path: OVERLAY_PATH,
        title: 'brobot overlay',
        providers: [
            {
                provide: OVERLAY_SOCKET,
                useFactory: () => new WebSocketOverlaySocket(environment.overlaySocketUrl),
            },
        ],
        loadComponent: () =>
            import('./overlay/stream-overlay.component').then(m => m.StreamOverlayComponent),
    },
    { path: 'overlay', redirectTo: OVERLAY_PATH },
    {
        path: '',
        component: ShellComponent,
        children: [
            { path: '', pathMatch: 'full', redirectTo: toCommands },
            {
                path: 'commands',
                title: 'Commands · brobot',
                loadComponent: () => import('./pages/commands.page').then(m => m.CommandsPage),
            },
            {
                path: 'login',
                title: 'Sign in · brobot',
                loadComponent: () => import('./pages/login.page').then(m => m.LoginPage),
            },
            {
                path: 'pokemon/leaderboard',
                title: 'Pokémon leaderboard · brobot',
                loadComponent: () =>
                    import('./pages/leaderboard.page').then(m => m.LeaderboardPage),
            },
            {
                path: 'pokemon/team',
                title: 'Team search · brobot',
                loadComponent: () =>
                    import('./pages/team-search.page').then(m => m.TeamSearchPage),
            },
            {
                path: 'pokemon/battleoutcome',
                title: 'Last battles · brobot',
                loadComponent: () =>
                    import('./pages/battle-outcome.page').then(m => m.BattleOutcomePage),
            },
            { path: '**', redirectTo: 'commands' },
        ],
    },
];

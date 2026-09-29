import { HttpClient } from '@angular/common/http';
import type { Provider } from '@angular/core';
import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

/**
 * brobot's HTTP surface, as `apps/brobot/README.md` ("HTTP surface (for the
 * admin site, U1)") documents it. These shapes mirror the API's; when one
 * changes there, change it here.
 */

/** Which game a Pokémon is in right now (migration plan §4). `pmd` = away in pmd-online. */
export type ActiveGame = 'brobot' | 'pmd';

/** `GET /api/auth/twitch/status`. */
export interface SessionUser {
    oauthId: string;
    displayName: string;
    roles: string[];
    profileImageUrl: string | null;
    scope: string[];
}

/** Roles the API accepts on its admin endpoints (`StreamerAuth`, `Admin`). `BotAuth` is not one. */
export const ADMIN_ROLES: readonly string[] = ['StreamerAuth', 'Admin'];

export function isAdmin(user: SessionUser | null): boolean {
    return user?.roles.some(role => ADMIN_ROLES.includes(role)) ?? false;
}

/** One row of `GET /api/pokemon/leaderboard` (top 100 by level). */
export interface LeaderboardEntry {
    level: number;
    name: string;
    nameId: string;
    shiny: boolean;
    activeGame: ActiveGame;
    twitchUser: { displayName: string };
}

export type PokemonGender = 'M' | 'F' | 'N';

/** A Pokémon on a team (`GET /api/pokemon/teams`). Carries no ids. */
export interface TeamPokemon {
    name: string;
    nameId: string;
    slot: number;
    level: number;
    shiny: boolean;
    wins: number;
    losses: number;
    draws: number;
    item: string;
    moves: string[];
    dexNum: number;
    color: string;
    types: string[];
    gender: PokemonGender | string;
    nature: string;
    ability: string;
    activeGame: ActiveGame;
    createdDate: string;
    updatedDate: string;
}

/** `GET /api/pokemon/teams?login=`. `pokemonTeam` is null for a user who never made one. */
export interface TeamResponse {
    displayName: string;
    pokemonTeam: { pokemon: TeamPokemon[] } | null;
}

/** `GET /api/pokemon/battle-outcome` and `/team-battle-outcome`. */
export interface BattleOutcome {
    outcome: string[];
    updatedDate: string | null;
}

export type CommandCategory = 'pokemon' | 'voting' | 'fun' | 'ai';

/** One row of `GET /api/commands`. */
export interface BotCommand {
    name: string;
    trigger: string;
    aliases: string[];
    category: CommandCategory;
    description: string;
    enabled: boolean;
}

/** The three Twitch OAuth flows. Each starts with a full-page navigation, never XHR. */
export type TwitchFlow = 'login' | 'streamer' | 'bot';

/** Twitch logins are 1–25 of `[A-Za-z0-9_]`; the API refuses anything else with a 400. */
export const TWITCH_LOGIN_PATTERN = /^[A-Za-z0-9_]{1,25}$/;

/** brobot's API origin (no trailing slash, no `/api`). */
export const BROBOT_API_ORIGIN = new InjectionToken<string>('BROBOT_API_ORIGIN');

export function provideBrobotApi(origin: string): Provider {
    return { provide: BROBOT_API_ORIGIN, useValue: origin.replace(/\/+$/, '') };
}

/** Builds brobot URLs. Reads go through `httpResource` in the pages; writes go through here. */
@Injectable({ providedIn: 'root' })
export class BrobotApi {
    private readonly http = inject(HttpClient);
    private readonly origin = inject(BROBOT_API_ORIGIN);

    url(path: string): string {
        return `${this.origin}/api/${path.replace(/^\/+/, '')}`;
    }

    /** Where the browser goes to start a Twitch flow. */
    flowUrl(flow: TwitchFlow): string {
        return this.url(`auth/twitch/${flow}`);
    }

    teamUrl(login: string): string {
        return `${this.url('pokemon/teams')}?login=${encodeURIComponent(login)}`;
    }

    /** Admin only: 401 signed out, 403 not admin, 404 unknown command. */
    setCommandEnabled(name: string, enabled: boolean): Observable<BotCommand> {
        return this.http.post<BotCommand>(this.url('commands'), { name, enabled });
    }
}

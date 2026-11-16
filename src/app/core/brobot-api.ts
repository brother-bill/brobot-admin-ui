import { HttpClient } from '@angular/common/http';
import type { Provider } from '@angular/core';
import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
    BrobotActiveGame,
    BrobotBattleOutcome,
    BrobotCommand,
    BrobotCurrentUserStatus,
    BrobotLeaderboardEntry,
    BrobotTeamPokemon,
    BrobotTeamResponse,
    BrobotTeamResponsePokemonTeam,
} from './generated/model/models';

/**
 * brobot's HTTP surface. The shapes are generated from brobot's registered
 * OpenAPI document (`brobot` in the superproject's
 * `libs/contracts/documents.yaml`, at the commit it records) into
 * `./generated/`; never edit those, regenerate them
 * (`pnpm run generate:api`). These are the names the pages use.
 */

/** Which game a Pokémon is in right now (migration plan §4). `pmd` = away in pmd-online. */
export type ActiveGame = BrobotActiveGame;

/** `GET /api/auth/twitch/status`. */
export type SessionUser = BrobotCurrentUserStatus;

/** Roles the API accepts on its admin endpoints (`StreamerAuth`, `Admin`). `BotAuth` is not one. */
export const ADMIN_ROLES: readonly string[] = ['StreamerAuth', 'Admin'];

export function isAdmin(user: SessionUser | null): boolean {
    return user?.roles.some(role => ADMIN_ROLES.includes(role)) ?? false;
}

/** One row of `GET /api/pokemon/leaderboard` (top 100 by level). */
export type LeaderboardEntry = BrobotLeaderboardEntry;

/**
 * A Pokémon on a team (`GET /api/pokemon/teams`). Carries no ids. `slot` is
 * null while the Pokémon is away in pmd-online (`activeGame: 'pmd'`).
 */
export type TeamPokemon = BrobotTeamPokemon;

/**
 * `GET /api/pokemon/teams?login=`. `pokemonTeam` is null for a user who never
 * made one. The document says so (`type: [object, null]`), but
 * openapi-generator 7.18.0 drops the `null` when it lifts that inline object
 * into `BrobotTeamResponsePokemonTeam`, so it is put back here.
 */
export type TeamResponse = Omit<BrobotTeamResponse, 'pokemonTeam'> & {
    pokemonTeam: BrobotTeamResponsePokemonTeam | null;
};

/** `GET /api/pokemon/battle-outcome` and `/team-battle-outcome`. */
export type BattleOutcome = BrobotBattleOutcome;

export type CommandCategory = BrobotCommand.CategoryEnum;

/** One row of `GET /api/commands`. */
export type BotCommand = BrobotCommand;

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

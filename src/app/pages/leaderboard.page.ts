import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
    LibAlertBannerComponent,
    LibBtnDirective,
    LibInfoPillComponent,
    LibSpinnerComponent,
} from '@singularity/ngx-ui';
import type { LeaderboardEntry } from '../core/brobot-api';
import { BrobotApi, TWITCH_LOGIN_PATTERN } from '../core/brobot-api';
import { describeHttpError } from '../core/http-errors';

interface LeaderboardRow extends LeaderboardEntry {
    rank: number;
    /** The team page's `username`, when the display name is also a valid login. */
    teamLogin: string | null;
}

/** The 30 highest-level Pokémon, from `GET /api/pokemon/leaderboard`. Public. */
@Component({
    selector: 'app-leaderboard-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        LibAlertBannerComponent,
        LibBtnDirective,
        LibInfoPillComponent,
        LibSpinnerComponent,
    ],
    styles: `
        .pokemon {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.25rem 0.5rem;
        }
    `,
    template: `
        <div class="page">
            <h1 class="page__title">Pokémon leaderboard</h1>
            <p class="page__lede">The 30 highest-level Pokémon in the streamer's chat.</p>

            @if (leaderboard.hasValue()) {
                @if (rows().length === 0) {
                    <p>Nobody has a Pokémon yet.</p>
                } @else {
                    <div class="table-scroll">
                        <table class="data-table">
                            <caption class="sr-only">Top 30 Pokémon by level</caption>
                            <thead>
                                <tr>
                                    <th scope="col" class="num">Rank</th>
                                    <th scope="col">Trainer</th>
                                    <th scope="col">Pokémon</th>
                                    <th scope="col" class="num">Level</th>
                                    <th scope="col"><span class="sr-only">Team</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (row of rows(); track $index) {
                                    <tr>
                                        <td class="num">{{ row.rank }}</td>
                                        <td>{{ row.twitchUser.displayName }}</td>
                                        <td>
                                            <span class="pokemon">
                                                {{ row.name }}
                                                @if (row.shiny) {
                                                    <lib-info-pill variant="tertiary">Shiny</lib-info-pill>
                                                }
                                                @if (row.activeGame === 'pmd') {
                                                    <lib-info-pill variant="info">Away in PMD</lib-info-pill>
                                                }
                                            </span>
                                        </td>
                                        <td class="num">{{ row.level }}</td>
                                        <td>
                                            @if (row.teamLogin) {
                                                <a
                                                    routerLink="/pokemon/team"
                                                    [queryParams]="{ username: row.teamLogin }">
                                                    View team<span class="sr-only">
                                                        of {{ row.twitchUser.displayName }}</span
                                                    >
                                                </a>
                                            }
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            } @else if (leaderboard.error()) {
                <lib-alert-banner variant="error">
                    {{ loadError() }}
                    <button libBtn="neutral" appearance="text" type="button" (click)="leaderboard.reload()">
                        Try again
                    </button>
                </lib-alert-banner>
            } @else {
                <lib-spinner label="Loading the leaderboard" />
            }
        </div>
    `,
})
export class LeaderboardPage {
    private readonly api = inject(BrobotApi);

    protected readonly leaderboard = httpResource<LeaderboardEntry[]>(() =>
        this.api.url('pokemon/leaderboard'),
    );

    protected readonly rows = computed<LeaderboardRow[]>(() =>
        (this.leaderboard.hasValue() ? this.leaderboard.value() : []).map((entry, index) => ({
            ...entry,
            rank: index + 1,
            teamLogin: TWITCH_LOGIN_PATTERN.test(entry.twitchUser.displayName)
                ? entry.twitchUser.displayName.toLowerCase()
                : null,
        })),
    );

    protected readonly loadError = computed(() => describeHttpError(this.leaderboard.error()));
}

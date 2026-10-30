import { HttpErrorResponse, httpResource } from '@angular/common/http';
import type {
    ElementRef} from '@angular/core';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    untracked,
    viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
    LibAlertBannerComponent,
    LibBtnDirective,
    LibErrorComponent,
    LibFormFieldComponent,
    LibHintComponent,
    LibInfoPillComponent,
    LibInputDirective,
    LibLabelComponent,
    LibSpinnerComponent,
} from '@singularity/ngx-ui';
import { environment } from '../../environments/environment';
import type { TeamResponse } from '../core/brobot-api';
import { BrobotApi, TWITCH_LOGIN_PATTERN } from '../core/brobot-api';
import { describeHttpError } from '../core/http-errors';
import { pokemonArtUrl } from '../core/pokemon-art';
import type { TeamCardPokemon } from './team-card.component';
import { TeamCardComponent } from './team-card.component';

export const TEAM_SLOTS = 6;

export interface TeamSlot {
    slot: number;
    pokemon: TeamCardPokemon | null;
}

/** Six slots, in order, empty ones included — the shape `!pokemon team` describes. */
export function toSlots(team: TeamResponse['pokemonTeam'], artBase: string): TeamSlot[] {
    const pokemon = team?.pokemon ?? [];
    return Array.from({ length: TEAM_SLOTS }, (_, index) => {
        const slot = index + 1;
        const found = pokemon.find(p => p.slot === slot);
        return { slot, pokemon: found ? { ...found, artUrl: pokemonArtUrl(artBase, found) } : null };
    });
}

/** The Pokémon with no slot: away in pmd-online, in the order the API sent them. */
export function toAway(team: TeamResponse['pokemonTeam'], artBase: string): TeamCardPokemon[] {
    return (team?.pokemon ?? []).filter(p => p.slot === null).map(p => ({ ...p, artUrl: pokemonArtUrl(artBase, p) }));
}

/**
 * A viewer's team, by Twitch login. The login lives in the URL
 * (`/pokemon/team?username=`), which is the link `!pokemon team` posts in
 * chat, so a result can be shared. Public.
 */
@Component({
    selector: 'app-team-search-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        LibAlertBannerComponent,
        LibBtnDirective,
        LibErrorComponent,
        LibFormFieldComponent,
        LibHintComponent,
        LibInfoPillComponent,
        LibInputDirective,
        LibLabelComponent,
        LibSpinnerComponent,
        TeamCardComponent,
    ],
    styles: `
        .search {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: 0.75rem;
        }
        .search lib-form-field {
            flex: 1 1 18rem;
            max-width: 28rem;
        }
        .search button {
            margin-top: 0.25rem;
        }
        .slots {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
            gap: 1rem;
            margin: 0;
            padding: 0;
            list-style: none;
        }
    `,
    template: `
        <div class="page">
            <h1 class="page__title">Team search</h1>
            <p class="page__lede">See anyone's Pokémon team by their Twitch username.</p>

            <form class="search" role="search" aria-label="Pokémon teams" (ngSubmit)="search()" [formGroup]="form">
                <lib-form-field>
                    <lib-label>Twitch username</lib-label>
                    <input
                        #loginInput
                        libInput
                        type="text"
                        name="username"
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        maxlength="25"
                        formControlName="username" />
                    <lib-hint>Letters, numbers and underscores, as in their Twitch URL.</lib-hint>
                    <lib-error>{{ loginErrorMessage() }}</lib-error>
                </lib-form-field>
                <button libBtn="primary" appearance="filled" type="submit">Search</button>
            </form>

            @if (login(); as searched) {
                @if (team.hasValue()) {
                    @let result = team.value();
                    <section class="stack" aria-labelledby="team-heading">
                        <h2 class="section-title" id="team-heading">{{ result.displayName }}'s team</h2>
                        @if (memberCount() === 0 && away().length === 0) {
                            <p>{{ result.displayName }} has no Pokémon yet.</p>
                        } @else {
                            <p class="row">
                                <span>{{ memberCount() }} of {{ slotCount }} slots filled</span>
                                @if (away().length > 0) {
                                    <lib-info-pill variant="info">{{ away().length }} away in PMD</lib-info-pill>
                                }
                            </p>
                            <ol class="slots">
                                @for (slot of slots(); track slot.slot) {
                                    <li>
                                        <app-team-card
                                            [pokemon]="slot.pokemon"
                                            [label]="'Slot ' + slot.slot"
                                            [cardId]="'slot-' + slot.slot" />
                                    </li>
                                }
                            </ol>
                            @if (away().length > 0) {
                                <section class="stack" aria-labelledby="away-heading">
                                    <h3 class="section-title" id="away-heading">Away in PMD</h3>
                                    <ul class="slots">
                                        @for (p of away(); track $index) {
                                            <li>
                                                <app-team-card
                                                    [pokemon]="p"
                                                    label="Away in PMD"
                                                    [cardId]="'away-' + $index"
                                                    [headingLevel]="4" />
                                            </li>
                                        }
                                    </ul>
                                </section>
                            }
                        }
                    </section>
                } @else if (team.error()) {
                    <lib-alert-banner [variant]="notFound() ? 'info' : 'error'">
                        {{ searchError(searched) }}
                    </lib-alert-banner>
                } @else {
                    <lib-spinner [label]="'Looking up ' + searched" />
                }
            }

            <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
        </div>
    `,
})
export class TeamSearchPage {
    private readonly api = inject(BrobotApi);
    private readonly router = inject(Router);

    /** `?username=` — bound by the router (`withComponentInputBinding`). */
    readonly username = input<string>();

    private readonly loginInput = viewChild.required<ElementRef<HTMLInputElement>>('loginInput');

    protected readonly form = new FormGroup({
        username: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.pattern(TWITCH_LOGIN_PATTERN)],
        }),
    });

    /** The login actually looked up: the URL's, when it is one Twitch could have issued. */
    protected readonly login = computed(() => {
        const value = this.username()?.trim().toLowerCase() ?? '';
        return TWITCH_LOGIN_PATTERN.test(value) ? value : null;
    });

    protected readonly team = httpResource<TeamResponse>(() => {
        const login = this.login();
        return login ? this.api.teamUrl(login) : undefined;
    });

    protected readonly slots = computed(() =>
        this.team.hasValue() ? toSlots(this.team.value().pokemonTeam, environment.pokemonArtUrl) : [],
    );

    protected readonly away = computed(() =>
        this.team.hasValue() ? toAway(this.team.value().pokemonTeam, environment.pokemonArtUrl) : [],
    );

    protected readonly slotCount = TEAM_SLOTS;

    /** Slotted Pokémon only; the away ones are counted apart. */
    protected readonly memberCount = computed(() => this.slots().filter(s => s.pokemon).length);

    protected readonly notFound = computed(() => {
        const error = this.team.error();
        return error instanceof HttpErrorResponse && error.status === 404;
    });

    /** Found teams only: a failed search is announced by its alert banner. */
    protected readonly announcement = computed(() => {
        if (!this.login() || !this.team.hasValue()) return '';
        const away = this.away().length;
        const awayPart = away > 0 ? `, ${away} away in PMD` : '';
        return `${this.team.value().displayName}'s team: ${this.memberCount()} Pokémon${awayPart}.`;
    });

    constructor() {
        // Keep the box in step with the URL (a chat link, back/forward).
        effect(() => {
            const fromUrl = this.username() ?? '';
            untracked(() => this.form.controls.username.setValue(fromUrl));
        });
    }

    protected loginErrorMessage(): string {
        const control = this.form.controls.username;
        return control.hasError('required')
            ? 'Enter a Twitch username.'
            : 'A Twitch username is 1 to 25 letters, numbers or underscores.';
    }

    protected search(): void {
        const control = this.form.controls.username;
        control.setValue(control.value.trim());
        if (control.invalid) {
            control.markAsTouched();
            // A status emission is what lib-input re-reads its error state on;
            // an untouched empty field would otherwise submit silently.
            control.updateValueAndValidity();
            this.loginInput().nativeElement.focus();
            return;
        }
        const login = control.value.toLowerCase();
        if (login === this.login()) {
            this.team.reload();
            return;
        }
        void this.router.navigate([], { queryParams: { username: login } });
    }

    protected searchError(login: string): string {
        if (this.notFound()) return `brobot has never seen a Twitch user called ${login}.`;
        return describeHttpError(this.team.error());
    }
}

import { DatePipe } from '@angular/common';
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
import type { TeamPokemon, TeamResponse } from '../core/brobot-api';
import { BrobotApi, TWITCH_LOGIN_PATTERN } from '../core/brobot-api';
import { describeHttpError } from '../core/http-errors';
import { genderLabel, genderSymbol, pokemonArtUrl } from '../core/pokemon-art';

export const TEAM_SLOTS = 6;

export interface TeamSlot {
    slot: number;
    pokemon: (TeamPokemon & { artUrl: string }) | null;
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

/**
 * A viewer's team, by Twitch login. The login lives in the URL
 * (`/pokemon/team?username=`), which is the link `!pokemon team` posts in
 * chat, so a result can be shared. Public.
 */
@Component({
    selector: 'app-team-search-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
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
        .card {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            height: 100%;
            padding: 1rem;
            border-radius: 16px;
            background: var(--ui-surface-container);
            border: 1px solid var(--ui-outline-variant);
        }
        .card--empty {
            justify-content: center;
            color: var(--ui-on-surface-variant);
            border-style: dashed;
            background: transparent;
        }
        .card__slot {
            font: var(--ui-label-medium);
            color: var(--ui-on-surface-variant);
        }
        .card__head {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 0.5rem;
        }
        .card__name {
            font: var(--ui-title-medium);
        }
        .card__level {
            font: var(--ui-label-large);
            font-variant-numeric: tabular-nums;
        }
        .card__art {
            align-self: center;
            width: 9rem;
            height: 9rem;
            object-fit: contain;
        }
        .facts {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.25rem 0.75rem;
            margin: 0;
            font: var(--ui-body-small);
        }
        .facts dt {
            color: var(--ui-on-surface-variant);
        }
        .facts dd {
            margin: 0;
        }
        details summary {
            cursor: pointer;
            min-height: 24px;
            font: var(--ui-label-large);
        }
        details ul {
            margin: 0.5rem 0 0;
            padding-inline-start: 1.25rem;
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
                        @if (memberCount() === 0) {
                            <p>{{ result.displayName }} has no Pokémon yet.</p>
                        } @else {
                            <ol class="slots">
                                @for (slot of slots(); track slot.slot) {
                                    <li>
                                        @if (slot.pokemon; as p) {
                                            <article class="card" [attr.aria-labelledby]="'slot-' + slot.slot">
                                                <span class="card__slot">Slot {{ slot.slot }}</span>
                                                <div class="card__head">
                                                    <h3 class="card__name" [id]="'slot-' + slot.slot">
                                                        {{ p.name }}
                                                        <span aria-hidden="true">{{ symbol(p.gender) }}</span>
                                                        <span class="sr-only">({{ gender(p.gender) }})</span>
                                                    </h3>
                                                    <span class="card__level">Lv {{ p.level }}</span>
                                                </div>
                                                <div class="row">
                                                    @if (p.shiny) {
                                                        <lib-info-pill variant="tertiary">Shiny</lib-info-pill>
                                                    }
                                                    @if (p.activeGame === 'pmd') {
                                                        <lib-info-pill variant="info">Away in PMD</lib-info-pill>
                                                    }
                                                </div>
                                                <img class="card__art" [src]="p.artUrl" alt="" loading="lazy" />
                                                <dl class="facts">
                                                    <dt>Types</dt>
                                                    <dd>{{ p.types.join(' / ') || '—' }}</dd>
                                                    <dt>Record</dt>
                                                    <dd>
                                                        {{ p.wins }} wins, {{ p.losses }} losses, {{ p.draws }} draws
                                                    </dd>
                                                </dl>
                                                <details>
                                                    <summary>Moves and details</summary>
                                                    <dl class="facts">
                                                        <dt>Pokédex</dt>
                                                        <dd>#{{ p.dexNum }}</dd>
                                                        <dt>Nature</dt>
                                                        <dd>{{ p.nature || '—' }}</dd>
                                                        <dt>Ability</dt>
                                                        <dd>{{ p.ability || '—' }}</dd>
                                                        <dt>Item</dt>
                                                        <dd>{{ p.item || 'None' }}</dd>
                                                        <dt>Caught</dt>
                                                        <dd>{{ p.createdDate | date: 'mediumDate' }}</dd>
                                                    </dl>
                                                    <h4 class="sr-only">Moves</h4>
                                                    <ul>
                                                        @for (move of p.moves; track $index) {
                                                            <li>{{ move }}</li>
                                                        } @empty {
                                                            <li>No moves</li>
                                                        }
                                                    </ul>
                                                </details>
                                            </article>
                                        } @else {
                                            <div class="card card--empty">
                                                <span class="card__slot">Slot {{ slot.slot }}</span>
                                                <p>Empty</p>
                                            </div>
                                        }
                                    </li>
                                }
                            </ol>
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

    protected readonly memberCount = computed(() => this.slots().filter(s => s.pokemon).length);

    protected readonly notFound = computed(() => {
        const error = this.team.error();
        return error instanceof HttpErrorResponse && error.status === 404;
    });

    protected readonly announcement = computed(() => {
        const login = this.login();
        if (!login) return '';
        if (this.team.hasValue()) {
            const count = this.memberCount();
            return `${this.team.value().displayName}'s team: ${count} Pokémon.`;
        }
        if (this.team.error()) return this.searchError(login);
        return '';
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

    protected symbol(gender: string): string {
        return genderSymbol(gender);
    }

    protected gender(gender: string): string {
        return genderLabel(gender);
    }
}

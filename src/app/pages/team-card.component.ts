import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LibInfoPillComponent } from '@singularity/ngx-ui';
import type { TeamPokemon } from '../core/brobot-api';
import { genderLabel, genderSymbol } from '../core/pokemon-art';

export type TeamCardPokemon = TeamPokemon & { artUrl: string };

/**
 * One Pokémon of a team, or an empty slot. `label` is what sits above the
 * name ("Slot 3", "Away in PMD"); `headingLevel` keeps the outline right when
 * the card sits under a group heading.
 */
@Component({
    selector: 'app-team-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, LibInfoPillComponent],
    styles: `
        :host {
            display: block;
            height: 100%;
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
        @if (pokemon(); as p) {
            <article class="card" [attr.aria-labelledby]="cardId()">
                <span class="card__slot">{{ label() }}</span>
                <div class="card__head">
                    @if (headingLevel() === 4) {
                        <h4 class="card__name" [id]="cardId()">
                            {{ p.name }}
                            <span aria-hidden="true">{{ symbol(p.gender) }}</span>
                            <span class="sr-only">({{ gender(p.gender) }})</span>
                        </h4>
                    } @else {
                        <h3 class="card__name" [id]="cardId()">
                            {{ p.name }}
                            <span aria-hidden="true">{{ symbol(p.gender) }}</span>
                            <span class="sr-only">({{ gender(p.gender) }})</span>
                        </h3>
                    }
                    <span class="card__level">Lv {{ p.level }}</span>
                </div>
                <div class="row">
                    @if (p.shiny) {
                        <lib-info-pill variant="tertiary">Shiny</lib-info-pill>
                    }
                    @if (p.activeGame === 'pmd' && p.slot !== null) {
                        <lib-info-pill variant="info">Away in PMD</lib-info-pill>
                    }
                </div>
                <img class="card__art" [src]="p.artUrl" alt="" loading="lazy" />
                <dl class="facts">
                    <dt>Types</dt>
                    <dd>{{ p.types.join(' / ') || '—' }}</dd>
                    <dt>Record</dt>
                    <dd>{{ p.wins }} wins, {{ p.losses }} losses, {{ p.draws }} draws</dd>
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
                    @if (headingLevel() === 4) {
                        <h5 class="sr-only">Moves</h5>
                    } @else {
                        <h4 class="sr-only">Moves</h4>
                    }
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
                <span class="card__slot">{{ label() }}</span>
                <p>Empty</p>
            </div>
        }
    `,
})
export class TeamCardComponent {
    readonly pokemon = input.required<TeamCardPokemon | null>();
    readonly label = input.required<string>();
    /** The name heading's id; the card is labelled by it. */
    readonly cardId = input.required<string>();
    readonly headingLevel = input<3 | 4>(3);

    protected symbol(gender: string): string {
        return genderSymbol(gender);
    }

    protected gender(gender: string): string {
        return genderLabel(gender);
    }
}

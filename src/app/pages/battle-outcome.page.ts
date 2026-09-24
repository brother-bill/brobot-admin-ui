import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    LibAlertBannerComponent,
    LibBtnDirective,
    LibCardComponent,
    LibCardContentComponent,
    LibCardHeaderComponent,
    LibCardTitleComponent,
    LibSpinnerComponent,
} from '@singularity/ngx-ui';
import type { BattleOutcome } from '../core/brobot-api';
import { BrobotApi } from '../core/brobot-api';
import { describeHttpError } from '../core/http-errors';

/**
 * The log of the last `!pokemon battle` and the last `!pokemon teambattle`
 * (`!pokemon battle` posts this page's link when a battle ends). Public.
 */
@Component({
    selector: 'app-battle-outcome-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        LibAlertBannerComponent,
        LibBtnDirective,
        LibCardComponent,
        LibCardContentComponent,
        LibCardHeaderComponent,
        LibCardTitleComponent,
        LibSpinnerComponent,
    ],
    styles: `
        .battles {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
            gap: 1rem;
        }
        .log {
            margin: 0;
            padding-inline-start: 0;
            list-style: none;
            font: var(--ui-body-medium);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
        .log li + li {
            margin-top: 0.25rem;
        }
        .card-title {
            font: var(--ui-title-medium);
        }
    `,
    template: `
        <div class="page">
            <div class="row">
                <h1 class="page__title">Last battles</h1>
                <button libBtn="neutral" appearance="outlined" type="button" (click)="refresh()">
                    Refresh
                </button>
            </div>
            <p class="page__lede">What happened in the most recent battles fought in chat.</p>

            <div class="battles">
                @for (battle of battles; track battle.id) {
                    <lib-card>
                        <lib-card-header>
                            <lib-card-title>
                                <h2 class="card-title" [id]="battle.id">{{ battle.title }}</h2>
                            </lib-card-title>
                        </lib-card-header>
                        <lib-card-content class="stack">
                            @if (battle.resource.hasValue()) {
                                @let outcome = battle.resource.value();
                                @if (outcome.outcome.length === 0) {
                                    <p>No {{ battle.noun }} has been fought yet.</p>
                                } @else {
                                    @if (outcome.updatedDate) {
                                        <p class="muted">
                                            Fought
                                            <time [attr.datetime]="outcome.updatedDate">
                                                {{ outcome.updatedDate | date: 'medium' }}
                                            </time>
                                        </p>
                                    }
                                    <ol class="log" [attr.aria-labelledby]="battle.id">
                                        @for (line of outcome.outcome; track $index) {
                                            <li>{{ line }}</li>
                                        }
                                    </ol>
                                }
                            } @else if (battle.resource.error()) {
                                <lib-alert-banner variant="error">
                                    {{ errorText(battle.resource.error()) }}
                                </lib-alert-banner>
                            } @else {
                                <lib-spinner [label]="'Loading the ' + battle.noun" />
                            }
                        </lib-card-content>
                    </lib-card>
                }
            </div>
        </div>
    `,
})
export class BattleOutcomePage {
    private readonly api = inject(BrobotApi);

    protected readonly battles = [
        {
            id: 'battle-1v1',
            title: 'Last 1v1 battle',
            noun: '1v1 battle',
            resource: httpResource<BattleOutcome>(() => this.api.url('pokemon/battle-outcome')),
        },
        {
            id: 'battle-team',
            title: 'Last team battle',
            noun: 'team battle',
            resource: httpResource<BattleOutcome>(() => this.api.url('pokemon/team-battle-outcome')),
        },
    ];

    protected refresh(): void {
        for (const battle of this.battles) battle.resource.reload();
    }

    protected errorText(error: unknown): string {
        return describeHttpError(error);
    }
}

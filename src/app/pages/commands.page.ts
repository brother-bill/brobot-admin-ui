import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    LibAlertBannerComponent,
    LibBtnDirective,
    LibInfoPillComponent,
    LibSlideToggleComponent,
    LibSpinnerComponent,
} from '@singularity/ngx-ui';
import type { BotCommand, CommandCategory } from '../core/brobot-api';
import { BrobotApi } from '../core/brobot-api';
import { describeHttpError } from '../core/http-errors';
import { SessionService } from '../core/session.service';

const CATEGORY_TITLES: Record<CommandCategory, string> = {
    pokemon: 'Pokémon',
    voting: 'Voting',
    fun: 'Fun',
    ai: 'Talking to brobot',
};

const CATEGORY_ORDER: readonly CommandCategory[] = ['pokemon', 'voting', 'fun', 'ai'];

interface CommandGroup {
    category: CommandCategory;
    title: string;
    commands: BotCommand[];
}

/**
 * Every chat command brobot answers, and whether it is on. Anyone can read
 * it (`!pokemon` and `!commands` link here); the streamer and brobot admins
 * can switch each one on or off.
 */
@Component({
    selector: 'app-commands-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        LibAlertBannerComponent,
        LibBtnDirective,
        LibInfoPillComponent,
        LibSlideToggleComponent,
        LibSpinnerComponent,
    ],
    styles: `
        code {
            font-family: var(--ui-font-family-mono, monospace);
            font-weight: 600;
        }
        .aliases {
            display: block;
            font: var(--ui-body-small);
            color: var(--ui-on-surface-variant);
        }
        .state-col {
            width: 9rem;
        }
        .rules li + li {
            margin-top: 0.375rem;
        }
    `,
    template: `
        <div class="page">
            <h1 class="page__title">Commands</h1>
            <p class="page__lede">
                Type these in the streamer's Twitch chat. A command that is off is ignored.
            </p>

            @if (session.isAdmin()) {
                <p class="muted">
                    You are an admin: the switches below turn a command on or off for everyone, and
                    stay that way after brobot restarts.
                </p>
            } @else if (session.state() === 'signed-in') {
                <p class="muted">Only the streamer and brobot admins can switch commands on or off.</p>
            }

            @if (saveError(); as message) {
                <lib-alert-banner variant="error" [dismissible]="true" (dismissed)="saveError.set(null)">
                    {{ message }}
                </lib-alert-banner>
            }

            @if (commands.hasValue()) {
                @for (group of groups(); track group.category) {
                    <section class="stack" [attr.aria-labelledby]="'cat-' + group.category">
                        <h2 class="section-title" [id]="'cat-' + group.category">{{ group.title }}</h2>
                        <div class="table-scroll">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Command</th>
                                        <th scope="col">What it does</th>
                                        <th scope="col" class="state-col">State</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (command of group.commands; track command.name) {
                                        <tr>
                                            <th scope="row">
                                                <code>{{ command.trigger }}</code>
                                                @if (command.aliases.length > 0) {
                                                    <span class="aliases">
                                                        or
                                                        @for (alias of command.aliases; track alias; let last = $last) {
                                                            <code>{{ alias }}</code>{{ last ? '' : ', ' }}
                                                        }
                                                    </span>
                                                }
                                            </th>
                                            <td>{{ command.description }}</td>
                                            <td>
                                                @if (session.isAdmin()) {
                                                    <lib-slide-toggle
                                                        [checked]="command.enabled"
                                                        (change)="setEnabled(command, $event)">
                                                        {{ command.enabled ? 'On' : 'Off' }}
                                                        <span class="sr-only">: {{ command.trigger }}</span>
                                                    </lib-slide-toggle>
                                                } @else {
                                                    <lib-info-pill [variant]="command.enabled ? 'success' : 'neutral'">
                                                        {{ command.enabled ? 'On' : 'Off' }}
                                                    </lib-info-pill>
                                                }
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    </section>
                }

                <section class="stack" aria-labelledby="pokemon-rules">
                    <h2 class="section-title" id="pokemon-rules">How the Pokémon work</h2>
                    <ul class="rules">
                        <li>
                            Every 30 minutes a wild level-1 Pokémon appears in chat for two minutes. One in
                            eight is shiny. Catch it with <code>!pokemon catch</code> if you have a free
                            slot.
                        </li>
                        <li>
                            Battles are simulated with Pokémon Showdown, so levels, moves and your whole
                            team matter. The winner of a 1v1 gains a level.
                        </li>
                        <li>You can delete up to six Pokémon a day.</li>
                        <li>
                            A Pokémon that is away in pmd-online keeps its slot but cannot battle, level up,
                            be swapped or be deleted until it comes back.
                        </li>
                    </ul>
                </section>
            } @else if (commands.error()) {
                <lib-alert-banner variant="error">
                    {{ loadError() }}
                    <button libBtn="neutral" appearance="text" type="button" (click)="commands.reload()">
                        Try again
                    </button>
                </lib-alert-banner>
            } @else {
                <lib-spinner label="Loading commands" />
            }

            <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
        </div>
    `,
})
export class CommandsPage {
    private readonly api = inject(BrobotApi);
    protected readonly session = inject(SessionService);

    protected readonly commands = httpResource<BotCommand[]>(() => this.api.url('commands'));

    /**
     * The latest save per command. A switch stays operable while a save is in
     * flight (disabling it would drop keyboard focus); only the latest
     * answer for a command is applied.
     */
    private readonly latestSave = new Map<string, number>();
    private saveCounter = 0;
    protected readonly saveError = signal<string | null>(null);
    protected readonly announcement = signal('');

    protected readonly groups = computed<CommandGroup[]>(() => {
        const commands = this.commands.hasValue() ? this.commands.value() : [];
        return CATEGORY_ORDER.map(category => ({
            category,
            title: CATEGORY_TITLES[category],
            commands: commands.filter(command => command.category === category),
        })).filter(group => group.commands.length > 0);
    });

    protected readonly loadError = computed(() =>
        describeHttpError(this.commands.error(), 'brobot'),
    );

    /**
     * `lib-slide-toggle`'s `(change)` fires twice per flip: once with its
     * boolean output, and once more with the inner checkbox's native `change`
     * event, which bubbles to the host element. Only the boolean is a flip.
     */
    protected async setEnabled(command: BotCommand, enabled: boolean | Event): Promise<void> {
        if (typeof enabled !== 'boolean') return;
        const save = ++this.saveCounter;
        this.latestSave.set(command.name, save);
        this.saveError.set(null);
        this.patch(command.name, enabled);
        try {
            const saved = await firstValueFrom(this.api.setCommandEnabled(command.name, enabled));
            if (this.latestSave.get(command.name) !== save) return;
            this.patch(saved.name, saved.enabled);
            this.announcement.set(`${saved.trigger} is now ${saved.enabled ? 'on' : 'off'}.`);
        } catch (error) {
            if (this.latestSave.get(command.name) !== save) return;
            this.patch(command.name, !enabled);
            this.saveError.set(
                `Could not turn ${command.trigger} ${enabled ? 'on' : 'off'}. ${describeHttpError(error)}`,
            );
            // The session ended under us (the interceptor's refresh failed too):
            // re-read it, so the header and these switches stop claiming otherwise.
            if (error instanceof HttpErrorResponse && error.status === 401) void this.session.restore();
        }
    }

    private patch(name: string, enabled: boolean): void {
        if (!this.commands.hasValue()) return;
        this.commands.value.update(list =>
            list.map(command => (command.name === name ? { ...command, enabled } : command)),
        );
    }
}

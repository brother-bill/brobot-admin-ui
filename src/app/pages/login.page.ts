import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    LibBtnDirective,
    LibCardComponent,
    LibCardContentComponent,
    LibCardHeaderComponent,
    LibCardTitleComponent,
    LibSpinnerComponent,
} from '@singularity/ngx-ui';
import { BrobotApi } from '../core/brobot-api';
import { SessionService } from '../core/session.service';

/**
 * Signing in, and — for admins — linking the streamer's and the bot's Twitch
 * accounts, which brobot needs before it can talk in chat and manage
 * channel-point rewards. Linking never changes who is signed in here.
 */
@Component({
    selector: 'app-login-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        LibBtnDirective,
        LibCardComponent,
        LibCardContentComponent,
        LibCardHeaderComponent,
        LibCardTitleComponent,
        LibSpinnerComponent,
    ],
    styles: `
        .card-title {
            font: var(--ui-title-medium);
        }
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
            gap: 1rem;
        }
    `,
    template: `
        <div class="page">
            <h1 class="page__title">Account</h1>

            @switch (session.state()) {
                @case ('unknown') {
                    <lib-spinner label="Checking whether you are signed in" />
                }
                @case ('signed-in') {
                    @if (session.user(); as user) {
                        <p>
                            You are signed in as <strong>{{ user.displayName }}</strong>.
                            @if (!session.isAdmin()) {
                                Viewers don't need to be signed in for anything on this site yet.
                            }
                        </p>
                    }
                    @if (session.isAdmin()) {
                        <div class="cards">
                            <lib-card>
                                <lib-card-header>
                                    <lib-card-title><h2 class="card-title">Streamer account</h2></lib-card-title>
                                </lib-card-header>
                                <lib-card-content class="stack">
                                    <p>
                                        Lets brobot create, pause and refund the channel-point rewards and
                                        read redemptions. Only the streamer's own Twitch account is accepted.
                                    </p>
                                    <div class="row">
                                        <a libBtn="primary" appearance="outlined" [href]="streamerUrl">
                                            Link the streamer account
                                        </a>
                                    </div>
                                </lib-card-content>
                            </lib-card>
                            <lib-card>
                                <lib-card-header>
                                    <lib-card-title><h2 class="card-title">Bot account</h2></lib-card-title>
                                </lib-card-header>
                                <lib-card-content class="stack">
                                    <p>
                                        Lets brobot chat as bro_____bot. Twitch asks you to pick an account:
                                        choose the bot's.
                                    </p>
                                    <div class="row">
                                        <a libBtn="primary" appearance="outlined" [href]="botUrl">
                                            Link the bot account
                                        </a>
                                    </div>
                                </lib-card-content>
                            </lib-card>
                        </div>
                    }
                }
                @default {
                    <p class="page__lede">
                        Sign in with your Twitch account. brobot only asks Twitch for your profile.
                    </p>
                    @if (session.state() === 'unreachable') {
                        <p class="muted">brobot isn't answering right now, so signing in may fail.</p>
                    }
                    <div class="row">
                        <a libBtn="primary" appearance="filled" [href]="loginUrl">Sign in with Twitch</a>
                    </div>
                }
            }
        </div>
    `,
})
export class LoginPage {
    protected readonly session = inject(SessionService);
    private readonly api = inject(BrobotApi);

    protected readonly loginUrl = this.api.flowUrl('login');
    protected readonly streamerUrl = this.api.flowUrl('streamer');
    protected readonly botUrl = this.api.flowUrl('bot');
}

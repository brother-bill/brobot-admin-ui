import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LibBtnDirective, LibSpinnerComponent } from '@singularity/ngx-ui';
import { BrobotApi } from '../core/brobot-api';
import { SessionService } from '../core/session.service';

interface NavItem {
    path: string;
    label: string;
}

/** Brand, the site's pages, and who is signed in. */
@Component({
    selector: 'app-site-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RouterLinkActive, LibBtnDirective, LibSpinnerComponent],
    styles: `
        :host {
            display: block;
            background: var(--ui-surface-container);
            border-bottom: 1px solid var(--ui-outline-variant);
        }
        .bar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem 1.5rem;
            max-width: 72rem;
            margin-inline: auto;
            padding: 0.5rem 1rem;
        }
        .brand {
            font: var(--ui-title-large);
            color: var(--ui-on-surface);
            text-decoration: none;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
        }
        nav {
            flex: 1 1 auto;
        }
        nav ul {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin: 0;
            padding: 0;
            list-style: none;
        }
        nav a {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            padding-inline: 0.75rem;
            border-radius: 999px;
            color: var(--ui-on-surface);
            text-decoration: none;
            font: var(--ui-label-large);
        }
        nav a:hover {
            background: var(--ui-surface-container-high);
        }
        nav a.is-active {
            background: var(--ui-secondary-container);
            color: var(--ui-on-secondary-container);
        }
        .account {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
        }
        .who {
            font: var(--ui-label-large);
        }
        .role {
            display: block;
            font: var(--ui-body-small);
            color: var(--ui-on-surface-variant);
        }
    `,
    template: `
        <div class="bar">
            <a class="brand" routerLink="/commands">bro_bot</a>

            <nav aria-label="Main">
                <ul>
                    @for (item of nav; track item.path) {
                        <li>
                            <a
                                [routerLink]="item.path"
                                routerLinkActive="is-active"
                                ariaCurrentWhenActive="page">
                                {{ item.label }}
                            </a>
                        </li>
                    }
                </ul>
            </nav>

            <div class="account">
                @switch (session.state()) {
                    @case ('unknown') {
                        <lib-spinner [diameter]="20" label="Checking whether you are signed in" />
                    }
                    @case ('signed-in') {
                        @if (session.user(); as user) {
                            @if (user.profileImageUrl) {
                                <img class="avatar" [src]="user.profileImageUrl" alt="" />
                            }
                            <span class="who">
                                <span class="sr-only">Signed in as </span>{{ user.displayName }}
                                @if (session.isAdmin()) {
                                    <span class="role">Admin</span>
                                }
                            </span>
                            <button libBtn="neutral" appearance="outlined" type="button" (click)="logout()">
                                Log out
                            </button>
                        }
                    }
                    @default {
                        <a
                            libBtn="primary"
                            appearance="filled"
                            [href]="loginUrl"
                            (click)="rememberPage()">
                            Sign in with Twitch
                        </a>
                    }
                }
            </div>
        </div>
    `,
})
export class SiteHeaderComponent {
    protected readonly session = inject(SessionService);
    private readonly router = inject(Router);
    private readonly api = inject(BrobotApi);

    protected readonly loginUrl = this.api.flowUrl('login');

    protected readonly nav: NavItem[] = [
        { path: '/commands', label: 'Commands' },
        { path: '/pokemon/leaderboard', label: 'Leaderboard' },
        { path: '/pokemon/team', label: 'Team search' },
        { path: '/pokemon/battleoutcome', label: 'Last battles' },
    ];

    protected rememberPage(): void {
        this.session.rememberReturnUrl(this.router.url);
    }

    protected async logout(): Promise<void> {
        await this.session.logout();
        await this.router.navigateByUrl('/commands');
    }
}

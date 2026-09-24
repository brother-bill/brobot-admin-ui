import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Injector,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import type { LibSkipLinkTarget } from '@singularity/ngx-ui';
import { LibAlertBannerComponent, LibSkipLinkComponent } from '@singularity/ngx-ui';
import { filter } from 'rxjs';
import type { AuthNotice } from '../core/auth-return';
import { AUTH_RETURN_PARAMS, readAuthReturn } from '../core/auth-return';
import { SessionService } from '../core/session.service';
import { SiteHeaderComponent } from './site-header.component';

/**
 * The site's frame: skip link, header, the Twitch callback's notice, and the
 * page. Owns the session restore, so the stream overlay (which is outside
 * this frame) never asks who is signed in.
 */
@Component({
    selector: 'app-shell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, LibSkipLinkComponent, LibAlertBannerComponent, SiteHeaderComponent],
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        main {
            flex: 1;
        }
        main:focus {
            outline: none;
        }
        .notice {
            max-width: 72rem;
            margin: 1rem auto 0;
            padding-inline: 1rem;
        }
        footer {
            padding: 1.5rem 1rem;
            text-align: center;
            color: var(--ui-on-surface-variant);
            font: var(--ui-body-small);
        }
    `,
    template: `
        <lib-skip-link [links]="skipLinks" />
        <app-site-header />

        @if (notice(); as n) {
            <div class="notice">
                <lib-alert-banner
                    [variant]="n.tone"
                    [dismissible]="true"
                    (dismissed)="notice.set(null)">
                    {{ n.message }}
                </lib-alert-banner>
            </div>
        }

        <main id="main" tabindex="-1">
            <router-outlet />
        </main>

        <footer>
            <p>brobot is a fan project and is not affiliated with Twitch or Nintendo.</p>
        </footer>
    `,
})
export class ShellComponent {
    private readonly router = inject(Router);
    private readonly injector = inject(Injector);
    protected readonly session = inject(SessionService);

    protected readonly notice = signal<AuthNotice | null>(null);
    protected readonly skipLinks: LibSkipLinkTarget[] = [
        { targetId: 'main', label: 'Skip to main content' },
    ];

    constructor() {
        let previousPath: string | null = null;
        this.router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntilDestroyed(inject(DestroyRef)),
            )
            .subscribe(event => {
                this.consumeAuthReturn();
                // A new page, not a new query string: a team search or the
                // notice's cleanup must leave focus where it is.
                const path = event.urlAfterRedirects.split(/[?#]/)[0] ?? '';
                if (previousPath !== null && path !== previousPath) this.focusPageHeading();
                previousPath = path;
            });
        void this.restoreSession();
    }

    private async restoreSession(): Promise<void> {
        await this.session.restore();
        const returnUrl = this.session.takeReturnUrl();
        if (returnUrl && this.session.state() === 'signed-in') {
            await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
        }
    }

    /** Shows what the Twitch callback reported, then takes its parameters off the URL. */
    private consumeAuthReturn(): void {
        const params = this.router.parseUrl(this.router.url).queryParamMap;
        if (!AUTH_RETURN_PARAMS.some(key => params.has(key))) return;
        this.notice.set(readAuthReturn(params));
        const cleared = Object.fromEntries(AUTH_RETURN_PARAMS.map(key => [key, null]));
        void this.router.navigate([], {
            queryParams: cleared,
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    /**
     * After an in-app navigation, move focus to the new page's heading so
     * keyboard and screen-reader users start at the content they asked for
     * (the document title changes too, via the route's `title`).
     */
    private focusPageHeading(): void {
        afterNextRender(
            () => {
                const heading = document.querySelector<HTMLElement>('main h1');
                if (!heading) return;
                heading.setAttribute('tabindex', '-1');
                heading.focus({ preventScroll: false });
            },
            { injector: this.injector },
        );
    }
}

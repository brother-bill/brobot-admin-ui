import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SessionUser } from './brobot-api';
import { BrobotApi, isAdmin } from './brobot-api';

export type SessionState = 'unknown' | 'signed-in' | 'signed-out' | 'unreachable';

const RETURN_URL_KEY = 'brobot.authReturnUrl';

/**
 * Who is signed in to brobot.
 *
 * The session is brobot's JWT pair in httpOnly cookies, so the only way to
 * learn who we are is to ask `GET /api/auth/twitch/status`. Most of this site
 * is public, so "signed out" is a normal answer, not a failure: this service
 * talks to the auth endpoints through an `HttpBackend` client, around
 * libs/ngx-auth's interceptor. That interceptor answers any 401 with a refresh
 * and, when the refresh fails too, a redirect to `/` — right for an admin
 * action whose session expired, wrong for a viewer who opened a team link
 * without ever signing in. Here a 401 gets one refresh attempt and then
 * simply means "signed out".
 *
 * The restore does not block the first render (the 2022 site gated every page
 * behind it, and felt slow); pages that care read {@link state}.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly http = new HttpClient(inject(HttpBackend));
    private readonly api = inject(BrobotApi);

    private readonly _user = signal<SessionUser | null>(null);
    private readonly _state = signal<SessionState>('unknown');

    readonly user = this._user.asReadonly();
    readonly state = this._state.asReadonly();
    readonly isAdmin = computed(() => isAdmin(this._user()));

    /** Asks the API who is signed in, refreshing an expired access token once. */
    async restore(): Promise<void> {
        try {
            this.settle(await this.fetchStatus());
        } catch (error) {
            if (!isUnauthorized(error)) {
                this.settleUnreachable(error);
                return;
            }
            try {
                await firstValueFrom(this.http.post(this.api.url('auth/refresh'), {}, { withCredentials: true }));
                this.settle(await this.fetchStatus());
            } catch (retryError) {
                if (isUnauthorized(retryError)) this.settle(null);
                else this.settleUnreachable(retryError);
            }
        }
    }

    /** Clears the cookies. Signed out locally even if the API cannot be reached. */
    async logout(): Promise<void> {
        try {
            await firstValueFrom(this.http.post(this.api.url('auth/twitch/logout'), {}, { withCredentials: true }));
        } catch (error) {
            console.warn('brobot logout request failed; clearing the local session anyway', error);
        }
        this.settle(null);
    }

    /**
     * Remember where the viewer was before the Twitch round trip. The API's
     * callback always lands on the site root; {@link takeReturnUrl} brings
     * them back.
     */
    rememberReturnUrl(url: string): void {
        try {
            sessionStorage.setItem(RETURN_URL_KEY, url);
        } catch {
            // Storage disabled: they land on the home page instead.
        }
    }

    takeReturnUrl(): string | null {
        try {
            const url = sessionStorage.getItem(RETURN_URL_KEY);
            sessionStorage.removeItem(RETURN_URL_KEY);
            // Only ever an in-app path: never an open redirect.
            return url?.startsWith('/') && !url.startsWith('//') ? url : null;
        } catch {
            return null;
        }
    }

    private fetchStatus(): Promise<SessionUser> {
        return firstValueFrom(
            this.http.get<SessionUser>(this.api.url('auth/twitch/status'), { withCredentials: true }),
        );
    }

    private settle(user: SessionUser | null): void {
        this._user.set(user);
        this._state.set(user ? 'signed-in' : 'signed-out');
    }

    private settleUnreachable(error: unknown): void {
        console.warn('brobot session check failed', error);
        this._user.set(null);
        this._state.set('unreachable');
    }
}

function isUnauthorized(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 401;
}

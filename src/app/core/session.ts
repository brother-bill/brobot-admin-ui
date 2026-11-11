import { HttpClient, HttpContext } from '@angular/common/http';
import type { EnvironmentProviders, Provider, Signal } from '@angular/core';
import { computed, inject, provideEnvironmentInitializer } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { AuthConfig, SessionEndpoints, SessionStatus, SessionStore } from '@singularity/ngx-auth';
import { SKIP_SESSION_REFRESH, injectSessionStore, provideSessionEndpoints } from '@singularity/ngx-auth';
import { catchError, of } from 'rxjs';
import type { SessionUser } from './brobot-api';
import { BrobotApi, isAdmin } from './brobot-api';

/**
 * ngx-auth's config for brobot. brobot issues the same httpOnly JWT cookie
 * pair api-time does, so the shared interceptor and `SessionStore` work
 * unchanged once they are pointed at brobot's endpoints
 * ({@link provideBrobotSession}).
 *
 * A logout lands on `/commands`. A refused refresh never navigates: every
 * page is public, so the visitor stays where they are, signed out.
 */
export function brobotAuthConfig(apiBaseUrl: string): AuthConfig {
    return {
        apiBaseUrl,
        signedInRedirectUrl: '/commands',
        onLogout: () => void inject(Router).navigateByUrl('/commands'),
    };
}

/**
 * brobot's session endpoints (`apps/brobot/README.md`, "HTTP surface"):
 * `GET /api/auth/twitch/status` says who is signed in, `POST /api/auth/refresh`
 * (an alias of the Twitch refresh) renews the cookies, and
 * `POST /api/auth/twitch/logout` clears them. They go through the app's
 * `HttpClient`, so the interceptor adds credentials and answers a 401 from the
 * status check with one refresh.
 *
 * A logout the API cannot be reached for still signs out here, as it always
 * has: the store only publishes signed out once its logout request succeeds.
 */
export function brobotSessionEndpoints(): SessionEndpoints<SessionUser> {
    const http = inject(HttpClient);
    const api = inject(BrobotApi);
    return {
        currentUser: () => http.get<SessionUser>(api.url('auth/twitch/status')),
        refresh: () =>
            http.post(
                api.url('auth/refresh'),
                {},
                { context: new HttpContext().set(SKIP_SESSION_REFRESH, true) },
            ),
        logout: () =>
            http.post(api.url('auth/twitch/logout'), {}).pipe(
                catchError((error: unknown) => {
                    console.warn('brobot logout request failed; clearing the local session anyway', error);
                    return of(null);
                }),
            ),
    };
}

export function provideBrobotSession(): Provider {
    return provideSessionEndpoints(brobotSessionEndpoints);
}

/**
 * Starts the session store when the site's frame is first routed to, before
 * any of its guards run: a guard waiting on `authResolved$` has an answer to
 * wait for. The stream overlay is outside that frame and never asks.
 */
export function startSession(): EnvironmentProviders {
    return provideEnvironmentInitializer(() => injectSessionStore<SessionUser>().init());
}

export interface Session {
    readonly store: SessionStore<SessionUser>;
    /** `restoring`, `signed-in`, `signed-out`, or `unreachable` (an outage, retried). */
    readonly status: Signal<SessionStatus>;
    /** Who is signed in. Null unless the status is `signed-in`. */
    readonly user: Signal<SessionUser | null>;
    readonly isAdmin: Signal<boolean>;
}

/** The store with brobot's user, read as signals. Call it in an injection context. */
export function injectSession(): Session {
    const store = injectSessionStore<SessionUser>();
    const published = toSignal(store.currentUser$, { requireSync: true });
    const user = computed(() => (store.status() === 'signed-in' ? published() : null));
    return { store, status: store.status, user, isAdmin: computed(() => isAdmin(user())) };
}

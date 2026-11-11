import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Routes } from '@angular/router';
import type { SessionStore } from '@singularity/ngx-auth';
import { AuthGuard, injectSessionStore } from '@singularity/ngx-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, appTestProviders, user } from '../testing/test-helpers';
import { rememberReturnUrl, takeReturnUrl } from './auth-return';
import type { SessionUser } from './brobot-api';
import type { Session } from './session';
import { injectSession, startSession } from './session';

@Component({
    selector: 'app-test-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<h1>Test page</h1>`,
})
class TestPageComponent {}

/** The app's shape: the frame's route starts the session; a page under it is guarded. */
const ROUTES: Routes = [
    {
        path: '',
        providers: [startSession()],
        children: [
            { path: 'home', component: TestPageComponent },
            { path: 'commands', component: TestPageComponent },
            { path: 'admin', canActivate: [AuthGuard], component: TestPageComponent },
        ],
    },
];

describe('the brobot session (ngx-auth SessionStore on brobot endpoints)', () => {
    let http: HttpTestingController;
    let store: SessionStore<SessionUser>;
    let session: Session;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({ providers: appTestProviders(ROUTES) });
        http = TestBed.inject(HttpTestingController);
        store = TestBed.runInInjectionContext(() => injectSessionStore<SessionUser>());
        session = TestBed.runInInjectionContext(() => injectSession());
    });

    afterEach(() => {
        vi.useRealTimers();
        http.verify();
    });

    function answer(method: string, path: string, status: number, body?: unknown): void {
        const request = http.expectOne(r => r.method === method && r.url === `${API}/${path}`);
        expect(request.request.withCredentials).toBe(true);
        request.flush(body ?? null, { status, statusText: String(status) });
    }

    it('restores a signed-in session from the cookies', () => {
        store.init();
        expect(session.status()).toBe('restoring');
        answer('GET', 'auth/twitch/status', 200, user({ roles: ['StreamerAuth'] }));
        expect(session.status()).toBe('signed-in');
        expect(session.user()?.displayName).toBe('TramaDC');
        expect(session.isAdmin()).toBe(true);
    });

    it('refreshes an expired access token once, then asks again', () => {
        store.init();
        answer('GET', 'auth/twitch/status', 401);
        answer('POST', 'auth/refresh', 200);
        answer('GET', 'auth/twitch/status', 200, user());
        expect(session.status()).toBe('signed-in');
        expect(session.isAdmin()).toBe(false);
    });

    it('treats a 401 the refresh cannot fix as signed out, not as an error', () => {
        store.init();
        answer('GET', 'auth/twitch/status', 401);
        answer('POST', 'auth/refresh', 401);
        expect(session.status()).toBe('signed-out');
        expect(session.user()).toBeNull();
    });

    it('reports an outage as unreachable, never as signed out, until a retry gets through', () => {
        vi.useFakeTimers();
        const resolved: boolean[] = [];
        store.authResolved$.subscribe(({ isSignedIn }) => resolved.push(isSignedIn));
        store.init();

        answer('GET', 'auth/twitch/status', 0);
        expect(session.status()).toBe('unreachable');
        vi.advanceTimersByTime(5_000);
        answer('GET', 'auth/twitch/status', 503);
        expect(session.status()).toBe('unreachable');
        // Nothing was published through the outage: no guard has been answered.
        expect(resolved).toEqual([]);

        vi.advanceTimersByTime(15_000);
        answer('GET', 'auth/twitch/status', 200, user());
        expect(session.status()).toBe('signed-in');
        expect(resolved).toEqual([true]);
    });

    it('waits for the restore before a guarded route decides', async () => {
        const router = TestBed.inject(Router);
        let settled = false;
        const navigation = router.navigateByUrl('/admin').then(ok => {
            settled = true;
            return ok;
        });
        await new Promise(resolve => setTimeout(resolve));
        expect(settled).toBe(false);
        answer('GET', 'auth/twitch/status', 200, user());
        expect(await navigation).toBe(true);
        expect(router.url).toBe('/admin');
    });

    it('sends a signed-out visitor away from a guarded route only once the API has said so', async () => {
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/home');
        answer('GET', 'auth/twitch/status', 401);
        answer('POST', 'auth/refresh', 401);
        await router.navigateByUrl('/admin');
        expect(router.url).toBe('/');
    });

    it('keeps the user signed in when the logout request fails, and lands on /commands once a retry succeeds', async () => {
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/home');
        answer('GET', 'auth/twitch/status', 200, user());

        store.logout();
        expect(store.logoutState()).toBe('signing-out');
        answer('POST', 'auth/twitch/logout', 500);
        // The cookies survived, so the session did too: nothing is faked.
        expect(store.logoutState()).toBe('failed');
        expect(session.status()).toBe('signed-in');
        expect(session.user()?.displayName).toBe('TramaDC');
        await new Promise(resolve => setTimeout(resolve));
        expect(router.url).toBe('/home');

        store.logout();
        answer('POST', 'auth/twitch/logout', 204);
        expect(store.logoutState()).toBe('idle');
        expect(session.status()).toBe('signed-out');
        expect(session.user()).toBeNull();
        await new Promise(resolve => setTimeout(resolve));
        expect(router.url).toBe('/commands');
    });

    it('keeps the signed-in user, and their admin role, through a keep-alive outage', () => {
        vi.useFakeTimers();
        store.init();
        answer('GET', 'auth/twitch/status', 200, user({ roles: ['StreamerAuth'] }));

        // The 10-minute keep-alive renewal finds brobot down.
        vi.advanceTimersByTime(10 * 60 * 1000);
        answer('POST', 'auth/refresh', 503);
        expect(session.status()).toBe('unreachable');
        expect(session.user()?.displayName).toBe('TramaDC');
        expect(session.isAdmin()).toBe(true);

        vi.advanceTimersByTime(5_000);
        answer('GET', 'auth/twitch/status', 200, user({ roles: ['StreamerAuth'] }));
        expect(session.status()).toBe('signed-in');
        expect(session.isAdmin()).toBe(true);
    });

    it('has no user during an outage that came before any answer', () => {
        vi.useFakeTimers();
        store.init();
        answer('GET', 'auth/twitch/status', 0);
        expect(session.status()).toBe('unreachable');
        expect(session.user()).toBeNull();
        expect(session.isAdmin()).toBe(false);
    });

    it('returns only to in-app paths, once', () => {
        rememberReturnUrl('/pokemon/team?username=abc');
        expect(takeReturnUrl()).toBe('/pokemon/team?username=abc');
        expect(takeReturnUrl()).toBeNull();

        rememberReturnUrl('//evil.example');
        expect(takeReturnUrl()).toBeNull();
        rememberReturnUrl('https://evil.example');
        expect(takeReturnUrl()).toBeNull();
    });
});

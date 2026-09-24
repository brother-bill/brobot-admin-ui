import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API, appTestProviders, user } from '../testing/test-helpers';
import { SessionService } from './session.service';

describe('SessionService', () => {
    let session: SessionService;
    let http: HttpTestingController;

    beforeEach(() => {
        sessionStorage.clear();
        TestBed.configureTestingModule({ providers: appTestProviders() });
        session = TestBed.inject(SessionService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    /** Answers requests as they appear: each flush lets the service's next await run. */
    async function answer(...steps: [method: string, path: string, status: number, body?: unknown][]) {
        for (const [method, path, status, body] of steps) {
            await Promise.resolve();
            await new Promise(resolve => setTimeout(resolve));
            const request = http.expectOne(r => r.method === method && r.url === `${API}/${path}`);
            expect(request.request.withCredentials).toBe(true);
            request.flush(body ?? null, { status, statusText: String(status) });
        }
    }

    it('starts unknown, then knows who is signed in', async () => {
        expect(session.state()).toBe('unknown');
        const restored = session.restore();
        await answer(['GET', 'auth/twitch/status', 200, user({ roles: ['StreamerAuth'] })]);
        await restored;
        expect(session.state()).toBe('signed-in');
        expect(session.user()?.displayName).toBe('TramaDC');
        expect(session.isAdmin()).toBe(true);
    });

    it('refreshes an expired access token once, then asks again', async () => {
        const restored = session.restore();
        await answer(
            ['GET', 'auth/twitch/status', 401],
            ['POST', 'auth/refresh', 200],
            ['GET', 'auth/twitch/status', 200, user()],
        );
        await restored;
        expect(session.state()).toBe('signed-in');
        expect(session.isAdmin()).toBe(false);
    });

    it('treats a failed refresh as signed out, not as an error', async () => {
        const restored = session.restore();
        await answer(['GET', 'auth/twitch/status', 401], ['POST', 'auth/refresh', 401]);
        await restored;
        expect(session.state()).toBe('signed-out');
        expect(session.user()).toBeNull();
    });

    it('reports an API it cannot reach', async () => {
        const restored = session.restore();
        await answer(['GET', 'auth/twitch/status', 0]);
        await restored;
        expect(session.state()).toBe('unreachable');
    });

    it('signs out locally even when the logout request fails', async () => {
        const loggedOut = session.logout();
        await answer(['POST', 'auth/twitch/logout', 500]);
        await loggedOut;
        expect(session.state()).toBe('signed-out');
    });

    it('returns only to in-app paths, once', () => {
        session.rememberReturnUrl('/pokemon/team?username=abc');
        expect(session.takeReturnUrl()).toBe('/pokemon/team?username=abc');
        expect(session.takeReturnUrl()).toBeNull();

        session.rememberReturnUrl('//evil.example');
        expect(session.takeReturnUrl()).toBeNull();
        session.rememberReturnUrl('https://evil.example');
        expect(session.takeReturnUrl()).toBeNull();
    });
});

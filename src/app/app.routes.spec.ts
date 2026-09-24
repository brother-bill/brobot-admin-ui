import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { appTestProviders } from './testing/test-helpers';

describe('app routes', () => {
    let http: HttpTestingController;
    let harness: RouterTestingHarness;

    beforeEach(async () => {
        TestBed.configureTestingModule({ providers: appTestProviders(routes) });
        http = TestBed.inject(HttpTestingController);
        harness = await RouterTestingHarness.create();
    });

    afterEach(() => {
        // Whatever the pages asked for is not what these tests are about.
        for (const request of http.match(() => true)) {
            if (!request.cancelled) request.flush(null, { status: 401, statusText: '401' });
        }
    });

    it("sends / to /commands, keeping the Twitch callback's parameters", async () => {
        await harness.navigateByUrl('/?auth_error=access_denied&linked=bot');
        // The redirect keeps them; the shell then shows its notice and drops them.
        const url = TestBed.inject(Router).url;
        expect(url.startsWith('/commands')).toBe(true);
    });

    it('keeps the 2022 paths the bot posts and OBS loads', async () => {
        for (const path of ['/commands', '/pokemon/leaderboard', '/pokemon/team?username=abc', '/pokemon/battleoutcome', '/login']) {
            await harness.navigateByUrl(path);
            expect(TestBed.inject(Router).url).toBe(path);
        }
        await harness.navigateByUrl('/overlay');
        expect(TestBed.inject(Router).url).toBe('/twitch/supahot/overlay');
    });

    it('sends an unknown path to the commands', async () => {
        await harness.navigateByUrl('/feature/home');
        expect(TestBed.inject(Router).url).toBe('/commands');
    });

    it('keeps the query string through the redirect', () => {
        const router = TestBed.inject(Router);
        const redirect = routes.find(r => r.path === '')?.children?.find(r => r.path === '')?.redirectTo;
        expect(typeof redirect).toBe('function');
        const tree = TestBed.runInInjectionContext(() =>
            (redirect as (s: { queryParams: Record<string, unknown> }) => unknown)({
                queryParams: { auth_error: 'invalid_state' },
            }),
        );
        expect(router.serializeUrl(tree as ReturnType<Router['parseUrl']>)).toBe('/commands?auth_error=invalid_state');
    });
});

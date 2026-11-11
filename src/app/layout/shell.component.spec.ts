import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startSession } from '../core/session';
import { API, appTestProviders, text, user } from '../testing/test-helpers';
import { ShellComponent } from './shell.component';

@Component({
    selector: 'app-test-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<h1>Test page</h1>`,
})
class TestPageComponent {}

const ROUTES: Routes = [
    {
        path: '',
        component: ShellComponent,
        providers: [startSession()],
        children: [
            { path: 'commands', component: TestPageComponent },
            { path: 'pokemon/leaderboard', component: TestPageComponent },
        ],
    },
];

describe('ShellComponent', () => {
    let http: HttpTestingController;
    let harness: RouterTestingHarness;

    beforeEach(async () => {
        sessionStorage.clear();
        TestBed.configureTestingModule({ providers: appTestProviders(ROUTES) });
        http = TestBed.inject(HttpTestingController);
        harness = await RouterTestingHarness.create();
    });

    afterEach(() => http.verify());

    async function tick(): Promise<HTMLElement> {
        await new Promise(resolve => setTimeout(resolve));
        TestBed.tick();
        await harness.fixture.whenStable();
        harness.detectChanges();
        return harness.fixture.nativeElement as HTMLElement;
    }

    async function answerStatus(status: 200 | 401, body?: unknown): Promise<HTMLElement> {
        http.expectOne(`${API}/auth/twitch/status`).flush(body ?? null, { status, statusText: String(status) });
        await tick();
        if (status === 401) {
            http.expectOne(`${API}/auth/refresh`).flush(null, { status: 401, statusText: '401' });
        }
        return tick();
    }

    it('offers Twitch sign-in to a signed-out visitor, with the main landmarks', async () => {
        await harness.navigateByUrl('/commands');
        const root = await answerStatus(401);

        const signIn = [...root.querySelectorAll('a')].find(a => a.textContent.includes('Sign in with Twitch'));
        expect(signIn?.getAttribute('href')).toBe(`${API}/auth/twitch/login`);
        expect(root.querySelector('nav[aria-label="Main"]')).not.toBeNull();
        expect(root.querySelector('main#main')).not.toBeNull();
        expect(root.querySelector('a[aria-current="page"]')?.textContent.trim()).toBe('Commands');
        expect(text(root)).toContain('Skip to main content');
    });

    it('shows who is signed in, and signs them out', async () => {
        await harness.navigateByUrl('/pokemon/leaderboard');
        let root = await answerStatus(200, user({ roles: ['StreamerAuth'] }));
        expect(text(root)).toContain('Signed in as TramaDC');
        expect(text(root)).toContain('Admin');

        [...root.querySelectorAll('button')].find(b => b.textContent.includes('Log out'))!.click();
        await tick();
        http.expectOne(r => r.method === 'POST' && r.url === `${API}/auth/twitch/logout`).flush(null, {
            status: 204,
            statusText: 'No Content',
        });
        root = await tick();
        await tick();
        expect(text(root)).toContain('Sign in with Twitch');
        expect(TestBed.inject(Router).url).toBe('/commands');
    });

    it('says so when the logout fails, keeps the user signed in and focused, and a retry lands on /commands', async () => {
        await harness.navigateByUrl('/pokemon/leaderboard');
        let root = await answerStatus(200, user({ roles: ['StreamerAuth'] }));
        const logOut = (): HTMLButtonElement =>
            [...root.querySelectorAll('button')].find(b => b.textContent.includes('Log out'))!;

        logOut().focus();
        logOut().click();
        root = await tick();
        // Signing out: the button says so but keeps focus, and a second press is ignored.
        expect(logOut().getAttribute('aria-disabled')).toBe('true');
        expect(logOut().disabled).toBe(false);
        expect(document.activeElement).toBe(logOut());
        logOut().click();
        http.expectOne(r => r.method === 'POST' && r.url === `${API}/auth/twitch/logout`).flush(null, {
            status: 0,
            statusText: 'Unknown Error',
        });
        root = await tick();

        const alert = root.querySelector('[role="alert"]');
        expect(alert?.textContent.trim()).toBe(
            "Couldn't log you out: brobot isn't answering. You're still signed in on this browser; try again.",
        );
        expect(text(root)).toContain('Signed in as TramaDC');
        expect(text(root)).toContain('Admin');
        expect(text(root)).not.toContain('Sign in with Twitch');
        expect(logOut().hasAttribute('aria-disabled')).toBe(false);
        expect(document.activeElement).toBe(logOut());
        expect(TestBed.inject(Router).url).toBe('/pokemon/leaderboard');

        logOut().click();
        root = await tick();
        // A retry starts: the old error is gone, so a second failure is announced afresh.
        expect(root.querySelector('[role="alert"]')).toBeNull();
        http.expectOne(r => r.method === 'POST' && r.url === `${API}/auth/twitch/logout`).flush(null, {
            status: 204,
            statusText: 'No Content',
        });
        root = await tick();
        await tick();
        expect(text(root)).toContain('Sign in with Twitch');
        expect(root.querySelector('[role="alert"]')).toBeNull();
        expect(TestBed.inject(Router).url).toBe('/commands');
    });

    it("shows the callback's notice and takes it off the URL", async () => {
        await harness.navigateByUrl('/commands?auth_error=wrong_account');
        const root = await answerStatus(401);
        expect(text(root)).toContain("That Twitch account can't be linked here.");
        expect(TestBed.inject(Router).url).toBe('/commands');
        const dismiss = [...root.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Dismiss alert');
        expect(dismiss).toBeDefined();
        // Clearing the parameters is not a new page: focus is left alone.
        expect(document.activeElement?.tagName).not.toBe('H1');
    });

    it('moves focus to the new page heading on a path change only', async () => {
        await harness.navigateByUrl('/commands');
        await answerStatus(401);
        await harness.navigateByUrl('/pokemon/leaderboard');
        await tick();
        expect(document.activeElement?.textContent).toBe('Test page');
        (document.activeElement as HTMLElement).blur();
        await harness.navigateByUrl('/pokemon/leaderboard?sort=level');
        await tick();
        expect(document.activeElement).toBe(document.body);
    });

    it('returns a viewer to the page they signed in from', async () => {
        sessionStorage.setItem('brobot.authReturnUrl', '/pokemon/leaderboard');
        await harness.navigateByUrl('/commands');
        await answerStatus(200, user());
        await tick();
        expect(TestBed.inject(Router).url).toBe('/pokemon/leaderboard');
    });
});

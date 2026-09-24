import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    it("shows the callback's notice and takes it off the URL", async () => {
        await harness.navigateByUrl('/commands?auth_error=wrong_account');
        const root = await answerStatus(401);
        expect(text(root)).toContain("That Twitch account can't be linked here.");
        expect(TestBed.inject(Router).url).toBe('/commands');
    });

    it('returns a viewer to the page they signed in from', async () => {
        sessionStorage.setItem('brobot.authReturnUrl', '/pokemon/leaderboard');
        await harness.navigateByUrl('/commands');
        await answerStatus(200, user());
        await tick();
        expect(TestBed.inject(Router).url).toBe('/pokemon/leaderboard');
    });
});

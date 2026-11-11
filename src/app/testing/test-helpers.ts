import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import type { Routes } from '@angular/router';
import { AUTH_CONFIG, authInterceptor, injectSessionStore, provideSessionEndpoints } from '@singularity/ngx-auth';
import { provideLibUi } from '@singularity/ngx-ui';
import { of } from 'rxjs';
import type { SessionUser } from '../core/brobot-api';
import { provideBrobotApi } from '../core/brobot-api';
import { brobotAuthConfig, brobotSessionEndpoints, provideBrobotSession } from '../core/session';
import { provideUiStrings } from '../core/ui-strings';

export const API_ORIGIN = 'https://api.test';
export const API = `${API_ORIGIN}/api`;

/**
 * The app's real HTTP and session stack (ngx-auth's interceptor and
 * SessionStore, on brobot's endpoints), against HttpTestingController.
 */
export function appTestProviders(routes: Routes = []): (Provider | EnvironmentProviders)[] {
    return [
        provideZonelessChangeDetection(),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_CONFIG, useValue: brobotAuthConfig(API) },
        provideBrobotApi(API_ORIGIN),
        provideBrobotSession(),
        provideLibUi(),
        provideUiStrings(),
    ];
}

/** Lets effects start requests, waits for the app to settle, and re-renders. */
export async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
    TestBed.tick();
    await fixture.whenStable();
    fixture.detectChanges();
}

export function user(overrides: Partial<SessionUser> = {}): SessionUser {
    return {
        oauthId: '123',
        displayName: 'TramaDC',
        roles: ['Viewer'],
        profileImageUrl: null,
        scope: ['user_read'],
        ...overrides,
    };
}

export function text(root: HTMLElement): string {
    return root.textContent.replace(/\s+/g, ' ');
}

/**
 * A settled session for page tests, without the status round trip: the
 * status check answers `signedInAs` once, then signed out (the cookies are
 * gone). Refresh and logout are brobot's, through HttpTestingController.
 * Inject the store with `injectSessionStore` to spy on it.
 */
export function provideFakeSession(signedInAs: SessionUser | null): Provider {
    return provideSessionEndpoints<SessionUser>(() => {
        const endpoints = brobotSessionEndpoints();
        let answer = signedInAs;
        return {
            ...endpoints,
            currentUser: () => {
                const user = answer;
                answer = null;
                return of(user);
            },
        };
    });
}

/** Starts the store, as the shell's route does. */
export function startTestSession(): void {
    TestBed.runInInjectionContext(() => injectSessionStore<SessionUser>().init());
}

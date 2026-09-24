import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import type { Routes } from '@angular/router';
import { provideApi } from '@singularity/contracts/angular';
import { AUTH_CONFIG, authInterceptor } from '@singularity/ngx-auth';
import { provideLibUi } from '@singularity/ngx-ui';
import type { SessionUser } from '../core/brobot-api';
import { isAdmin, provideBrobotApi } from '../core/brobot-api';
import type { SessionState } from '../core/session.service';
import { SessionService } from '../core/session.service';

export const API_ORIGIN = 'https://api.test';
export const API = `${API_ORIGIN}/api`;

/** The app's real HTTP stack (ngx-auth's interceptor included), against HttpTestingController. */
export function appTestProviders(routes: Routes = []): (Provider | EnvironmentProviders)[] {
    return [
        provideZonelessChangeDetection(),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApi({ basePath: API, withCredentials: true }),
        { provide: AUTH_CONFIG, useValue: { apiBaseUrl: API, tokenMode: 'cookie' } },
        provideBrobotApi(API_ORIGIN),
        provideLibUi(),
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

/** A settled session for page tests, without the status round trip. */
export function provideFakeSession(signedInAs: SessionUser | null): Provider {
    const current = signal(signedInAs);
    const fake: Pick<SessionService, 'user' | 'state' | 'isAdmin' | 'rememberReturnUrl'> = {
        user: current.asReadonly(),
        state: computed<SessionState>(() => (current() ? 'signed-in' : 'signed-out')),
        isAdmin: computed(() => isAdmin(current())),
        rememberReturnUrl: () => undefined,
    };
    return { provide: SessionService, useValue: fake };
}
